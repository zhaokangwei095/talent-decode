/* 校验：[hidden] 的元素是否真的不显示（.act 的 display 曾经盖掉浏览器默认规则） */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4321/';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932 });
  const fail = [];
  const check = (l, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log((ok ? 'PASS ' : 'FAIL ') + l + ' → ' + JSON.stringify(got));
    if (!ok) fail.push(l);
  };
  const hiddenState = () => page.evaluate(() => {
    const out = {};
    document.querySelectorAll('[hidden]').forEach((n) => {
      out[n.id || n.tagName] = {
        display: getComputedStyle(n).display,
        visible: n.getBoundingClientRect().height > 0
      };
    });
    return out;
  });

  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 400));

  console.log('首次进入的 hidden 元素:', JSON.stringify(await hiddenState()));
  check('首次进入：重新开始不可见', await page.evaluate(() =>
    document.getElementById('btnRestart').getBoundingClientRect().height), 0);
  check('首次进入：存档提示不可见', await page.evaluate(() =>
    document.getElementById('resumeNote').getBoundingClientRect().height), 0);
  check('首次进入：答题屏不可见', await page.evaluate(() =>
    document.getElementById('screen-quiz').getBoundingClientRect().height), 0);
  check('首次进入：报告屏不可见', await page.evaluate(() =>
    document.getElementById('screen-report').getBoundingClientRect().height), 0);
  await page.screenshot({ path: 'shots/cover-fresh-430.png' });

  await browser.close();
  console.log(fail.length ? '\n有 ' + fail.length + ' 项失败' : '\n全部通过');
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
