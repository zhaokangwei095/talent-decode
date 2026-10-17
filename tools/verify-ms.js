/* 在魔搭 iframe 内验收：选中态颜色 + 封面入口同步 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const STUDIO = process.argv[2] || 'https://www.modelscope.cn/studios/zkw095/talent-decode';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('ERR ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (!/mmstat|doubleclick|google\.com|alilog|401|ERR_CONNECTION/.test(t)) errs.push('C ' + t);
    }
  });
  page.on('dialog', async (d) => { await d.accept(); });

  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
  await page.goto(STUDIO, { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise((r) => setTimeout(r, 3500));

  const src = await page.evaluate(() => {
    const i = document.querySelector('iframe');
    return i ? i.src : null;
  });
  const frame = page.frames().find((f) => f.url() === src);
  if (!frame) { console.log('FRAME NOT FOUND'); await browser.close(); return; }

  await frame.waitForSelector('#btnStart', { timeout: 60000 });

  // 答一题，看选中态颜色
  await frame.click('#btnStart');
  await new Promise((r) => setTimeout(r, 300));
  await frame.evaluate(() => document.querySelector('.interlude .act').click());
  await new Promise((r) => setTimeout(r, 400));
  /* 自动跳题发生在 260ms 后，必须及时采样选中态 */
  await frame.evaluate(() => {
    document.querySelectorAll('.opt')[2].click();
  });
  await new Promise((r) => setTimeout(r, 100));

  const sel = await frame.evaluate(() => {
    const o = document.querySelector('.opt[aria-pressed="true"]');
    if (!o) return null;
    const cs = getComputedStyle(o);
    return {
      label: o.textContent.trim(),
      bg: cs.backgroundColor,
      border: cs.borderTopColor,
      mark: getComputedStyle(o.querySelector('.mark')).backgroundColor
    };
  });
  console.log('SELECTED:', JSON.stringify(sel));
  await page.screenshot({ path: 'shots/ms-fix-selected.png' });

  // 退出，检查封面唯一入口的状态（跨域 iframe 必须用 frame 对象，不能读 contentDocument）
  await frame.evaluate(() => document.getElementById('btnQuit').click());
  await new Promise((r) => setTimeout(r, 2000));
  const coverFrame = page.frames().find((f) => f.url() === src);
  const cover = coverFrame ? await coverFrame.evaluate(() => ({
    top: document.getElementById('btnStart').textContent.trim(),
    bottom: '(single entry)',
    restartHidden: document.getElementById('btnRestart').hidden,
    note: document.getElementById('resumeNote').textContent
  })) : null;
  console.log('COVER:', JSON.stringify(cover, null, 1));
  await page.screenshot({ path: 'shots/ms-fix-cover.png' });
  console.log('errors:', JSON.stringify(errs));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
