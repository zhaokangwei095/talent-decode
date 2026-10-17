/* 新版视觉截图：封面 / 答题 / 取舍题 / 报告 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4399/';
const OUT = path.resolve(__dirname, '..', 'shots', 'redesign');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1200));

  await page.screenshot({ path: path.join(OUT, '01-cover-mobile.png'), fullPage: true });
  await page.screenshot({ path: path.join(OUT, '01-cover-viewport.png') });

  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: path.join(OUT, '02-interlude.png') });

  await page.evaluate(() => document.querySelector('.interlude .act').click());
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT, '03-question.png') });

  await page.keyboard.press('4');
  await new Promise((r) => setTimeout(r, 650));
  await page.screenshot({ path: path.join(OUT, '04-question-selected.png') });

  /* 桌面封面 */
  const desk = await browser.newPage();
  await desk.setViewport({ width: 1440, height: 950, deviceScaleFactor: 2 });
  await desk.goto(BASE, { waitUntil: 'networkidle2' });
  await desk.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1200));
  await desk.screenshot({ path: path.join(OUT, '05-cover-desktop.png'), fullPage: true });

  /* 快速走完全程拿报告 */
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
  await p2.goto(BASE, { waitUntil: 'networkidle2' });
  await p2.evaluate(() => localStorage.clear());
  await p2.reload({ waitUntil: 'networkidle2' });
  await p2.click('#btnStart');
  await new Promise((r) => setTimeout(r, 300));
  await p2.evaluate(() => document.querySelector('.interlude .act').click());
  await new Promise((r) => setTimeout(r, 250));
  for (let guard = 0; guard < 400; guard++) {
    const st = await p2.evaluate(() => {
      if (!document.getElementById('screen-quiz').hidden) {
        if (document.querySelector('.interlude')) return 'interlude';
        const n = document.getElementById('btnNext');
        return n ? n.textContent : 'none';
      }
      return 'other';
    });
    if (st === 'interlude') {
      await p2.evaluate(() => document.querySelector('.interlude .act').click());
      await new Promise((r) => setTimeout(r, 120));
      continue;
    }
    if (st === 'none' || st === 'other') break;
    if (st === '查看报告') {
      await p2.evaluate(() => {
        const side = document.querySelector('.side');
        if (side) {
          side.click();
          const between = document.querySelectorAll('.between button');
          if (between[2]) between[2].click();
        } else {
          document.querySelectorAll('.opt')[2].click();
        }
      });
      await new Promise((r) => setTimeout(r, 150));
      break;
    }
    await p2.evaluate(() => {
      const side = document.querySelector('.side');
      if (side) {
        side.click();
        const between = document.querySelectorAll('.between button');
        if (between[2]) between[2].click();
      } else {
        document.querySelectorAll('.opt')[2].click();
      }
    });
    /* A/C 段会在 260ms 后自动前进；B 段需手动点一次"下一题"。 */
    await new Promise((r) => setTimeout(r, 330));
    await p2.evaluate(() => {
      const n = document.getElementById('btnNext');
      if (n && !n.disabled && n.textContent === '下一题') n.click();
    });
    await new Promise((r) => setTimeout(r, 120));
  }
  await p2.click('#btnNext');
  await p2.waitForSelector('.report-cover', { timeout: 20000 });
  const reportHeight = await p2.evaluate(() => document.documentElement.scrollHeight);
  await new Promise((r) => setTimeout(r, 1400));
  await p2.screenshot({ path: path.join(OUT, '06-report-top.png') });
  await p2.screenshot({ path: path.join(OUT, '06-report-full.png'), fullPage: true });

  /* 展开前两项章节与第一个天赋详情，检查折叠动效 */
  const expanded = await p2.evaluate(() => {
    const toggles = Array.from(document.querySelectorAll('.fold-toggle')).slice(0, 2);
    toggles.forEach((b) => b.click());
    const more = document.querySelector('.more-btn');
    if (more) more.click();
    return toggles.length > 0 && !!more;
  });
  await new Promise((r) => setTimeout(r, 700));
  await p2.evaluate(() => document.querySelector('.more-btn').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 350));
  await p2.screenshot({ path: path.join(OUT, '07-report-expanded.png') });
  await p2.screenshot({ path: path.join(OUT, '08-report-expanded-full.png'), fullPage: true });

  const reportErrors = errs.slice();
  console.log(JSON.stringify({
    errors: reportErrors,
    expanded,
    screens: {
      mobile: await page.evaluate(() => document.documentElement.scrollWidth),
      desktop: await desk.evaluate(() => document.documentElement.scrollWidth)
    },
    reportHeight,
    expandedHeight: await p2.evaluate(() => document.documentElement.scrollHeight),
    coverHeight: await page.evaluate(() => document.documentElement.scrollHeight)
  }, null, 2));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
