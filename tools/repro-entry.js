/* 复现：封面入口的状态与续做行为 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4321/';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });

  // 答 3 题后退出，制造"有存档"状态
  await page.click('#btnStart');
  await page.evaluate(() => document.querySelector('.interlude .act').click());
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('3');
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 60));
  }
  await page.click('#btnQuit');
  await new Promise((r) => setTimeout(r, 400));

  const cover = await page.evaluate(() => ({
    topBtn: document.getElementById('btnStart').textContent.trim(),
    bottomBtn: '(single entry)',
    note: document.getElementById('resumeNote').hidden ? '(hidden)' : document.getElementById('resumeNote').textContent
  }));
  console.log('COVER:', JSON.stringify(cover));

  // 从封面主按钮进入
  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 400));
  const after = await page.evaluate(() => {
    const sel = document.querySelector('.opt[aria-pressed="true"]');
    return {
      counter: document.getElementById('qCounter').textContent,
      qno: (document.querySelector('.q-no') || {}).textContent || '',
      preset: sel ? sel.textContent.trim() : '(none)'
    };
  });
  console.log('AFTER bottom btn:', JSON.stringify(after));

  // 看退出时的存档内容，确认答案是否真的写进去了
  const page2 = await browser.newPage();
  await page2.goto(BASE, { waitUntil: 'networkidle2' });
  const raw = await page2.evaluate(() => localStorage.getItem('talent_decode_v1'));
  const parsed = JSON.parse(raw || '{}');
  console.log('SAVED at:', parsed.at);
  console.log('SAVED a:', JSON.stringify((parsed.a || []).slice(0, 8)));
  console.log('SAVED a non-null count:', (parsed.a || []).filter((v) => v !== null).length);

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
