/* 无障碍 / 响应式 / 对比度审计，覆盖 375 / 430 / 768 / 1024 / 1440 */
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4321/';
const WIDTHS = [375, 430, 768, 1024, 1440];

/* 把任意 css 颜色转成 [r,g,b,a] */
const TO_RGB = `
function toRGB(c){
  const d=document.createElement('div');
  d.style.color=c; document.body.appendChild(d);
  const v=getComputedStyle(d).color; d.remove();
  const m=v.match(/rgba?\\(([^)]+)\\)/);
  if(!m) return null;
  const p=m[1].split(',').map(x=>parseFloat(x));
  return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};
}`;

const CONTRAST = `
function lum({r,g,b}){
  const f=(v)=>{v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4);};
  return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);
}
function ratio(a,b){
  const L1=lum(a),L2=lum(b);
  return (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
}
function bgOf(el){
  let n=el;
  while(n && n!==document.documentElement){
    const c=toRGB(getComputedStyle(n).backgroundColor);
    if(c && c.a>0.95) return c;
    n=n.parentElement;
  }
  return {r:236,g:231,b:221,a:1};
}`;

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const report = { errors, widths: {}, a11y: {}, contrast: [] };

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);

  /* ---- 多宽度：横向溢出 ---- */
  for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 350));
    const m = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('body *').forEach((n) => {
        if (n.closest('[hidden]')) return;
        const r = n.getBoundingClientRect();
        if (r.width > 0 && r.right > window.innerWidth + 1.5) {
          bad.push(n.tagName + '.' + (n.className || '').toString().split(' ')[0] +
            ' r=' + Math.round(r.right));
        }
      });
      return { scrollW: document.documentElement.scrollWidth, vw: window.innerWidth, bad: bad.slice(0, 8) };
    });
    report.widths[w] = m;
  }

  /* ---- 答题页：键盘可达性与触控尺寸 ---- */
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await page.click('#btnStart');
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('.interlude .act').click());
  await new Promise((r) => setTimeout(r, 300));

  report.a11y = await page.evaluate(() => {
    const small = [];
    document.querySelectorAll('#screen-quiz button').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width > 0 && (r.height < 44 || r.width < 24)) {
        small.push({ t: b.textContent.trim().slice(0, 14), w: Math.round(r.width), h: Math.round(r.height) });
      }
    });
    const imgNoAlt = Array.from(document.querySelectorAll('img')).filter((i) => !i.hasAttribute('alt')).length;
    const svgNoLabel = Array.from(document.querySelectorAll('svg')).filter((s) =>
      !s.hasAttribute('aria-hidden') && !s.hasAttribute('aria-label') && !s.getAttribute('role')).length;
    const btnNoName = Array.from(document.querySelectorAll('button')).filter((b) =>
      !b.textContent.trim() && !b.getAttribute('aria-label')).length;
    return {
      smallTargets: small, imgNoAlt, svgNoLabel, btnNoName,
      hasViewportMeta: !!document.querySelector('meta[name=viewport]'),
      lang: document.documentElement.lang,
      h1Count: document.querySelectorAll('h1').length,
      liveRegion: !!document.querySelector('[aria-live]'),
      progressbar: !!document.querySelector('[role=progressbar]')
    };
  });

  /* ---- 对比度：正文与次要文字 ---- */
  report.contrast = await page.evaluate(`(() => {
    ${TO_RGB}
    ${CONTRAST}
    const out = [];
    const samples = [
      ['正文段落', '.q-text'],
      ['次要说明', '.q-hint'],
      ['序号标签', '.q-no'],
      ['选项文字', '.opt .label'],
      ['按钮文字', '.act'],
      ['顶部计数', '#qCounter']
    ];
    samples.forEach(([name, sel]) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const fg = toRGB(getComputedStyle(el).color);
      const bg = bgOf(el);
      const fs = parseFloat(getComputedStyle(el).fontSize);
      const bold = parseInt(getComputedStyle(el).fontWeight, 10) >= 700;
      const large = fs >= 24 || (fs >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      const cr = ratio(fg, bg);
      out.push({ name, sel, size: Math.round(fs * 10) / 10, ratio: Math.round(cr * 100) / 100,
        need, pass: cr >= need });
    });
    return out;
  })()`);

  /* ---- 键盘走完全程 ---- */
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  let keySteps = 0;
  for (let i = 0; i < 80; i++) {
    const done = await page.evaluate(() => !!document.querySelector('.report-cover'));
    if (done) break;
    const isIntro = await page.evaluate(() => !!document.querySelector('.interlude .act'));
    if (isIntro) {
      await page.evaluate(() => document.querySelector('.interlude .act').click());
    } else {
      await page.keyboard.press('3');
      await page.keyboard.press('Enter');
      keySteps++;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  report.keyboard = { answeredByKeyboard: keySteps, reachedReport: await page.evaluate(() => !!document.querySelector('.report-cover')) };

  /* ---- 报告页对比度 ---- */
  report.reportContrast = await page.evaluate(`(() => {
    ${TO_RGB}
    ${CONTRAST}
    const out = [];
    const samples = [
      ['报告类型名', '.type-name'],
      ['关键词', '.type-kw'],
      ['类型说明', '.type-line'],
      ['正文', '#reportBody .lede'],
      ['排名分值', '.ranks .sc'],
      ['排名说明', '.ranks .nm small'],
      ['天赋描述', '.dim-block .body p'],
      ['小节标签', '.dim-block .body .lbl'],
      ['集群分值', '.cluster-bar .val'],
      ['职业风险', '.career .meta p.risk'],
      ['职业第一步', '.career .meta p.start'],
      ['避坑说明', '.avoid li span'],
      ['计划正文', '.plan .what'],
      ['计划日期', '.plan .day'],
      ['免责说明', '.disclaimer'],
      ['页脚', '.colophon'],
      ['星级', '.career .stars']
    ];
    samples.forEach(([name, sel]) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const cs = getComputedStyle(el);
      const fg = toRGB(cs.color);
      const bg = bgOf(el);
      const fs = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const large = fs >= 24 || (fs >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      const cr = ratio(fg, bg);
      out.push({ name, sel, size: Math.round(fs * 10) / 10,
        ratio: Math.round(cr * 100) / 100, need, pass: cr >= need });
    });
    return out;
  })()`);

  /* ---- 存档续做 ---- */
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await page.click('#btnStart');
  await page.evaluate(() => document.querySelector('.interlude .act').click());
  await new Promise((r) => setTimeout(r, 200));
  await page.keyboard.press('4');
  await new Promise((r) => setTimeout(r, 200));
  await page.click('#btnQuit');
  await new Promise((r) => setTimeout(r, 300));
  report.resume = await page.evaluate(() => ({
    noteShown: !document.getElementById('resumeNote').hidden,
    noteText: document.getElementById('resumeNote').textContent,
    btnText: document.getElementById('btnStart').textContent.trim(),
    saved: !!localStorage.getItem('talent_decode_v1')
  }));

  /* ---- 减少动效偏好 ---- */
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  report.reducedMotion = await page.evaluate(() => {
    const r = document.querySelector('.reveal');
    return { revealOpacity: r ? getComputedStyle(r).opacity : 'n/a' };
  });

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

run().catch((e) => { console.error('AUDIT FAILED', e); process.exit(1); });
