/* 把关键符号用三种字体栈各渲染一遍，截图肉眼确认没有豆腐块 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4321/';
const OUT = require('path').resolve(__dirname, '..', 'shots', 'glyph-test.png');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 760, height: 560, deviceScaleFactor: 2 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });

  await page.evaluate(async () => {
    await document.fonts.ready;
    const box = document.createElement('div');
    box.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999', 'background:#ece7dd',
      'padding:20px', 'font-size:30px', 'color:#17150f', 'line-height:1.6'
    ].join(';');

    const SYMS = ['→', '←', '★', '☆', '①', '⑤', '≠', '⟷', '§', '·', '—', '「」', '％', '＋－', '✓', '〇'];
    const row = (label, family) =>
      '<div style="font-family:' + family + ';margin-bottom:12px">' +
      '<b style="font-size:14px;color:#6a634e">' + label + '</b><br>' + SYMS.join(' ') + '</div>';

    box.innerHTML =
      row('衬线 --display', 'var(--display)') +
      row('正文 --body', 'var(--body)') +
      row('等宽 --mono', 'var(--mono)') +
      '<div style="font-family:var(--display);font-size:24px">衬线中文：天赋解码 · 表达联结 构想创造 分析建构 体验感知</div>' +
      '<div style="font-family:var(--display);font-size:24px">数字：0123456789 ／ 得分 100 分</div>';
    document.body.appendChild(box);
  });

  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: OUT });
  console.log('saved ' + OUT);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
