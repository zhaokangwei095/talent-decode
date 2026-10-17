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
    B.clusterOrder.forEach(function (key) {
      var c = B.clusters[key];
      var li = el('li', 'index-row');
      li.setAttribute('data-cluster', key);
      var body = el('div');
      body.appendChild(el('h3', null, c.name));
      body.appendChild(el('p', 'cluster-desc', c.desc));
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
    var keyTraits = d.strengths.slice(0, 2);
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
        '<span class="lbl">常见表现</span>' +
        '<ul class="ticks">' + keyTraits.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
        '<div class="more" id="more-' + rank + '" data-open="false">' +
          '<span class="lbl">表现</span>' +
          '<p>' + esc(d.desc) + '。</p>' +
          '<span class="lbl">容易踩的坑</span>' +
          '<ul class="crosses">' + d.traps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
          (d.strengths.length > keyTraits.length
            ? '<span class="lbl">还有一个信号</span><ul class="ticks">' +
              d.strengths.slice(keyTraits.length).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>'
            : '') +
          '<span class="lbl">能发挥它的场景</span>' +
          '<div class="chips">' + d.scenes.map(function (s) { return '<span class="chip">' + esc(s) + '</span>'; }).join('') + '</div>' +
          '<span class="lbl">可以马上试的做法</span>' +
          '<ul class="ticks">' + d.advice.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
          '<p class="more-grow"><b>可以怎么用：</b>' + esc(d.grow) + '。</p>' +
        '</div>' +
        '<button type="button" class="more-btn" aria-expanded="false" aria-controls="more-' + rank + '">展开细节</button>' +
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
  /* 可折叠章节：默认只露标题，点开才看细节。用于把长报告压成一屏可读。 */
  function secFold(title, note, inner, open) {
    var id = 'fold-' + seq;
    var head = secNo(title, note).replace('</div>',
      '<button type="button" class="fold-toggle" aria-expanded="' + (open ? 'true' : 'false') +
        '" aria-controls="' + id + '"><span class="fold-label">' + (open ? '收起' : '展开') +
        '</span><span class="fold-chev" aria-hidden="true"></span></button></div>');
    return '<section class="sec sec--fold' + (open ? ' is-open' : '') + '">' +
      head +
      '<div class="fold-body" id="' + id + '"><div class="fold-inner">' + inner + '</div></div>' +
      '</section>';
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
      h.push('<p class="note-inline">两个大方向只差 ' + result.clusterGap +
        ' 分，不必只记类型名，请看下面的细节。</p>');
    }
    h.push('</section>');

    /* §02 图谱 */
    h.push('<section class="sec">' + secNo('天赋分布图', '12 项 · 满分 100'));
    /* 雷达用固定轴序（见 engine RADAR_ORDER），便于横向比较 */
    h.push('<div class="chart-wrap">' + radarSVG(result.dimsFixed) + '</div>');
    h.push('<p class="chart-note">顺时针：表达联结 → 构想创造 → 分析建构 → 体验感知</p>');
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
    h.push('<ol class="ranks-list">');
    result.dims.forEach(function (d, i) {
      h.push('<li class="rank-row' + (i < 3 ? ' is-top' : '') + '">' +
        '<span class="rank-no">' + (i + 1) + '</span>' +
        '<span class="rank-name">' + esc(d.name) + '</span>' +
        '<span class="rank-track"><i style="width:' + Math.round(d.pct) + '%"></i></span>' +
        '<span class="rank-score">' + Math.round(d.pct) + '</span>' +
        '</li>');
    });
    h.push('</ol></section>');

    /* §04 前四项详解（折叠） */
    var dimsInner = top.map(function (d, i) { return dimBlock(d, i + 1); }).join('');
    dimsInner += '<p class="note-inline">其余 ' + (result.dims.length - 4) +
      ' 项不是缺点，只是这一轮相对不突出，完整数据见上方排序。</p>';
    h.push(secFold('优势详解', '得分最高的四项', dimsInner, false));

    /* 成长空间：取分数最低的三项，给"怎么绕过"而不是"怎么补短板"。
       若最低分也不低，说明这轮没有明显弱项，改说相对次序，不要硬贴"弱"的标签。 */
    var weak = result.dims.slice(-3).slice().reverse();
    var noWeak = weak[0].pct >= 70;
    var weakInner = '<p class="lede">' + (noWeak
      ? '没有明显短板。挑一项和你的强项组合使用，比继续补短更划算。'
      : '不必硬补。提前配工具、找搭子或换路径，比死磕弱项回报更高。') + '</p>';
    weakInner += '<ul class="avoid" style="margin-top:1rem">';
    weak.forEach(function (d) {
      weakInner += '<li><div><b>' + esc(d.name) + ' · ' + Math.round(d.pct) + ' 分</b>' +
        '<span>' + esc(d.grow) + '</span></div>' +
        '<span class="lv">' + esc(noWeak ? '仍有空间' : E.band(d.pct).text) + '</span></li>';
    });
    weakInner += '</ul>';
    weakInner += '<p class="note-inline">' + (noWeak
      ? '没有明显短板，挑一项和强项组合使用。'
      : '知道它会拖后腿就好：提前配工具、找搭子，或换一条路径。') + '</p>';
    h.push(secFold(
      noWeak ? '相对靠后的三项' : '暂时不突出的三项',
      noWeak ? '这轮没有明显短板' : '不必硬补，知道怎么绕',
      weakInner, false));

    /* 工作模式（折叠） */
    var modeInner = '<div class="duo">';
    result.axes.forEach(function (ax) {
      modeInner += '<div class="cell"><h4>' + esc(ax.name) + '<span style="font-weight:400;color:var(--ink-3);font-size:.75rem"> · ' +
        esc(ax.left) + ' ⟷ ' + esc(ax.right) + '</span></h4><p>' + esc(ax.text) + '</p></div>';
    });
    modeInner += '</div>';
    h.push(secFold('你的工作模式', '来自取舍题，不是自评', modeInner, false));

    /* §06 兴趣 */
    h.push('<section class="sec">' + secNo('你愿意做的事', '兴趣 ≠ 能力'));
    h.push('<p class="lede">能力决定做得动什么，兴趣决定能撑多久。</p>');
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
    h.push('<p class="note-inline">星级只看能力结构与岗位要求的重合度，不代表前景或薪资。</p>');
    h.push('</section>');

    /* §08 避坑 */
    if (result.avoid.length) {
      var avoidInner = '<ul class="avoid">';
      result.avoid.forEach(function (a) {
        avoidInner += '<li><div><b>' + esc(a.name) + '</b><span>' + esc(a.note) + '</span></div>' +
          '<span class="lv">' + esc(a.level) + '</span></li>';
      });
      avoidInner += '</ul>';
      avoidInner += '<p class="note-inline">意思是"现在进去会更吃力"，不是"你永远做不了"。</p>';
      h.push(secFold('建议谨慎的方向', result.avoid.length + ' 个方向', avoidInner, false));
    }

    /* §09 验证计划 */
    var planInner = '<ul class="plan">';
    plan.forEach(function (p) {
      planInner += '<li><span class="day">' + esc(p.day) + '</span><span class="what">' + esc(p.what) + '</span></li>';
    });
    planInner += '</ul>';
    planInner += '<p class="note-inline">测试只给出"可能"，让你确定的是这 7 天做出来的东西。</p>';
    h.push(secFold('7 天验证计划', '别只收藏，去做', planInner, false));

    /* 一致性提示 + 免责 */
    if (rel.flat || rel.tight) {
      h.push('<div class="disclaimer"><b>提醒：</b>本轮答案集中在 ' + rel.distinct +
        ' 个选项上，分数差距被压缩，排序参考价值有限。可以隔一天再测一次。</div>');
    }
    h.push('<div class="disclaimer"><b>关于这份报告：</b>基于' + esc(B.meta.basis) +
      '，用来整理线索，不是心理诊断。全程本地计算，答案没有离开这台设备。</div>');

    h.push('<div class="colophon">' +
      '<span>' + esc(B.meta.title) + ' · ' + esc(B.meta.edition) + '</span>' +
      '<span>生成于 ' + formatDate(result.generatedAt) + '</span>' +
      '</div>');

    h.push('<div class="report-actions">' +
      '<button class="act" id="btnAgain">重新测一次</button>' +
      '<button class="act act--ghost" id="btnPrint">打印 / 存为 PDF</button>' +
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
