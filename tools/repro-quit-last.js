/* 忠实复现用户描述：答到最后一题后不生成报告，直接点"退出"，
   再刷新页面 → 点两个入口中的任意一个，看是否"重新答题" */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const STUDIO = process.argv[2] || 'https://www.modelscope.cn/studios/zkw095/talent-decode';
const TOTAL = 62;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  /* 直接开本地/独立地址时用主框架；开魔搭社区页时用内嵌 iframe */
  const isStudio = /modelscope\.cn/.test(STUDIO);
  const appFrame = async () => {
    for (let i = 0; i < 40; i++) {
      const f = isStudio
        ? page.frames().find((x) => x.url().includes('ms.show'))
        : page.mainFrame();
      if (f) {
        try { await f.waitForSelector('#btnStart', { timeout: 3000 }); return f; } catch (e) { /* retry */ }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('app frame not found');
  };

  const snap = (f) => f.evaluate(() => {
    const saved = (function () {
      try { return JSON.parse(localStorage.getItem('talent_decode_v1') || 'null'); } catch (e) { return null; }
    })();
    return {
      screen: ['screen-cover', 'screen-quiz', 'screen-report'].filter((s) => !document.getElementById(s).hidden)[0],
      part: document.getElementById('partLabel').textContent,
      counter: document.getElementById('qCounter').textContent,
      qno: (document.querySelector('.q-no') || {}).textContent || '(interlude)',
      btnNext: (document.getElementById('btnNext') || {}).textContent || '(none)',
      savedAt: saved && saved.at,
      savedAnswered: saved ? saved.a.concat(saved.b, saved.c).filter((v) => v !== null).length : null,
      top: document.getElementById('btnStart').textContent.trim(),
      bottom: document.getElementById('btnStart2').textContent.trim(),
      restartHidden: document.getElementById('btnRestart').hidden,
      note: document.getElementById('resumeNote').hidden ? '(hidden)' : document.getElementById('resumeNote').textContent
    };
  });

  await page.goto(STUDIO, { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise((r) => setTimeout(r, isStudio ? 5000 : 800));
  let f = await appFrame();
  await f.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, isStudio ? 4000 : 800));
  f = await appFrame();

  await f.evaluate(() => document.getElementById('btnStart').click());
  await new Promise((r) => setTimeout(r, 300));

  /* 走完全部 62 题：最后一题只作答，不点"生成报告" */
  let answered = 0;
  for (let guard = 0; guard < 300 && answered < TOTAL; guard++) {
    const kind = await f.evaluate(() => {
      if (document.querySelector('.interlude')) return 'interlude';
      if (document.querySelector('.side')) return 'side';
      if (document.querySelector('.opt')) return 'opt';
      return 'none';
    });
    if (kind === 'interlude') {
      await f.evaluate(() => document.querySelector('.interlude .act').click());
      await new Promise((r) => setTimeout(r, 120));
      continue;
    }
    if (kind === 'none') break;
    if (kind === 'side') await f.evaluate(() => document.querySelectorAll('.side')[0].click());
    else await f.evaluate(() => document.querySelectorAll('.opt')[2].click());
    answered++;
    await new Promise((r) => setTimeout(r, 90));
    if (answered < TOTAL) {
      await f.evaluate(() => document.getElementById('btnNext').click());
      await new Promise((r) => setTimeout(r, 90));
    }
  }
  console.log('已在最后一题作答 ' + answered + ' 题：', JSON.stringify(await snap(f), null, 1));

  /* 用户点"退出"而不是"生成报告" */
  await f.evaluate(() => document.getElementById('btnQuit').click());
  await new Promise((r) => setTimeout(r, 500));
  console.log('\n[1] 点退出后的封面:', JSON.stringify(await snap(f), null, 1));

  /* 真实的下次打开：整页刷新 */
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 4000));
  f = await appFrame();
  console.log('\n[2] 刷新后的封面:', JSON.stringify(await snap(f), null, 1));

  /* 从底部第三个入口进入 */
  await f.evaluate(() => document.getElementById('btnStart2').click());
  await new Promise((r) => setTimeout(r, 500));
  console.log('\n[3] 点 §03 底部入口后:', JSON.stringify(await snap(f), null, 1));
  console.log('    预选项:', await f.evaluate(() => {
    const o = document.querySelector('.opt[aria-pressed="true"]');
    return o ? o.textContent.trim() : '(none)';
  }));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
