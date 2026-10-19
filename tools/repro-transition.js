/* 答题切换回归：确认点选时旧题不重绘，且新题首帧可见、不会闪白。 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4399/';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await page.click('#btnStart');
  await page.evaluate(() => document.querySelector('.interlude .act').click());
  await new Promise((r) => setTimeout(r, 120));

  const before = await page.evaluate(() => ({
    no: document.querySelector('.q-no').textContent,
    text: document.querySelector('.q-text').textContent,
    node: document.querySelector('.q-step')
  }));
  /* 标记当前节点，确认点选期间没有被 innerHTML 重绘替换。 */
  await page.evaluate(() => { document.querySelector('.q-step').dataset.probe = 'same'; });
  await page.keyboard.press('4');
  await new Promise((r) => setTimeout(r, 60));
  const selected = await page.evaluate(() => {
    const step = document.querySelector('.q-step');
    const opt = document.querySelector('.opt[aria-pressed="true"]');
    return {
      no: document.querySelector('.q-no').textContent,
      sameNode: step.dataset.probe === 'same',
      selected: opt && opt.querySelector('.label').textContent,
      nextDisabled: document.getElementById('btnNext').disabled
    };
  });
  await page.keyboard.press('3');
  await new Promise((r) => setTimeout(r, 60));
  const repaint = await page.evaluate(() => {
    const step = document.querySelector('.q-step');
    const opt = document.querySelector('.opt[aria-pressed="true"]');
    return {
      no: document.querySelector('.q-no').textContent,
      text: document.querySelector('.q-text').textContent,
      sameNode: step.dataset.probe === 'same',
      selected: opt && opt.querySelector('.label').textContent,
      nextDisabled: document.getElementById('btnNext').disabled
    };
  });
  await new Promise((r) => setTimeout(r, 80));
  await page.waitForFunction(
    (oldNo) => document.querySelector('.q-no').textContent !== oldNo,
    { timeout: 1000 },
    repaint.no
  );
  const after = await page.evaluate(() => ({
    no: document.querySelector('.q-no').textContent,
    text: document.querySelector('.q-text').textContent,
    animation: getComputedStyle(document.querySelector('.q-step')).animationName,
    opacity: Number(getComputedStyle(document.querySelector('.q-step')).opacity),
    offset: getComputedStyle(document.querySelector('.q-step')).transform
  }));
  await new Promise((r) => setTimeout(r, 300));

  console.log(JSON.stringify({ before, selected, repaint, after, errors }, null, 2));
  if (repaint.no !== before.no || repaint.text !== before.text || !repaint.sameNode) {
    throw new Error('点选时旧题被重绘，仍会闪帧');
  }
  if (after.no === before.no) throw new Error('自动换题未发生');
  if (after.animation !== 'question-slide') throw new Error('新题动画不正确');
  if (after.opacity !== 1) throw new Error('切换过程改变了透明度，仍会闪白');
  if (after.offset === 'none') throw new Error('新题缺少推入过渡');
  if (errors.length) throw new Error(errors.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
