/* 截图：存储被禁时封面上出现的提示（手机视口），确认版式与对比度 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4321/';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox']
  });

  for (const [name, vp] of [['375', { width: 375, height: 812 }], ['430', { width: 430, height: 932 }]]) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('Access is denied for this document.', 'SecurityError'); }
      });
    });
    await page.setViewport({ ...vp, deviceScaleFactor: 2 });
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: 'shots/savewarn-' + name + '.png' });

    const m = await page.evaluate(() => {
      const w = document.getElementById('saveWarn');
      const rst = document.getElementById('btnRestart');
      const r = w.getBoundingClientRect();
      const cs = getComputedStyle(w);
      const toRGB = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      const lum = (c) => {
        const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
      };
      const l1 = lum(toRGB(cs.color));
      const l2 = lum(toRGB(cs.backgroundColor));
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      return {
        w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x),
        overflowsRight: r.right > window.innerWidth + 1,
        fontSize: cs.fontSize, color: cs.color, bg: cs.backgroundColor,
        contrast: Math.round(ratio * 100) / 100,
        restartHiddenAttr: rst.hidden,
        restartDisplay: getComputedStyle(rst).display,
        resumeNoteHidden: document.getElementById('resumeNote').hidden
      };
    });
    console.log(name + ' → ' + JSON.stringify(m));
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
