# 天赋解码 · 职业倾向深度版

一份 62 题的职业天赋测评，纯静态、零依赖、本地计算。基于对 `talent.easydj.cloud` 的选题抓取后重新设计。

## 在线访问

- 国内访问（魔搭创空间，公开）：https://modelscope.cn/studios/zkw095/talent-decode
- 海外访问：https://talent-decode.vercel.app
- 源码：https://github.com/zhaokangwei095/talent-decode

部署细节与本机环境注意事项见 `docs/部署说明.md`。

## 快速开始

```powershell
node tools/serve.js 4321
# 打开 http://127.0.0.1:4321/
```

直接双击 `index.html` 也能用（脚本都是普通 `<script>`，没有模块加载限制）。
**完全离线可用，零外部请求**：标题字体已子集化到本地 `assets/fonts/`，正文用系统字体。

## 目录

```
index.html                  页面骨架（封面 / 答题 / 报告三屏）
data/talent-data.js         第一册：元信息、四大集群、12 维度、A 行为题、B 取舍题
data/talent-data-extra.js   第二册：C 兴趣题、偏好轴解读、职业池、类型表
assets/js/engine.js         评分引擎（纯函数，可在 Node 下直接测）
assets/js/render.js         渲染层（雷达图、报告各节）
assets/js/app.js            答题流程、存档、键盘操作
assets/css/design.css       设计系统
tools/subset-font.py        按实际用字裁剪标题字体（改文案后重跑）
tools/serve.js              本地静态服务
tools/shoot.js              无头 Chrome 走完全程 + 截图
tools/audit.js              响应式 / 无障碍 / 对比度审计
tools/glyph-visual.js       字体缺字（豆腐块）目视检查
tools/render-cases.js       报告边界回归（全高/全低/平局/分化）
tools/check-refs.js         本地资源引用死链检查
tools/repro-both-entries.js 封面两个入口行为一致性回归
tools/repro-quit-last.js    答满未生成报告后退出/重开的续做回归
tools/repro-restart.js      "重新开始"清空与文案回归
tools/repro-no-storage.js   存储被禁时的降级表现回归
tools/check-hidden.js       [hidden] 元素可见性回归
data-source/                原站抓取的题库与报告原始数据
docs/选题对比.md            选题与方向的重设计说明
shots/                      验收截图
```

## 测评设计

| 部分 | 题量 | 问法 | 测什么 |
|---|---|---|---|
| A 行为表现 | 36 | 具体行为的发生频率 | 能力倾向（12 维度 × 3 题） |
| B 工作模式 | 8 | 两个方向强制二选一 | 4 条偏好轴 |
| C 兴趣倾向 | 18 | 想不想做（与能力无关） | 兴趣六族（RIASEC） |

详见 `docs/选题对比.md`。

## 数据与隐私

- 所有计分在浏览器内完成，无网络请求、无后端、无上报。
- 进度存在 `localStorage`（键 `talent_decode_v1`），答完自动清除。
- 报告页可"打印 / 存为 PDF"，样式已做打印适配。

## 开发

改题目或维度只需编辑 `data/` 下的两个文件，`engine.js` 会自动按 `dims` / `partA` / `partB` / `partC` 的长度重建流程，不需要同步改代码。

新增维度时记得同步三处：`dims` 数组、`RADAR_ORDER`（`engine.js`，雷达图轴序）、以及相关职业的 `need` 字段。

改完文案后重跑一次字体子集化，把新增的字形收进字体文件：

```powershell
python tools/subset-font.py   # 需要 pip install fonttools brotli
```

### 验证

```powershell
# 计分引擎回归（不需要浏览器）
node -e "require('./data/talent-data.js');require('./data/talent-data-extra.js');const E=require('./assets/js/engine.js');
const a=TALENT_BANK.partA.map(i=>['lang','people','create','aesthetic','self'].includes(i.dim)?4:1);
const c=TALENT_BANK.partC.map(i=>['A','S','E'].includes(i.fam)?4:1);
const b=TALENT_BANK.partB.map((i,x)=>x%2?4:0);
console.log(E.score({a,b,c}).type.name)"

# 浏览器端：走完全程 + 截图（需先启动 serve.js）
node tools/shoot.js

# 响应式 / 无障碍 / 对比度审计
node tools/audit.js

# 报告边界回归：全高 / 全低 / 平局 / 单集群突出
node tools/render-cases.js

# 字体缺字目视检查
node tools/glyph-visual.js

# 答题进度回归：两个入口一致性 / 答满未生成报告 / 重新开始 / 存储被禁
node tools/repro-both-entries.js
node tools/repro-quit-last.js
node tools/repro-restart.js
node tools/repro-no-storage.js
node tools/check-hidden.js
```

`tools/shoot.js` 与 `tools/audit.js` 依赖 `puppeteer-core` 和本机 Chrome，仅用于开发验收；页面本身不依赖任何 npm 包。

## 无障碍

- 全部可交互元素 ≥ 44px 触控高度，键盘可完成整轮作答（数字键选项、Enter 下一题、方向键翻页）。
- 正文与次要文字对比度 ≥ 4.5:1（审计脚本覆盖 23 处文字，含报告页全部文本层级）。
- 尊重 `prefers-reduced-motion`。
- 320 / 375 / 430 / 768 / 1024 / 1440 px 无横向溢出。

## 体积

静态资源合计约 530KB，其中标题字体 395KB（两个字重）。正文不加载 Web 字体。
除字体外的全部代码（HTML + CSS + JS + 题库）约 133KB，未压缩、无构建步骤。

## 理论框架与边界

框架取自加德纳多元智能、霍兰德职业兴趣理论，以及大五人格的行为学视角。**这是一份用于整理线索的自评工具，不是心理诊断，也不预测上限。** 报告中所有职业建议都附了"真实的一面"与第一步动作，请结合真实经历与市场机会判断。
