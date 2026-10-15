/* =========================================================================
 * 天赋解码 · 渲染层
 * 负责把 engine 的结果变成 DOM。所有题库与计分逻辑都在 data / engine 里。
 * ========================================================================= */
(function (root) {
  'use strict';

  var B = root.TALENT_BANK;
  var E = root.TalentEngine;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }

  var CLUSTER_CLS = { express: 'express', create: 'create', analyze: 'analyze', perceive: 'perceive' };

  /* ---------------- 封面：集群目录 ---------------- */
  function renderIndex(host) {
    var ol = el('ol', 'index-list');
    B.clusterOrder.forEach(function (key, i) {
      var c = B.clusters[key];
      var members = B.dims.filter(function (d) { return d.cluster === key; });
      var li = el('li', 'index-row');
      li.setAttribute('data-cluster', key);
      li.appendChild(el('div', 'no', '0' + (i + 1)));
      var body = el('div');
      body.appendChild(el('h3', null, c.name));
      var lines = el('div', 'lines');
      members.forEach(function (d) { lines.appendChild(el('span', null, d.name)); });
      body.appendChild(lines);
      body.appendChild(el('div', 'tag', c.desc));
      li.appendChild(body);
      ol.appendChild(li);
    });
    host.innerHTML = '';
    host.appendChild(ol);
  }

  /* ---------------- 报告：雷达图（12 轴） ---------------- */
  function radarSVG(dims) {
    var CX = 180, CY = 170, R = 108;
    var n = dims.length;
    function pt(i, r) {
      var ang = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [CX + Math.cos(ang) * r, CY + Math.sin(ang) * r];
    }
    var out = ['<svg class="radar" viewBox="0 0 360 340" role="img" aria-label="十二项天赋的分布雷达图">'];

    // 同心网格
    [.25, .5, .75, 1].forEach(function (k) {
      var pts = [];
      for (var i = 0; i < n; i++) { var p = pt(i, R * k); pts.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); }
      out.push('<polygon class="grid-line" points="' + pts.join(' ') + '"/>');
    });
    // 辐条
    for (var i = 0; i < n; i++) {
      var p = pt(i, R);
      out.push('<line class="spoke" x1="' + CX + '" y1="' + CY + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>');
    }
    // 数据面
    var draw = [];
    dims.forEach(function (d, i) {
      var r = R * Math.max(d.pct, 2) / 100;
      var q = pt(i, r);
      draw.push(q[0].toFixed(1) + ',' + q[1].toFixed(1));
    });
    out.push('<polygon class="shape" points="' + draw.join(' ') + '"/>');
    // 节点
    dims.forEach(function (d, i) {
      var r = R * Math.max(d.pct, 2) / 100;
      var q = pt(i, r);
      out.push('<circle class="node" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="2.6"/>');
    });
    // 轴标签
    dims.forEach(function (d, i) {
      var q = pt(i, R + 24);
      var anchor = 'middle';
      if (q[0] < CX - 12) anchor = 'end';
      if (q[0] > CX + 12) anchor = 'start';
      var top = i === 0;
      out.push('<text class="axis-name' + (top ? ' is-top' : '') + '" x="' + q[0].toFixed(1) + '" y="' + (q[1] - 4).toFixed(1) +
        '" text-anchor="' + anchor + '">' + esc(d.short) + '</text>');
      out.push('<text class="axis-val" x="' + q[0].toFixed(1) + '" y="' + (q[1] + 7).toFixed(1) +
        '" text-anchor="' + anchor + '">' + Math.round(d.pct) + '</text>');
    });
    out.push('</svg>');
    return out.join('');
  }

  /* ---------------- 报告：详情区块 ---------------- */
  function dimBlock(d, rank) {
    var b = E.band(d.pct);
    var html = '<article class="dim-block">' +
      '<div class="db-head">' +
        '<span class="glyph" aria-hidden="true">' + esc(d.glyph) + '</span>' +
        '<div>' +
          '<h3>' + esc(d.name) + '</h3>' +
          '<div class="sub">第 ' + rank + ' 位 · ' + esc(B.clusters[d.cluster].name) + ' · ' + esc(b.text) + '</div>' +
        '</div>' +
        '<div class="score"><b>' + Math.round(d.pct) + '</b>／100</div>' +
      '</div>' +
      '<p class="slogan">' + esc(d.slogan) + '</p>' +
      '<div class="body">' +
        '<span class="lbl">表现</span>' +
        '<p>' + esc(d.desc) + '。' + esc(d.grow) + '。</p>' +
        '<span class="lbl">常见表现</span>' +
        '<ul class="ticks">' + d.strengths.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
        '<span class="lbl">容易踩的坑</span>' +
        '<ul class="crosses">' + d.traps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
        '<span class="lbl">能发挥它的场景</span>' +
        '<div class="chips">' + d.scenes.map(function (s) { return '<span class="chip">' + esc(s) + '</span>'; }).join('') + '</div>' +
        '<span class="lbl">可以马上试的做法</span>' +
        '<ul class="ticks">' + d.advice.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
      '</div></article>';
    return html;
  }

  function starText(n) {
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  }

  /* ---------------- 报告主渲染 ---------------- */
  function renderReport(host, result) {
    var t = result.type;
    var top = result.dims.slice(0, 4);
    var plan = E.buildPlan(result);
    var rel = result.reliability;
    var h = [];
    var seq = 0;
    function secNo(title, note) {
      seq += 1;
      return '<div class="sec-head"><span class="sec-num">§' + String(seq).padStart(2, '0') + '</span>' +
        '<h2 class="sec-title">' + title + '</h2>' +
        (note ? '<span class="sec-note">' + note + '</span>' : '') + '</div>';
    }

    /* 抬头 */
    h.push('<header class="report-cover">');
    h.push('<div class="kicker">' + esc(B.meta.edition) + ' · 天赋报告</div>');
    h.push('<h1 class="type-name">' + esc(t.glyph) + ' ' + esc(t.name) + '</h1>');
    h.push('<div class="type-kw">' + esc(t.kw) + '</div>');
    h.push('<p class="type-line">' + esc(t.line) + '</p>');
    h.push('</header>');

    /* §01 类型解读 */
    h.push('<section class="sec">' + secNo('你被分到这个类型，是因为',
      esc(B.clusters[result.clusterRank[0]].name) +
      (result.isBlend ? ' ＋ 并列' : ' ＋ ' + B.clusters[result.clusterRank[1]].name)));
    h.push('<div class="duo">');
    h.push('<div class="cell ok"><h4>你的底牌</h4><p>' + esc(t.edge) + '</p></div>');
    h.push('<div class="cell risk"><h4>要留神的地方</h4><p>' + esc(t.warn) + '</p></div>');
    h.push('</div>');
    if (result.isBlend) {
      h.push('<p class="lede" style="margin-top:1rem;font-size:.875rem">你的两个大方向分数接近（相差 ' +
        result.clusterGap + ' 分），说明你不属于单一类型。这类人被归类时最容易被贴错标签，' +
        '下面这份报告请读细节，不要只记住类型名。</p>');
    }
    h.push('</section>');

    /* §02 图谱 */
    h.push('<section class="sec">' + secNo('天赋分布图', '12 项 · 满分 100'));
    /* 雷达用固定轴序（见 engine RADAR_ORDER），便于横向比较 */
    h.push('<div class="chart-wrap">' + radarSVG(result.dimsFixed) + '</div>');
    h.push('<p class="lede" style="font-size:.75rem;color:var(--ink-3);margin-top:.5rem;text-align:center">' +
      '按四大方向顺序排列，顺时针：表达联结 → 构想创造 → 分析建构 → 体验感知</p>');
    var cb = '<div class="cluster-bar">';
    B.clusterOrder.slice().sort(function (x, y) { return result.clusters[y] - result.clusters[x]; })
      .forEach(function (key) {
        var c = B.clusters[key];
        cb += '<div class="cb-row"><span class="lbl t-' + CLUSTER_CLS[key] + '">' + esc(c.name) + '</span>' +
          '<span class="track"><i class="c-' + CLUSTER_CLS[key] + '" style="width:' + result.clusters[key] + '%"></i></span>' +
          '<span class="val">' + Math.round(result.clusters[key]) + '</span></div>';
      });
    cb += '</div>';
    h.push(cb);
    h.push('</section>');

    /* §03 强弱排序 */
    h.push('<section class="sec">' + secNo('十二项排序', '按本轮作答'));
    h.push('<ol class="ranks">');
    result.dims.forEach(function (d, i) {
      h.push('<li class="' + (i < 3 ? 'is-top' : '') + '">' +
        '<span class="rk">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="nm">' + esc(d.name) + '<small>' + esc(d.desc) + '</small></span>' +
        '<span class="sc">' + Math.round(d.pct) + ' · ' + esc(E.band(d.pct).text) + '</span>' +
        '</li>');
    });
    h.push('</ol></section>');

    /* §04 前四项详解 */
    h.push('<section class="sec">' + secNo('优势详解', '得分最高的四项'));
    top.forEach(function (d, i) { h.push(dimBlock(d, i + 1)); });
    h.push('<p class="lede" style="margin-top:1.25rem;font-size:.875rem">' +
      '剩下 ' + (result.dims.length - 4) + ' 项没有展开。它们不是缺点，只是这一轮里相对不突出——' +
      '在关系、学习、成长这几件事上，它们往往比你的第一名更有用。完整数据见上方排序表。</p>');
    h.push('</section>');

    /* 成长空间：取分数最低的三项，给"怎么绕过"而不是"怎么补短板"。
       若最低分也不低，说明这轮没有明显弱项，改说相对次序，不要硬贴"弱"的标签。 */
    var weak = result.dims.slice(-3).slice().reverse();
    var noWeak = weak[0].pct >= 70;
    h.push('<section class="sec">' + secNo(
      noWeak ? '相对靠后的三项' : '暂时不突出的三项',
      noWeak ? '这轮没有明显短板' : '不必硬补，知道怎么绕'));
    h.push('<p class="lede">' + (noWeak
      ? '你的十二项分数都在中上区间，没有明显拖后腿的一项。这种情况下，继续找"哪里不行"意义不大，' +
        '更值得做的是：从下面这三项里挑一项，把它和你的最强项组合起来用，形成别人不容易复制的复合优势。'
      : '这三项不是缺陷。人在弱项上花同样的时间，回报通常远低于把强项再拉高一档。' +
        '更划算的做法是：知道它会拖你后腿，提前配工具、找搭子或换路径。') + '</p>');
    h.push('<ul class="avoid" style="margin-top:1rem">');
    weak.forEach(function (d) {
      h.push('<li><div><b>' + esc(d.name) + ' · ' + Math.round(d.pct) + ' 分</b>' +
        '<span>' + esc(d.grow) + '</span></div>' +
        '<span class="lv">' + esc(noWeak ? '仍有空间' : E.band(d.pct).text) + '</span></li>');
    });
    h.push('</ul></section>');

    /* 工作模式 */
    h.push('<section class="sec">' + secNo('你的工作模式', '来自取舍题，不是自评'));
    h.push('<div class="duo">');
    result.axes.forEach(function (ax) {
      h.push('<div class="cell"><h4>' + esc(ax.name) + '<span style="font-weight:400;color:var(--ink-3);font-size:.75rem"> · ' +
        esc(ax.left) + ' ⟷ ' + esc(ax.right) + '</span></h4><p>' + esc(ax.text) + '</p></div>');
    });
    h.push('</div></section>');

    /* §06 兴趣 */
    h.push('<section class="sec">' + secNo('你愿意做的事', '兴趣 ≠ 能力'));
    h.push('<p class="lede">能力决定你做得动什么，兴趣决定你能撑多久。两组分数叠在一起看，才是完整的线索。</p>');
    var ci = '<div class="cluster-bar">';
    result.interests.forEach(function (f) {
      ci += '<div class="cb-row"><span class="lbl">' + esc(f.name) + '</span>' +
        '<span class="track"><i class="c-analyze" style="width:' + f.pct + '%"></i></span>' +
        '<span class="val">' + Math.round(f.pct) + '</span></div>';
    });
    ci += '</div>';
    h.push(ci);
    h.push('</section>');

    /* §07 职业匹配 */
    h.push('<section class="sec">' + secNo('匹配的方向', '能力 × 兴趣'));
    result.careers.forEach(function (c) {
      var s = E.stars(c.fit);
      h.push('<article class="career">' +
        '<div class="ch"><h3>' + esc(c.name) + '</h3><span class="stars" title="契合度 ' + c.fit + '%">' + starText(s) + '</span></div>' +
        '<p class="why">' + esc(c.fitText) + '</p>' +
        '<div class="meta">' +
          '<p class="risk"><b>真实的一面：</b>' + esc(c.risk) + '</p>' +
          '<p class="start"><b>第一步：</b>' + esc(c.start) + '</p>' +
        '</div></article>');
    });
    h.push('<p class="lede" style="margin-top:1rem;font-size:.875rem">' +
      '星级看的是"你的能力结构和它的要求有多重合"，不代表行业前景、薪资或门槛。' +
      '同样重要的是：一份工作值不值得去，还取决于你有多少机会和多少人竞争。</p>');
    h.push('</section>');

    /* §08 避坑 */
    if (result.avoid.length) {
      h.push('<section class="sec">' + secNo('建议谨慎的方向', '缺口最大，非绝对禁止'));
      h.push('<ul class="avoid">');
      result.avoid.forEach(function (a) {
        h.push('<li><div><b>' + esc(a.name) + '</b><span>' + esc(a.note) + '</span></div>' +
          '<span class="lv">' + esc(a.level) + '</span></li>');
      });
      h.push('</ul>');
      h.push('<p class="lede" style="margin-top:.75rem;font-size:.8125rem">' +
        '这份清单的意思是"你现在进去会更吃力"，不是"你永远做不了"。' +
        '如果某个方向你真的想做，把它当成需要提前补课的科目，而不是禁区。</p>');
      h.push('</section>');
    }

    /* §09 验证计划 */
    h.push('<section class="sec">' + secNo('7 天验证计划', '别只收藏，去做'));
    h.push('<ul class="plan">');
    plan.forEach(function (p) {
      h.push('<li><span class="day">' + esc(p.day) + '</span><span class="what">' + esc(p.what) + '</span></li>');
    });
    h.push('</ul>');
    h.push('<p class="lede" style="margin-top:1rem">测试只能告诉你"可能"在哪里。' +
      '真正让你确定的，是这 7 天里做出来的东西和见到的人。</p>');
    h.push('</section>');

    /* 一致性提示 + 免责 */
    if (rel.flat || rel.tight) {
      h.push('<div class="disclaimer"><b>一点提醒：</b>你这一轮的答案集中在 ' + rel.distinct +
        ' 个选项上。如果当时是"凭感觉快速选完"，分数差距会被压缩，排序的参考价值会下降。' +
        '想看得更清楚，可以隔一天放慢速度再测一次。</div>');
    }
    h.push('<div class="disclaimer"><b>关于这份报告：</b>它基于' + esc(B.meta.basis) +
      '的框架设计，用来帮你整理线索，不是心理诊断，也不预测你的上限。' +
      '任何职业选择都建议结合真实经历、市场机会和你的生活条件来判断。' +
      '本次测评全程在本地完成，你的答案没有离开这台设备。</div>');

    h.push('<div class="colophon">' +
      '<span>' + esc(B.meta.title) + ' · ' + esc(B.meta.edition) + '</span>' +
      '<span>生成于 ' + formatDate(result.generatedAt) + '</span>' +
      '</div>');

    h.push('<div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1.5rem">' +
      '<button class="act act--ghost" id="btnAgain" style="margin-top:0">重新测一次</button>' +
      '<button class="act act--ghost" id="btnPrint" style="margin-top:0">打印 / 存为 PDF</button>' +
      '</div>');

    host.innerHTML = h.join('');
  }

  function formatDate(d) {
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  root.TalentRender = {
    renderIndex: renderIndex,
    renderReport: renderReport,
    radarSVG: radarSVG,
    formatDate: formatDate
  };
})(typeof window !== 'undefined' ? window : globalThis);
