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

  /* ---------------- 存档 ---------------- */
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ at: state.at, a: state.a, b: state.b, c: state.c, ts: Date.now() }));
    } catch (e) { /* 隐私模式下静默失败 */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || !Array.isArray(p.a) || p.a.length !== B.partA.length) return null;
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
  function renderResumeNote() {
    var saved = load();
    var note = $('resumeNote');
    var done = 0;
    if (saved) {
      done = saved.a.filter(function (v) { return v !== null; }).length +
        saved.b.filter(function (v) { return v !== null; }).length +
        saved.c.filter(function (v) { return v !== null; }).length;
    }
    var btn = $('btnStart');
    if (saved && done > 0 && done < TOTAL_ITEMS) {
      note.hidden = false;
      note.textContent = '上次做到第 ' + (done + 1) + ' 题，进度已保存。点"开始测评"会从这里继续。';
      btn.textContent = '继续上次';
      btn.appendChild(arrowSVG());
    } else {
      note.hidden = true;
      btn.textContent = '开始测评';
      btn.appendChild(arrowSVG());
    }
  }

  function arrowSVG() {
    var wrap = document.createElement('span');
    wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" stroke-linecap="square"/></svg>';
    return wrap.firstChild;
  }

  function start() {
    var saved = load();
    if (saved) {
      var done = saved.a.filter(function (v) { return v !== null; }).length +
        saved.b.filter(function (v) { return v !== null; }).length +
        saved.c.filter(function (v) { return v !== null; }).length;
      if (done > 0 && done < TOTAL_ITEMS) {
        state.at = saved.at;
        state.a = saved.a; state.b = saved.b; state.c = saved.c;
      }
    }
    show('screen-quiz');
    renderStep();
  }

  /* ---------------- 事件绑定 ---------------- */
  $('btnStart').addEventListener('click', start);
  $('btnStart2').addEventListener('click', start);

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
