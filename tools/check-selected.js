/* 验证选项选中态的计算颜色 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4321/';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await page.click('#btnStart');
  await page.evaluate(() => document.querySelector('.interlude .act').click());
  await new Promise((r) => setTimeout(r, 120));
  /* 在自动跳题的 260ms 之前采样，否则会读到下一题的空选中态 */
  await page.keyboard.press('3');
  await new Promise((r) => setTimeout(r, 100));

  const s = await page.evaluate(() => {
    const o = document.querySelector('.opt[aria-pressed="true"]');
    if (!o) return null;
    const cs = getComputedStyle(o);
    return {
      label: o.textContent.trim(),
      bg: cs.backgroundColor,
      border: cs.borderLeftColor,
      mark: getComputedStyle(o.querySelector('.mark')).color
    };
  });
  console.log('SELECTED:', JSON.stringify(s));
  await page.screenshot({ path: 'shots/fix-selected.png' });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
