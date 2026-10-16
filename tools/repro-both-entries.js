/* 断言：封面两个入口（顶部 hero 按钮 / §03 底部按钮）在任意进度下行为完全一致 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4321/';

const read = (page) => page.evaluate(() => ({
  screen: ['screen-cover', 'screen-quiz', 'screen-report'].filter((s) => !document.getElementById(s).hidden)[0],
  part: document.getElementById('partLabel').textContent,
  counter: document.getElementById('qCounter').textContent,
  qno: (document.querySelector('.q-no') || {}).textContent || '(interlude)',
  next: (document.getElementById('btnNext') || {}).textContent || '(none)',
  selected: (function () {
    const o = document.querySelector('.opt[aria-pressed="true"], .side[aria-pressed="true"], .between button[aria-pressed="true"]');
    return o ? o.textContent.trim().slice(0, 24) : '(none)';
  })(),
  cover: {
    top: document.getElementById('btnStart').textContent.trim(),
    bottom: document.getElementById('btnStart2').textContent.trim(),
    restartHidden: document.getElementById('btnRestart').hidden,
    note: document.getElementById('resumeNote').hidden ? '(hidden)' : document.getElementById('resumeNote').textContent
  }
}));

/* 答题：A/C 段点第 3 个选项，B 段点左侧再挑程度 */
const answerOne = (page) => page.evaluate(() => {
  const side = document.querySelector('.side');
  if (side) { side.click(); return 'side'; }
  const opts = document.querySelectorAll('.opt');
  if (opts.length) { opts[2].click(); return 'opt'; }
  return 'none';
});

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932 });

  const fail = [];
  const check = (label, a, b) => {
    const same = JSON.stringify(a) === JSON.stringify(b);
    console.log((same ? 'PASS ' : 'FAIL ') + label);
    if (!same) { console.log('  A=' + JSON.stringify(a)); console.log('  B=' + JSON.stringify(b)); fail.push(label); }
  };

  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  console.log('封面初始:', JSON.stringify(await read(page)));

  /* --- 第 1 轮：答 5 题后退出 --- */
  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => document.querySelector('.interlude .act').click());
  await new Promise((r) => setTimeout(r, 250));
  for (let i = 0; i < 5; i++) {
    await answerOne(page);
    await new Promise((r) => setTimeout(r, 120));
    await page.click('#btnNext');
    await new Promise((r) => setTimeout(r, 120));
  }
  await page.click('#btnQuit');
  await new Promise((r) => setTimeout(r, 300));
  const cover = await read(page);
  console.log('有存档时封面:', JSON.stringify(cover.cover));

  /* 入口一：顶部 */
  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 350));
  const viaTop = await read(page);
  console.log('顶部入口 →', JSON.stringify(viaTop));
  await page.click('#btnQuit');
  await new Promise((r) => setTimeout(r, 300));

  /* 入口二：底部 §03 */
  await page.click('#btnStart2');
  await new Promise((r) => setTimeout(r, 350));
  const viaBottom = await read(page);
  console.log('底部入口 →', JSON.stringify(viaBottom));
  check('两个入口落点一致', viaTop, viaBottom);

  /* --- 第 2 轮：整页刷新后再比一次（模拟下次打开） --- */
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 400));
  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 350));
  const afterReloadTop = await read(page);
  await page.click('#btnQuit');
  await new Promise((r) => setTimeout(r, 300));
  await page.click('#btnStart2');
  await new Promise((r) => setTimeout(r, 350));
  const afterReloadBottom = await read(page);
  check('刷新后两个入口落点一致', afterReloadTop, afterReloadBottom);
  check('刷新前后进度不丢', viaTop, afterReloadTop);

  /* --- 第 3 轮：答满 62 题但不生成报告 --- */
  for (let guard = 0; guard < 200; guard++) {
    const st = await page.evaluate(() => {
      if (!document.getElementById('screen-quiz').hidden) {
        if (document.querySelector('.interlude')) return 'interlude';
        const n = document.getElementById('btnNext');
        return n ? n.textContent : 'none';
      }
      return 'other';
    });
    if (st === 'interlude') {
      await page.evaluate(() => document.querySelector('.interlude .act').click());
      await new Promise((r) => setTimeout(r, 120));
      continue;
    }
    if (st === '生成报告') {
      /* 走到最后一题时先作答，否则"生成报告"按钮是 disabled 的 */
      await answerOne(page);
      await new Promise((r) => setTimeout(r, 150));
      break;
    }
    await answerOne(page);
    await new Promise((r) => setTimeout(r, 110));
    await page.click('#btnNext');
    await new Promise((r) => setTimeout(r, 110));
  }
  const atEnd = await read(page);
  console.log('答满 62 题:', JSON.stringify({ counter: atEnd.counter, next: atEnd.next, selected: atEnd.selected }));
  check('最后一题可生成报告', atEnd.next, '生成报告');

  await page.click('#btnQuit');
  await new Promise((r) => setTimeout(r, 350));
  const endCover = (await read(page)).cover;
  console.log('答满后封面:', JSON.stringify(endCover));
  check('答满后封面给续做', { top: endCover.top, bottom: endCover.bottom }, { top: '继续上次', bottom: '继续上次' });

  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 350));
  const endTop = await read(page);
  console.log('答满后顶部入口:', JSON.stringify({ counter: endTop.counter, next: endTop.next, selected: endTop.selected }));
  check('答满后顶部入口回到最后一题', { qno: endTop.qno, next: endTop.next }, { qno: endTop.qno, next: '生成报告' });

  await page.click('#btnQuit');
  await new Promise((r) => setTimeout(r, 300));
  await page.click('#btnStart2');
  await new Promise((r) => setTimeout(r, 350));
  const endBottom = await read(page);
  check('答满后两个入口落点一致', endTop, endBottom);

  /* --- 第 4 轮：走完整个流程能拿到报告 --- */
  await page.click('#btnNext');
  await new Promise((r) => setTimeout(r, 900));
  const report = await page.evaluate(() => ({
    screen: ['screen-cover', 'screen-quiz', 'screen-report'].filter((s) => !document.getElementById(s).hidden)[0],
    sections: document.querySelectorAll('#reportBody .dim-block, #reportBody article').length,
    radar: !!document.querySelector('#reportBody svg.radar'),
    heading: (document.querySelector('#reportBody h2, #reportBody h1') || {}).textContent || ''
  }));
  console.log('报告:', JSON.stringify(report));
  check('能生成报告', { screen: report.screen, radar: report.radar }, { screen: 'screen-report', radar: true });

  console.log(fail.length ? '\n有 ' + fail.length + ' 项失败' : '\n全部通过');
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
