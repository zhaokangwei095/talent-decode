/* 用无头 Chrome 走完整答题流程并截图，用于视觉验收 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4321/';
const OUT = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!u.includes('fontsource')) errors.push('requestfailed: ' + u + ' :: ' + (r.failure() && r.failure().errorText));
  });

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 800));

  await page.screenshot({ path: path.join(OUT, '01-cover-mobile.png'), fullPage: true });

  /* 开始答题 */
  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, '02-interlude-a.png'), fullPage: true });
  await page.evaluate(() => document.querySelector('.interlude .act').click());
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, '03-question-freq.png'), fullPage: true });

  /* 用键盘速答完 A 部分 */
  /* A 部分：按维度强弱选 */
  const A_KEYS = await page.evaluate(() => {
    const strong = ['lang', 'people', 'create', 'aesthetic', 'self'];
    const mid = ['learn', 'execute'];
    return TALENT_BANK.partA.map((it) => {
      if (strong.includes(it.dim)) return '5';
      if (mid.includes(it.dim)) return '3';
      return '2';
    });
  });
  for (const k of A_KEYS) {
    await page.keyboard.press(k);
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 45));
  }
  /* B 段落过渡 */
  await page.evaluate(() => { const b = document.querySelector('.interlude .act'); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, '04-question-fork.png'), fullPage: true });

  /* B 部分 8 题：偏"探索 / 对人 / 广博 / 构想" */
  const B_KEYS = ['1', '2', '1', '2', '5', '4', '1', '2'];
  for (const k of B_KEYS) {
    await page.keyboard.press(k);
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 60));
  }
  await page.evaluate(() => { const b = document.querySelector('.interlude .act'); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, '05-question-interest.png'), fullPage: true });

  /* C 部分 18 题：A/S/E 高 */
  const C_KEYS = await page.evaluate(() =>
    TALENT_BANK.partC.map((it) => (['A', 'S', 'E'].includes(it.fam) ? '5' : '2')));
  for (const k of C_KEYS) {
    await page.keyboard.press(k);
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 45));
  }

  await page.waitForSelector('.report-cover', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, '06-report-mobile.png'), fullPage: true });

  /* 报告页横向溢出审计 */
  const reportOverflow = await page.evaluate(() => {
    const bad = [];
    const vw = window.innerWidth;
    document.querySelectorAll('#reportBody *').forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1) {
        bad.push({
          tag: n.tagName, cls: (n.className || '').toString().slice(0, 40),
          right: Math.round(r.right), w: Math.round(r.width),
          txt: (n.textContent || '').trim().slice(0, 24)
        });
      }
    });
    return {
      docW: document.documentElement.scrollWidth, vw,
      sheetW: Math.round(document.querySelector('.sheet').getBoundingClientRect().width),
      bad: bad.slice(0, 20)
    };
  });
  console.log('REPORT_OVERFLOW ' + JSON.stringify(reportOverflow, null, 2));

  /* 报告分段近景：用视口截图（元素截图会裁到元素边界，易误判溢出） */
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  const targets = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#reportBody .sec').forEach((s, i) => {
      const h = s.querySelector('.sec-title');
      out.push({ i, title: h ? h.textContent : '', y: Math.round(s.getBoundingClientRect().top + window.scrollY) });
    });
    return out;
  });
  for (const t of targets) {
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 64)), t.y);
    await new Promise((r) => setTimeout(r, 220));
    await page.screenshot({ path: path.join(OUT, 'vp-' + String(t.i).padStart(2, '0') + '.png') });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 300));
  console.log('SECTIONS ' + JSON.stringify(targets.map((t) => t.i + ':' + t.title)));

  /* 桌面视图 */
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT, '07-report-desktop.png'), fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, '08-report-desktop-top.png') });

  /* 回封面看桌面版 */
  await page.evaluate(() => {
    localStorage.clear();
    location.reload();
  });
  await page.waitForSelector('#screen-cover:not([hidden])', { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: path.join(OUT, '09-cover-desktop.png'), fullPage: true });
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, '10-cover-375.png'), fullPage: true });

  /* 类型多样性抽样：四种代表性作答，只取类型名与雷达，验证分支 */
  const variants = await page.evaluate(() => {
    const E = window.TalentEngine;
    /* 量表是 0-4（5 个选项），这里必须传 0..4 */
    const pick = (fn) => {
      const a = TALENT_BANK.partA.map(fn);
      const c = TALENT_BANK.partC.map((it) => (['A', 'S', 'E'].includes(it.fam) ? 4 : 1));
      const b = TALENT_BANK.partB.map((it, i) => (i % 2 ? 4 : 0));
      const r = E.score({ a, b, c });
      return { type: r.type.name, key: r.typeKey, gap: r.clusterGap, blend: r.isBlend,
        top: r.dims.slice(0, 3).map((d) => d.name + ':' + Math.round(d.pct)),
        career1: r.careers[0].name, c1fit: r.careers[0].fit, avoid: r.avoid.length };
    };
    return {
      analyze: pick((it) => (['logic', 'execute', 'learn', 'space'].includes(it.dim) ? 4 : 1)),
      perceive: pick((it) => (['body', 'music', 'nature'].includes(it.dim) ? 4 : 1)),
      flat: pick(() => 2),
      inverted: pick((it) => (['logic', 'space', 'body', 'music', 'nature'].includes(it.dim) ? 4 : 0))
    };
  });

  const overflow = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('*').forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.width > 0 && (r.right > window.innerWidth + 2 || r.left < -2)) {
        bad.push(n.tagName + '.' + (n.className || '').toString().slice(0, 40) + ' right=' + Math.round(r.right));
      }
    });
    return { docWidth: document.documentElement.scrollWidth, win: window.innerWidth, bad: bad.slice(0, 12) };
  });

  console.log(JSON.stringify({ errors, variants, overflow }, null, 2));
  await browser.close();
}

run().catch((e) => { console.error('FAILED', e); process.exit(1); });
