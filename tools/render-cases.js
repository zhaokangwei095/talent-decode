/* 直接调用评分 + 渲染，覆盖各类作答分布，检查报告边界情况 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4321/';

const CASES = [
  ['全最高', 4, 4, 2],
  ['全最低', 0, 0, 2],
  ['全平局', 2, 2, 2],
  ['表达创造强', null, 4, 0]
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle2' });

  const out = await page.evaluate((cases) => {
    const E = window.TalentEngine;
    const R = window.TalentRender;
    const B = window.TALENT_BANK;
    const STRONG = ['lang', 'people', 'create', 'aesthetic', 'self'];

    return cases.map(([name, aVal, cVal, bVal]) => {
      const a = B.partA.map((it) => (aVal === null ? (STRONG.includes(it.dim) ? 4 : 1) : aVal));
      const c = B.partC.map((it) => (aVal === null ? (['A', 'S', 'E'].includes(it.fam) ? 4 : 1) : cVal));
      const b = B.partB.map((it, i) => (i % 2 ? 4 : bVal));
      const r = E.score({ a, b, c });

      const host = document.createElement('div');
      R.renderReport(host, r);

      const heads = [...host.querySelectorAll('.sec-head')];
      const weakHead = heads.find((h) => /三项/.test(h.textContent));
      const nums = heads.map((h) => h.querySelector('.sec-num').textContent);
      const overlap = r.avoid.filter((v) => r.careers.some((m) => m.name === v.name));

      return {
        case: name,
        type: r.type.name,
        blend: r.isBlend,
        top3: r.dims.slice(0, 3).map((d) => d.name + Math.round(d.pct)),
        bottom3: r.dims.slice(-3).map((d) => d.name + Math.round(d.pct)),
        sectionNums: nums,
        sectionNumsSequential: nums.every((n, i) => n === '§' + String(i + 1).padStart(2, '0')),
        weakTitle: weakHead ? weakHead.querySelector('.sec-title').textContent : null,
        avoidCount: r.avoid.length,
        careerCount: r.careers.length,
        overlap: overlap.length,
        /* 报告里不应该出现占位或未替换的模板痕迹 */
        noUndefined: !host.textContent.includes('undefined') && !host.textContent.includes('NaN')
      };
    });
  }, CASES);

  console.log(JSON.stringify({ errors, cases: out }, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
