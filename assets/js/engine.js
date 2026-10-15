/* =========================================================================
 * 天赋解码 · 评分引擎
 * 纯函数，不触碰 DOM。可在 Node 下直接 require 做回归测试。
 * ========================================================================= */
(function (root) {
  'use strict';

  var B = root.TALENT_BANK;
  if (!B && typeof require === 'function') {
    require('../../data/talent-data.js');
    require('../../data/talent-data-extra.js');
    B = root.TALENT_BANK;
  }

  /* ---------- 量表换算 ---------- */

  /** 频率题：1..5 求均值后拉满到 0-100 */
  function freqPct(values) {
    if (!values.length) return 0;
    var sum = values.reduce(function (a, b) { return a + b; }, 0);
    return ((sum / values.length) - 1) / 4 * 100;
  }

  /** 偏好轴：每题 -2..+2，合计后回到 -100..100 */
  function axisValue(values) {
    var sum = values.reduce(function (a, b) { return a + b; }, 0);
    var max = values.length * 2;
    return max ? sum / max * 100 : 0;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; }

  /* 雷达图的固定轴序：按四大集群各占 3 格排列。
     不按得分排序，否则每个人的图形都是"前大后小"，看不出分布差异。 */
  var RADAR_ORDER = [
    'lang', 'self', 'people',      // 表达联结
    'space', 'create', 'aesthetic', // 构想创造
    'logic', 'learn', 'execute',   // 分析建构
    'body', 'music', 'nature'      // 体验感知
  ];

  /* ---------- 主计分 ---------- */
  /**
   * @param {Object} raw { a: number[36] 0-4, b: number[8] 0-4, c: number[18] 0-4 }
   */
  function score(raw) {
    var dimScores = {}, byDim = {};
    B.dims.forEach(function (d) { byDim[d.id] = []; });

    B.partA.forEach(function (item, i) {
      var v = raw.a && raw.a[i];
      if (typeof v === 'number') byDim[item.dim].push(v + 1);
    });

    var dimList = B.dims.map(function (d) {
      var pct = freqPct(byDim[d.id]);
      dimScores[d.id] = pct;
      return {
        id: d.id, name: d.name, short: d.short, glyph: d.glyph,
        cluster: d.cluster, desc: d.desc, slogan: d.slogan,
        strengths: d.strengths, traps: d.traps, scenes: d.scenes,
        advice: d.advice, grow: d.grow,
        pct: round(pct, 1),
        score: round(pct / 4, 1)          // 0-25，与职业需求同一把尺
      };
    }).sort(function (x, y) { return y.pct - x.pct; });

    /* 集群得分 = 旗下维度均值 */
    var clusterScores = {};
    B.clusterOrder.forEach(function (key) {
      var members = dimList.filter(function (d) { return d.cluster === key; });
      var avg = members.reduce(function (acc, d) { return acc + d.pct; }, 0) / members.length;
      clusterScores[key] = round(avg, 1);
    });

    var clusterRank = B.clusterOrder.slice().sort(function (x, y) {
      return clusterScores[y] - clusterScores[x];
    });
    var gap = clusterScores[clusterRank[0]] - clusterScores[clusterRank[1]];
    var second = gap >= 20 ? clusterRank[0] : clusterRank[1];
    var typeKey = clusterRank[0] + '+' + second;
    /* 类型表只登记了部分顺序，反向顺序复用同一段文案 */
    var reverseKey = second + '+' + clusterRank[0];
    var type = B.types[typeKey] || B.types[reverseKey] || B.typeFallback;
    var isBlend = gap < 6;

    /* ---------- 兴趣 ---------- */
    var byFam = {};
    B.interestFamies.forEach(function (f) { byFam[f.id] = []; });
    B.partC.forEach(function (item, i) {
      var v = raw.c && raw.c[i];
      if (typeof v === 'number') byFam[item.fam].push(v + 1);
    });
    var interests = B.interestFamies.map(function (f) {
      return {
        id: f.id, name: f.name, desc: f.desc,
        pct: round(freqPct(byFam[f.id] || []), 1)
      };
    }).sort(function (x, y) { return y.pct - x.pct; });

    /* ---------- 偏好轴 ---------- */
    var axisRaw = {};
    B.axes.forEach(function (ax) { axisRaw[ax.id] = []; });
    B.partB.forEach(function (item, i) {
      var v = raw.b && raw.b[i];
      if (typeof v === 'number') axisRaw[item.axis].push(v - 2);
    });
    var axes = B.axes.map(function (ax) {
      var val = round(axisValue(axisRaw[ax.id] || []), 1);
      var lean = val <= -34 ? 'left' : (val >= 34 ? 'right' : 'mid');
      var reading = B.axisReading[ax.id][lean];
      return {
        id: ax.id, left: ax.left, right: ax.right, desc: ax.desc,
        value: val, lean: lean, name: reading.name, text: reading.text,
        position: round((val + 100) / 2, 1)     // 0-100，用于渲染指针位置
      };
    });

    /* ---------- 职业匹配 ---------- */
    var interestTop = interests.slice(0, 2).map(function (f) { return f.id; });
    var careers = B.careers.map(function (c) {
      var needSum = 0, earned = 0;
      var gaps = [];
      Object.keys(c.need).forEach(function (dim) {
        var need = c.need[dim];
        var actual = dimScores[dim] != null ? dimScores[dim] / 4 : 0;   // 0-25
        needSum += need;
        earned += need * clamp(actual / need, 0, 1);
        gaps.push({ dim: dim, gap: round(need - actual, 1) });
      });
      var fit = needSum ? earned / needSum * 100 : 0;
      if (interestTop.indexOf(c.fam) > -1) fit += 6;                    // 兴趣同向加成
      gaps.sort(function (x, y) { return y.gap - x.gap; });
      var worst = gaps[0];
      var worstName = '';
      B.dims.forEach(function (d) { if (d.id === worst.dim) worstName = d.name; });
      /* worst 单位是 0-25 的同一把尺：need 为岗位要求，have 为本人实际 */
      var worstNeed = c.need[worst.dim];
      var worstHave = dimScores[worst.dim] != null ? dimScores[worst.dim] / 4 : 0;
      return {
        name: c.name, fit: round(clamp(fit, 0, 100), 1),
        fam: c.fam, cluster: c.cluster, fitText: c.fit,
        risk: c.risk, start: c.start,
        gapDim: worstName, gapValue: worst.gap,
        gapNeed: round(worstNeed, 1), gapHave: round(worstHave, 1),
        /* 该短板在本人身上的绝对水平（0-100），用于判断"偏低"是否成立 */
        gapPct: round(dimScores[worst.dim] || 0, 1)
      };
    }).sort(function (x, y) { return y.fit - x.fit; });

    var matched = careers.slice(0, 6);
    /* 避坑：从"未进入推荐"的方向里挑。
       两个条件同时成立才算：短板明显低于该岗位要求，且这项能力本身确实不突出，
       否则会出现"得分 50 却被说偏低"这种误导。 */
    var matchedNames = matched.map(function (c) { return c.name; });
    var avoid = careers.filter(function (c) {
      return matchedNames.indexOf(c.name) === -1 && c.gapValue > 3 && c.gapPct < 60;
    })
      .sort(function (x, y) { return y.gapValue - x.gapValue; })
      .slice(0, 4)
      .map(function (c) {
        return {
          name: c.name, gapDim: c.gapDim,
          level: c.fit < 45 ? '明显吃力' : '需要补足',
          note: '核心要求是「' + c.gapDim + '」，这项需要 ' + c.gapNeed + '/25，你目前 ' + c.gapHave + '/25'
        };
      });

    /* ---------- 作答一致性 ---------- */
    var aOnly = (raw.a || []).filter(function (v) { return typeof v === 'number'; });
    var distinct = {};
    aOnly.forEach(function (v) { distinct[v] = 1; });
    var distinctCount = Object.keys(distinct).length;
    var variance = 0;
    if (aOnly.length) {
      var mean = aOnly.reduce(function (x, y) { return x + y; }, 0) / aOnly.length;
      variance = aOnly.reduce(function (acc, v) { return acc + Math.pow(v - mean, 2); }, 0) / aOnly.length;
    }
    var answered = aOnly.length + ((raw.b || []).length) + ((raw.c || []).length);
    var reliability = {
      answered: answered,
      distinct: distinctCount,
      variance: round(variance, 2),
      flat: distinctCount <= 2,
      tight: distinctCount === 3,
      complete: answered === B.partA.length + B.partB.length + B.partC.length
    };

    return {
      dims: dimList,
      /* 固定轴序：按集群分组排列，不按分数排。
         这样不同人的雷达图朝向一致，图形本身才有可比性。 */
      dimsFixed: RADAR_ORDER.map(function (id) {
        return dimList.filter(function (x) { return x.id === id; })[0];
      }),
      dimMap: dimScores,
      clusters: clusterScores,
      clusterRank: clusterRank,
      type: type, typeKey: typeKey, isBlend: isBlend, clusterGap: round(gap, 1),
      interests: interests,
      axes: axes,
      careers: matched,
      avoid: avoid,
      reliability: reliability,
      generatedAt: new Date()
    };
  }

  /* ---------- 7 天验证计划 ---------- */
  function buildPlan(result) {
    var top = result.dims[0];
    var t1 = result.careers[0];
    var t2 = result.careers[1];
    return [
      { day: 'Day 1', what: '写下 3 个你真正想试的方向，圈出其中一个。目标不是选对，是先选出一个。' },
      { day: 'Day 2', what: '把「' + top.name + '」拆成 3 个具体动作，找出你这周就能做的最小一件。' },
      { day: 'Day 3-4', what: '找 1 位在「' + t1.name + '」方向做事的人聊 20 分钟，只问两件事：日常做什么、最难受的是什么。' },
      { day: 'Day 5-6', what: '做出一个能给人看的小成果：一篇文章、一张图、一段音频、一次整理都可以，方向对准「' + t2.name + '」。' },
      { day: 'Day 7', what: '回看这 7 天：哪一件事做的时候忘了时间？把那件事记下来，它就是你的下一个线索。' }
    ];
  }

  /* ---------- 分数标签 ---------- */
  function band(pct) {
    if (pct >= 85) return { text: '突出优势', cls: 'hi' };
    if (pct >= 70) return { text: '明显优势', cls: 'hi' };
    if (pct >= 55) return { text: '中等倾向', cls: 'mid' };
    if (pct >= 40) return { text: '暂不突出', cls: 'lo' };
    return { text: '当前较弱', cls: 'lo' };
  }

  function stars(fit) {
    if (fit >= 82) return 5;
    if (fit >= 72) return 4;
    if (fit >= 60) return 3;
    if (fit >= 48) return 2;
    return 1;
  }

  var api = { score: score, buildPlan: buildPlan, band: band, stars: stars, freqPct: freqPct, axisValue: axisValue };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TalentEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
