/* 答题切换回归：确认点选时旧题不重绘，且新题只在延迟结束后替换一次。 */
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
  await new Promise((r) => setTimeout(r, 80));
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
  await new Promise((r) => setTimeout(r, 80));
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
  await new Promise((r) => setTimeout(r, 400));
  const after = await page.evaluate(() => ({
    no: document.querySelector('.q-no').textContent,
    text: document.querySelector('.q-text').textContent,
    animation: getComputedStyle(document.querySelector('.q-step')).animationName
  }));

  console.log(JSON.stringify({ before, selected, repaint, after, errors }, null, 2));
  if (repaint.no !== before.no || repaint.text !== before.text || !repaint.sameNode) {
    throw new Error('点选时旧题被重绘，仍会闪帧');
  }
  if (after.no === before.no) throw new Error('自动换题未发生');
  if (after.animation !== 'question-in') throw new Error('新题动画不正确');
  if (errors.length) throw new Error(errors.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
