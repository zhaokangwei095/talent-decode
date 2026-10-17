/* 校验"重新开始"：确认文案里的题数是否真实，以及确认后是否真的回到第 1 题 */
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

  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });

  /* 答 7 题后退出 */
  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => document.querySelector('.interlude .act').click());
  await new Promise((r) => setTimeout(r, 250));
  for (let i = 0; i < 7; i++) {
    await page.evaluate(() => {
      const side = document.querySelector('.side');
      if (side) { side.click(); return; }
      document.querySelectorAll('.opt')[2].click();
    });
    await new Promise((r) => setTimeout(r, 110));
    await page.click('#btnNext');
    await new Promise((r) => setTimeout(r, 110));
  }
  await page.click('#btnQuit');
  await new Promise((r) => setTimeout(r, 350));

  check('封面出现重新开始', await page.evaluate(() => !document.getElementById('btnRestart').hidden), true);

  /* 抓取 confirm 文案 */
  let confirmText = '';
  page.on('dialog', async (d) => { confirmText = d.message(); await d.accept(); });
  await page.click('#btnRestart');
  await new Promise((r) => setTimeout(r, 400));
  console.log('确认文案:', confirmText);
  check('确认文案题数真实', /已答的 7 题/.test(confirmText), true);

  const after = await page.evaluate(() => ({
    screen: ['screen-cover', 'screen-quiz', 'screen-report'].filter((s) => !document.getElementById(s).hidden)[0],
    counter: document.getElementById('qCounter').textContent,
    saved: localStorage.getItem('talent_decode_v1')
  }));
  console.log('确认后:', JSON.stringify(after));
  check('已回到第一段说明页', after.screen, 'screen-quiz');

  /* 回到封面应显示"开始测评" */
  await page.click('#btnQuit');
  await new Promise((r) => setTimeout(r, 300));
  check('清空后封面回到开始测评', await page.evaluate(() => ({
    top: document.getElementById('btnStart').textContent.trim(),
    bottom: '(single entry)',
    noteHidden: document.getElementById('resumeNote').hidden,
    restartHidden: document.getElementById('btnRestart').hidden
  })), { top: '开始测评', bottom: '(single entry)', noteHidden: true, restartHidden: true });

  console.log(fail.length ? '\n有 ' + fail.length + ' 项失败' : '\n全部通过');
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
