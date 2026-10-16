/* =========================================================================
 * 天赋解码 · 答题流程
 * 三段式：A 行为表现（36） → B 工作模式取舍（8） → C 兴趣倾向（18）
 * ========================================================================= */
(function () {
  'use strict';

  var B = window.TALENT_BANK;
  var E = window.TalentEngine;
  var R = window.TalentRender;

  var STORE_KEY = 'talent_decode_v1';

  /* 交互阶段：intro 段落过渡 / item 答题 */
  var steps = [];
  (function buildSteps() {
    steps.push({ kind: 'intro', part: 'A' });
    B.partA.forEach(function (it, i) { steps.push({ kind: 'item', part: 'A', idx: i, data: it }); });
    steps.push({ kind: 'intro', part: 'B' });
    B.partB.forEach(function (it, i) { steps.push({ kind: 'item', part: 'B', idx: i, data: it }); });
    steps.push({ kind: 'intro', part: 'C' });
    B.partC.forEach(function (it, i) { steps.push({ kind: 'item', part: 'C', idx: i, data: it }); });
  })();

  var TOTAL_ITEMS = B.partA.length + B.partB.length + B.partC.length;

  var state = {
    at: 0,
    a: new Array(B.partA.length).fill(null),
    b: new Array(B.partB.length).fill(null),
    c: new Array(B.partC.length).fill(null)
  };

  /* 续做标记：只在从封面进入后渲染的第一道题上提示一次 */
  var resumeHintPending = false;

  var PART_META = {
    A: { label: '第一部分 · 行为表现', title: '先看你怎么做事', sub: '接下来的 36 题，描述的是具体行为和场景。请按最近三个月的真实情况回答：这件事多久发生一次。' },
    B: { label: '第二部分 · 工作模式', title: '两个方向，选一边', sub: '这 8 题没有中间选项。如果两边都不完全符合，选你更靠近的那一侧——差距比绝对值更重要。' },
    C: { label: '第三部分 · 兴趣倾向', title: '你愿意把时间花在哪', sub: '这一段不问能力，只问你"会不会想去做"。哪怕现在完全不会，只要心里有想试的冲动，就往右侧选。' }
  };

  var FREQ_MARKS = ['①', '②', '③', '④', '⑤'];

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function answerOf(step) { return state[step.part.toLowerCase()][step.idx]; }
  function setAnswer(step, v) { state[step.part.toLowerCase()][step.idx] = v; }

  function answeredCount() {
    return state.a.filter(function (v) { return v !== null; }).length +
      state.b.filter(function (v) { return v !== null; }).length +
      state.c.filter(function (v) { return v !== null; }).length;
  }

  /* 存档里的已答题数：封面与续做判断都读它，避免和内存态混用。
     逐段取长度，个别段字段缺失（旧存档）时也不会抛错。 */
  function progressOf(p) {
    if (!p) return 0;
    return ['a', 'b', 'c'].reduce(function (sum, k) {
      var arr = Array.isArray(p[k]) ? p[k] : [];
      return sum + arr.filter(function (v) { return v !== null && v !== undefined; }).length;
    }, 0);
  }

  /* ---------------- 存档 ---------------- */
  /* 存不了就得说清楚：嵌在别的站点里时（魔搭创空间就是 iframe），
     浏览器开启"拦截第三方 Cookie"会让 localStorage 直接抛错，
     这时如果还宣称"进度已保存"，用户下次进来看到从第一题开始，只会以为程序坏了。 */
  var STORAGE_OK = (function () {
    try {
      var k = '__talent_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  function save() {
    if (!STORAGE_OK) return false;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ at: state.at, a: state.a, b: state.b, c: state.c, ts: Date.now() }));
      return true;
    } catch (e) { STORAGE_OK = false; return false; }
  }
  function load() {
    if (!STORAGE_OK) return null;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || !Array.isArray(p.a) || p.a.length !== B.partA.length) return null;
      /* 补齐可能缺失的段落（旧存档），避免后面 filter 报错 */
      ['b', 'c'].forEach(function (k) {
        var len = B['part' + k.toUpperCase()].length;
        if (!Array.isArray(p[k]) || p[k].length !== len) p[k] = new Array(len).fill(null);
      });
      return p;
    } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }

  /* ---------------- 屏幕切换 ---------------- */
  function show(id) {
    ['screen-cover', 'screen-quiz', 'screen-report'].forEach(function (s) {
      var n = $(s);
      if (n) n.hidden = (s !== id);
    });
    window.scrollTo(0, 0);
  }

  /* ---------------- 答题渲染 ---------------- */
  function renderStep() {
    var step = steps[state.at];
    var host = $('quizBody');
    var meta = PART_META[step.part];
    $('partLabel').textContent = meta.label;

    /* 进度：以已答题数计，段落页显示该段起点 */
    var done = answeredCount();
    var pct = Math.round(done / TOTAL_ITEMS * 100);
    $('railFill').style.width = pct + '%';
    $('railBar').setAttribute('aria-valuenow', pct);

    /* 续做提示只在"刚进来这一步"出现一次：
       如果每题都挂一遍，用户答第一题时看到"已答 37 / 62"会以为进度串了。 */
    /* 落在段落说明页时先留着标记，等真正到题上再提示并清掉 */
    var showResumeHint = resumeHintPending && step.kind === 'item';
    if (step.kind === 'item') resumeHintPending = false;
    var resumeHintText = '';
    if (showResumeHint) {
      resumeHintText = done >= TOTAL_ITEMS
        ? '已答完 ' + TOTAL_ITEMS + ' 题，之前的选择已保留。确认无误就点"生成报告"。'
        : '已答 ' + done + ' / ' + TOTAL_ITEMS + ' 题，之前的选择已保留。';
    }

    host.innerHTML = '';

    if (step.kind === 'intro') {
      $('qCounter').textContent = '— / ' + TOTAL_ITEMS;
      var box = el('div', 'interlude');
      box.appendChild(el('div', 'num', step.part));
      box.appendChild(el('h2', null, meta.title));
      box.appendChild(el('p', null, meta.sub));
      var go = el('button', 'act', '继续');
      go.style.marginTop = '2rem';
      go.addEventListener('click', function () { state.at++; save(); renderStep(); });
      box.appendChild(go);
      host.appendChild(box);
      return;
    }

    var numInPart = step.idx + 1;
    var numInPartTotal = B['part' + step.part].length;
    var globalNo = (step.part === 'A' ? 0 : step.part === 'B' ? B.partA.length : B.partA.length + B.partB.length) + numInPart;
    $('qCounter').textContent = String(globalNo).padStart(2, '0') + ' / ' + TOTAL_ITEMS;

    var wrap = el('div');
    wrap.appendChild(el('div', 'q-no', '第 ' + (step.part === 'A' ? '1' : step.part === 'B' ? '2' : '3') +
      ' 部分 · 第 ' + numInPart + ' / ' + numInPartTotal + ' 题'));

    wrap.appendChild(el('p', 'q-text', step.data.text));
    if (resumeHintText) wrap.appendChild(el('p', 'q-hint', resumeHintText));

    if (step.part === 'A') {
      wrap.appendChild(el('p', 'q-hint', B.meta.freqHint + '（' + B.meta.freqScale.join(' · ') + '）'));
      var ul = el('ul', 'opts');
      B.meta.freqScale.forEach(function (label, i) {
        var li = el('li');
        var btn = el('button', 'opt');
        btn.type = 'button';
        btn.setAttribute('aria-pressed', String(answerOf(step) === i));
        btn.appendChild(el('span', 'mark', FREQ_MARKS[i]));
        btn.appendChild(el('span', 'label', label));
        btn.addEventListener('click', function () { choose(step, i); });
        li.appendChild(btn);
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
    } else if (step.part === 'C') {
      wrap.appendChild(el('p', 'q-hint', B.interestHint + '（' + B.interestScale.join(' · ') + '）'));
      var ul2 = el('ul', 'opts');
      B.interestScale.forEach(function (label, i) {
        var li = el('li');
        var btn = el('button', 'opt');
        btn.type = 'button';
        btn.setAttribute('aria-pressed', String(answerOf(step) === i));
        btn.appendChild(el('span', 'mark', FREQ_MARKS[i]));
        btn.appendChild(el('span', 'label', label));
        btn.addEventListener('click', function () { choose(step, i); });
        li.appendChild(btn);
        ul2.appendChild(li);
      });
      wrap.appendChild(ul2);
    } else {
      /* B 部分：先 A/B 强制二选一，再给倾向刻度 */
      wrap.appendChild(el('p', 'q-hint', '先选更靠近的一侧，再说明程度。'));
      var fork = el('div', 'fork');
      [['left', 'A'], ['right', 'B']].forEach(function (pair) {
        var side = step.data[pair[0]];
        var btn = el('button', 'side');
        btn.type = 'button';
        btn.appendChild(el('span', 'cap', pair[1]));
        btn.appendChild(el('b', null, side.t));
        btn.appendChild(el('span', null, side.s));
        var isLeft = pair[0] === 'left';
        btn.setAttribute('aria-pressed', String(answerOf(step) !== null &&
          (isLeft ? answerOf(step) <= 1 : answerOf(step) >= 3)));
        btn.addEventListener('click', function () { choose(step, isLeft ? 1 : 3); });
        fork.appendChild(btn);
        if (isLeft) fork.appendChild(el('div', 'vs', '或'));
      });
      wrap.appendChild(fork);

      var between = el('div', 'between');
      B.axisScale.forEach(function (label, i) {
        var btn = el('button', null, label);
        btn.type = 'button';
        btn.setAttribute('aria-pressed', String(answerOf(step) === i));
        btn.addEventListener('click', function () { choose(step, i); });
        between.appendChild(btn);
      });
      wrap.appendChild(between);
    }

    /* 底部导航 */
    var foot = el('div', 'q-foot');
    var back = el('button', 'back', '‹ 上一题');
    back.type = 'button';
    back.disabled = state.at === 0;
    back.addEventListener('click', function () { state.at--; save(); renderStep(); });
    var next = el('button', 'act', state.at === steps.length - 1 ? '生成报告' : '下一题 →');
    next.type = 'button';
    next.disabled = answerOf(step) === null;
    next.id = 'btnNext';
    next.addEventListener('click', function () { advance(); });
    foot.appendChild(back);
    foot.appendChild(next);
    wrap.appendChild(foot);

    host.appendChild(wrap);
  }

  function choose(step, value) {
    setAnswer(step, value);
    save();
    renderStep();
    var btn = $('btnNext');
    if (btn && !btn.disabled) btn.focus();
  }

  function advance() {
    var step = steps[state.at];
    if (answerOf(step) === null) return;
    if (state.at < steps.length - 1) {
      state.at++;
      save();
      renderStep();
    } else {
      finish();
    }
  }

  /* ---------------- 生成报告 ---------------- */
  function finish() {
    show('screen-report');
    $('reportBody').innerHTML = '<div class="working">正在生成报告<span class="dots"><i></i><i></i><i></i></span></div>';
    // 让"生成中"先绘制出来，再做计算
    requestAnimationFrame(function () {
      var result;
      try {
        result = E.score({ a: state.a, b: state.b, c: state.c });
      } catch (err) {
        $('reportBody').innerHTML = '<div class="disclaimer">报告生成失败：' + err.message +
          '。请返回首页重新作答，或刷新页面。</div>';
        return;
      }
      R.renderReport($('reportBody'), result);
      window.scrollTo(0, 0);
      clearSave();
      var again = $('btnAgain');
      if (again) again.addEventListener('click', function () {
        state = { at: 0, a: new Array(B.partA.length).fill(null), b: new Array(B.partB.length).fill(null), c: new Array(B.partC.length).fill(null) };
        clearSave();
        show('screen-cover');
        renderResumeNote();
      });
      var print = $('btnPrint');
      if (print) print.addEventListener('click', function () { window.print(); });
      try { localStorage.setItem(STORE_KEY + '_last', JSON.stringify(result)); } catch (e) {}
    });
  }

  /* ---------------- 存档续做 ---------------- */
  function setStartLabels(text) {
    var top = $('btnStart');
    top.textContent = text;
    top.appendChild(arrowSVG());
    var bottom = $('btnStart2');
    if (bottom) bottom.textContent = text;
  }

  function renderResumeNote() {
    var saved = load();
    var note = $('resumeNote');
    var done = progressOf(saved);
    var reset = $('btnRestart');
    var warn = $('saveWarn');
    if (warn) {
      warn.hidden = STORAGE_OK;
      warn.textContent = STORAGE_OK ? '' :
        '这台设备的浏览器禁止了本页保存数据（常见于开启了"拦截第三方 Cookie"的内嵌预览）。' +
        '可以正常做完并看到报告，但中途关掉页面不会保留进度——建议一次做完，或用页面右上角在新窗口打开。';
    }

    /* 只要有存档就一律给"续做"，包括已答满 62 题但还没生成报告的情况：
       那种状态以前会被当成"没进度"，两个入口都退回第 1 题，等于把 62 题答案丢掉。 */
    if (saved && done > 0) {
      note.hidden = false;
      note.textContent = (done >= TOTAL_ITEMS
        ? '已答完 ' + TOTAL_ITEMS + ' 题，进度已存在本机。两个入口都会带你回到最后一题生成报告；想从头答，请点下方"重新开始"。'
        : '上次答到第 ' + (done + 1) + ' 题（共 ' + TOTAL_ITEMS +
          ' 题），进度已存在本机。两个入口都会从这里继续；想从头答，请点下方"重新开始"。');
      setStartLabels('继续上次');
      if (reset) reset.hidden = false;
    } else {
      note.hidden = true;
      setStartLabels('开始测评');
      if (reset) reset.hidden = true;
    }
  }

  function arrowSVG() {
    var wrap = document.createElement('span');
    wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" stroke-linecap="square"/></svg>';
    return wrap.firstChild;
  }

  function start() {
    var saved = load();
    var done = progressOf(saved);
    if (done > 0) {
      state.a = saved.a; state.b = saved.b; state.c = saved.c;
      if (done >= TOTAL_ITEMS) {
        /* 62 题都答完却没生成报告：回到最后一题，让"生成报告"按钮就在眼前。
           以前这里会因为 done < TOTAL_ITEMS 不成立而整段跳过，代价是 62 个答案全丢。 */
        var last = steps.length - 1;
        while (last > 0 && steps[last].kind !== 'item') last--;
        state.at = last;
      } else {
        state.at = Math.min(Math.max(saved.at | 0, 0), steps.length - 1);
      }
      resumeHintPending = true;
    }
    show('screen-quiz');
    renderStep();
  }

  /* ---------------- 事件绑定 ---------------- */
  $('btnStart').addEventListener('click', start);
  $('btnStart2').addEventListener('click', start);

  var restartBtn = $('btnRestart');
  if (restartBtn) {
    restartBtn.addEventListener('click', function () {
      /* 封面上的内存态是空的，已答题数只能从存档里数，否则会提示"清空 0 题" */
      var saved = load();
      var done = Math.max(progressOf(saved), answeredCount());
      if (!confirm('重新开始会清空已答的 ' + done + ' 题，从第一题重新作答。确定吗？')) return;
      clearSave();
      state = {
        at: 0,
        a: new Array(B.partA.length).fill(null),
        b: new Array(B.partB.length).fill(null),
        c: new Array(B.partC.length).fill(null)
      };
      show('screen-quiz');
      renderStep();
    });
  }

  $('btnQuit').addEventListener('click', function () {
    save();
    show('screen-cover');
    renderResumeNote();
  });

  document.addEventListener('keydown', function (e) {
    if ($('screen-quiz').hidden) return;
    var step = steps[state.at];
    if (step.kind !== 'item') return;
    var n = parseInt(e.key, 10);
    var max = step.part === 'A' || step.part === 'C' ? 4 : 4;
    if (n >= 1 && n <= max + 1) { choose(step, n - 1); return; }
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (answerOf(step) !== null) { e.preventDefault(); advance(); }
    }
    if (e.key === 'ArrowLeft' && state.at > 0) { state.at--; save(); renderStep(); }
  });

  R.renderIndex($('clusterIndex'));

  /* 入场：封面内容分批浮入。
     注意：内容可见性依赖 is-in，所以除了双 rAF 还加一个超时兜底，
     任何异常都不会把首屏留在"透明但占位"的状态。 */
  (function intro() {
    var cover = $('screen-cover');
    var targets = ['.kicker', '#coverTitle', '.sub', '.facts', '#btnStart'];
    var nodes = targets.map(function (s) { return cover.querySelector(s); }).filter(Boolean);
    var secs = cover.querySelectorAll('.sec');
    Array.prototype.forEach.call(secs, function (s) { nodes.push(s); });
    nodes.forEach(function (n, i) {
      n.classList.add('reveal');
      n.style.transitionDelay = Math.min(i * 55, 330) + 'ms';
    });
    function reveal() {
      cover.classList.add('is-in');
      /* 动画结束后清掉延迟，否则会拖慢按钮等元素的 hover 过渡 */
      setTimeout(function () {
        nodes.forEach(function (n) { n.style.transitionDelay = ''; });
      }, 900);
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(reveal);
    });
    setTimeout(reveal, 900);
  })();

  renderResumeNote();
  window.TalentApp = { start: start, state: state };
})();
