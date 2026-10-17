/* 复现"第三方存储被禁"：localStorage 读写抛错时，页面是否还会谎称"进度已保存" */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4321/';

/* A/C 段点第 3 个选项；B 段先点左侧方向，再点中间程度。 */
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
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Access is denied for this document.', 'SecurityError'); }
    });
  });
  await page.setViewport({ width: 430, height: 932 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });

  const fail = [];
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log((ok ? 'PASS ' : 'FAIL ') + label + ' → ' + JSON.stringify(got));
    if (!ok) fail.push(label + ' got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want));
  };

  const cover = await page.evaluate(() => ({
    warnHidden: document.getElementById('saveWarn').hidden,
    warnText: document.getElementById('saveWarn').textContent.trim().slice(0, 30),
    noteHidden: document.getElementById('resumeNote').hidden,
    top: document.getElementById('btnStart').textContent.trim()
  }));
  console.log('封面:', JSON.stringify(cover));
  check('存储不可用时给出提示', cover.warnHidden, false);
  check('不谎称有存档', cover.noteHidden, true);

  /* 仍然要能完整答完并拿到报告 */
  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => document.querySelector('.interlude .act').click());
  await new Promise((r) => setTimeout(r, 250));

  for (let guard = 0; guard < 300; guard++) {
    const st = await page.evaluate(() => {
      if (document.querySelector('.interlude')) return 'interlude';
      const n = document.getElementById('btnNext');
      return n ? n.textContent : 'none';
    });
    if (st === 'interlude') {
      await page.evaluate(() => document.querySelector('.interlude .act').click());
      await new Promise((r) => setTimeout(r, 120));
      continue;
    }
    if (st === '查看报告') {
      /* 最后一题只作答，点击"查看报告"留到循环后统一处理 */
      await answerOne(page);
      await new Promise((r) => setTimeout(r, 180));
      break;
    }
    await answerOne(page);
    /* A/C 段选中后自动前进；B 段要先选方向再选程度，
       等自动计时器不会触发，所以这里显式点一次"下一题"。 */
    await new Promise((r) => setTimeout(r, 60));
    await page.evaluate(() => {
      const n = document.getElementById('btnNext');
      if (n && !n.disabled) n.click();
    });
    await new Promise((r) => setTimeout(r, 360));
  }
  await page.click('#btnNext');
  await new Promise((r) => setTimeout(r, 1000));
  const report = await page.evaluate(() => ({
    screen: ['screen-cover', 'screen-quiz', 'screen-report'].filter((s) => !document.getElementById(s).hidden)[0],
    radar: !!document.querySelector('#reportBody svg.radar'),
    /* 报告正文里本来就有 .disclaimer 区块，真正的失败特征是那句话 */
    err: /报告生成失败/.test(document.getElementById('reportBody').textContent)
  }));
  console.log('报告:', JSON.stringify(report));
  check('存储不可用也能出报告', { screen: report.screen, radar: report.radar, err: report.err },
    { screen: 'screen-report', radar: true, err: false });

  const pageErrs = [];
  /* 收集运行期异常 */
  page.on('pageerror', (e) => pageErrs.push(e.message));
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 500));
  check('重载无脚本异常', pageErrs, []);

  console.log(fail.length ? '\n有 ' + fail.length + ' 项失败' : '\n全部通过');
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
