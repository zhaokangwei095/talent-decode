/* 检查 index.html 与 CSS 里的本地资源引用是否都存在（避免死链） */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let missing = 0;

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
  .filter((u) => !u.startsWith('data:') && !u.startsWith('#'));
refs.forEach((u) => {
  const p = path.join(ROOT, u);
  const ok = fs.existsSync(p);
  if (!ok) missing++;
  console.log((ok ? 'OK   ' : 'MISS ') + u);
});

const cssPath = path.join(ROOT, 'assets', 'css', 'design.css');
const css = fs.readFileSync(cssPath, 'utf8');
[...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]).forEach((u) => {
  if (/^https?:/.test(u)) { console.log('EXT  ' + u); return; }
  const p = path.resolve(path.dirname(cssPath), u);
  const ok = fs.existsSync(p);
  if (!ok) missing++;
  console.log((ok ? 'OK   ' : 'MISS ') + u);
});

console.log(missing === 0 ? '\n所有资源引用有效' : `\n有 ${missing} 个死链`);
process.exit(missing === 0 ? 0 : 1);
