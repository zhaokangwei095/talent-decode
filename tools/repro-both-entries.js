/* 断言：封面的续做入口在任意进度下都从同一个位置继续。
   新版封面只保留一个入口，这里改为校验"顶部入口 + 整页刷新"两条路径一致。 */
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
    bottom: (document.getElementById('btnStart2') || {}).textContent || '(none)',
    restartHidden: document.getElementById('btnRestart').hidden,
    note: document.getElementById('resumeNote').hidden ? '(hidden)' : document.getElementById('resumeNote').textContent
  }
}));

/* 答题：A/C 段点第 3 个选项；B 段先选左侧，再选中间程度。
   B 段是两步交互，必须一次完成，否则下一题按钮会一直不可用。 */
const answerOne = (page) => page.evaluate(() => {
  const side = document.querySelector('.side');
  if (side) {
    side.click();
    const between = document.querySelectorAll('.between button');
    if (between[2]) { between[2].click(); return 'side+between'; }
    return 'side';
  }
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
    await new Promise((r) => setTimeout(r, 480));
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

  /* 入口二：整页刷新后同一入口（等价于用户下次打开链接） */
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 400));
  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 350));
  const viaReload = await read(page);
  console.log('刷新后入口 →', JSON.stringify(viaReload));
  check('刷新前后落点一致', viaTop, viaReload);

  /* --- 第 2 轮：再刷新一次，确认进度不丢 --- */
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 400));
  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 350));
  const afterReloadTop = await read(page);
  await page.click('#btnQuit');
  await new Promise((r) => setTimeout(r, 300));
  check('刷新前后进度不丢', viaTop, afterReloadTop);

  /* --- 第 3 轮：答满 62 题但不生成报告 --- */
  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 350));
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
    if (st === '查看报告') {
      /* 最后一题只作答，不生成报告，留给下面验证退出后能续做 */
      await answerOne(page);
      await new Promise((r) => setTimeout(r, 180));
      break;
    }
    await answerOne(page);
    /* A/C 段点选后会延迟 260ms 自动前进；B 段是两步选择，不会自动走。
       这里在自动计时器触发前显式点"下一题"，两种情况都能稳定推进。 */
    await new Promise((r) => setTimeout(r, 60));
    await page.evaluate(() => {
      const n = document.getElementById('btnNext');
      if (n && !n.disabled) n.click();
    });
    await new Promise((r) => setTimeout(r, 360));
  }
  const atEnd = await read(page);
  console.log('答满 62 题:', JSON.stringify({ counter: atEnd.counter, next: atEnd.next, selected: atEnd.selected }));
  check('最后一题可生成报告', atEnd.next, '查看报告');

  await page.click('#btnQuit');
  await new Promise((r) => setTimeout(r, 350));
  const endCover = (await read(page)).cover;
  console.log('答满后封面:', JSON.stringify(endCover));
  check('答满后封面给续做', { top: endCover.top, bottom: endCover.bottom }, { top: '继续上次', bottom: '(none)' });

  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 350));
  const endTop = await read(page);
  console.log('答满后顶部入口:', JSON.stringify({ counter: endTop.counter, next: endTop.next, selected: endTop.selected }));
  check('答满后顶部入口回到最后一题', { qno: endTop.qno, next: endTop.next }, { qno: endTop.qno, next: '查看报告' });

  await page.click('#btnQuit');
  await new Promise((r) => setTimeout(r, 300));
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 400));
  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 350));
  const endBottom = await read(page);
  check('答满后刷新仍落在最后一题', endTop, endBottom);

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
