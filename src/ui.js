/* くるくる ずけい ―― 画面（ui.js・古い Safari で動く書き方だけ） */
(function (global) {
  'use strict';
  var KZ = global.KZ, doc = global.document;
  var S = KZ.loadState();          /* きろく */
  var G = null;                    /* いま あそんでいる 1まわり */
  var screen = 'home';
  var animTimer = null;

  function el(id) { return doc.getElementById(id); }
  function setText(node, text) { if (node) { node.textContent = text; } }
  function show(id) {
    var ids = ['scr-home', 'scr-play', 'scr-result', 'scr-zukan', 'scr-grown'], i;
    for (i = 0; i < ids.length; i++) { el(ids[i]).style.display = (ids[i] === 'scr-' + id) ? 'block' : 'none'; }
    screen = id;
    if (id !== 'play') { stopTimer(); }
    if (id === 'home') { checkUpdate(); reloadIfIdle(); }
    global.scrollTo(0, 0);
  }
  function on(id, fn) { var n = el(id); if (n) { n.addEventListener('click', fn, false); } }

  /* ================= はじめの がめん ================= */
  function renderHome() {
    var who = S.name ? S.name + ' の' : '', stage = KZ.stageOf(S.cLeaves), pic = KZ.ZUKAN[S.cIndex % KZ.ZUKAN.length];
    var next = KZ.nextRankAt(S.total), need = KZ.GROW[3] - S.cLeaves;
    setText(el('home-rank'), who + ' かんむり：' + KZ.rankOf(S.total));
    setText(el('home-leaves'), 'はっぱ ' + S.total + 'まい' + (next !== null ? '（つぎの かんむりまで あと ' + (next - S.total) + 'まい）' : '（いちばん うえ！）'));
    setText(el('home-stage'), KZ.STAGE_NAME[stage] + (stage === 3 ? '' : '（せいちゅうまで あと ' + need + 'まい）'));
    setText(el('home-creature'), stage >= 2 ? pic.name + ' に なるかな？' : 'なにに なるかな？');
    KZ.paintStage(el('home-egg'), stage, pic.id);
    setText(el('home-zukan-count'), 'ずかん ' + S.zukan.length + 'ひき');
    setText(el('lv-sug-1'), S.lv[1].rounds ? S.lv[1].ok + '／' + S.lv[1].q + ' せいかい' : '');
    setText(el('lv-sug-2'), S.lv[2].rounds ? S.lv[2].ok + '／' + S.lv[2].q + ' せいかい' : '');
    setText(el('lv-sug-3'), S.lv[3].rounds ? S.lv[3].ok + '／' + S.lv[3].q + ' せいかい' : '');
  }

  /* ================= あそぶ ================= */
  function startRound(level) {
    var i, qs = [];
    for (i = 0; i < S.perRound; i++) { qs.push(KZ.makeQuestion(level)); }
    G = { level: level, qs: qs, idx: 0, ok: 0, firstOk: 0, leaves: 0, tries: 0, done: false, events: [] };
    S.lastLevel = level; KZ.saveState(S);
    show('play');
    renderQuestion();
  }

  function renderQuestion() {
    var q = G.qs[G.idx], box = el('choices'), i, c, wrap, lab, isCount = q.type === 'count';
    G.tries = 0; G.done = false;
    stopAnim();
    setText(el('play-level'), KZ.LEVELS[G.level].name);
    setText(el('play-no'), (G.idx + 1) + ' ／ ' + G.qs.length + ' もんめ');
    setText(el('q-text'), KZ.questionText(q));
    el('q-arrow').innerHTML = isCount ? '' : repeatArrow(q.dir, q.times, 56);
    el('q-arrow').style.display = isCount ? 'none' : 'block';
    /* もとの かたち */
    el('q-before').style.display = 'block';
    KZ.paintCanvas(el('q-before'), q.type === 'count' ? q.before : { base: q.base, mirror: 0, rot: 0 }, 0);
    el('q-after-wrap').style.display = isCount ? 'block' : 'none';
    if (isCount) { KZ.paintCanvas(el('q-after'), q.after, 0); }
    setText(el('q-mark-note'), q.type === 'toka' ? '●が ついている えを よく みてね' : (q.type === 'card' ? 'えの ばしょと むきを ぜんぶ みてね' : ''));
    setText(el('q-count'), '');
    /* えらぶ */
    box.innerHTML = '';
    for (i = 0; i < q.choices.length; i++) {
      wrap = doc.createElement('div'); wrap.className = 'choice'; wrap.setAttribute('data-i', String(i));
      if (isCount) {
        wrap.className += ' choice-count';
        wrap.innerHTML = '<div class="cnum">' + q.choices[i] + 'かい</div><div class="carw">' + repeatArrow('migi', q.choices[i], 40) + '</div>';
      } else {
        c = doc.createElement('canvas'); c.className = 'cv';
        wrap.appendChild(c);
      }
      lab = doc.createElement('div'); lab.className = 'mark'; lab.textContent = '';
      wrap.appendChild(lab);
      box.appendChild(wrap);
    }
    if (!isCount) { paintChoices(); }
    setText(el('msg'), 'どれかな？ タップしてね');
    el('msg').className = 'msg';
    el('next-btn').style.display = 'none';
    el('hint-btn').style.display = (q.type === 'count') ? 'none' : 'inline-block';
    startTimer(KZ.timeFor(q));
  }

  /* ================= 制限時間（へっていく ぼう・ちえの もり と おなじ しくみ）================= */
  var TM = { on: true, total: 0, left: 0, timer: null };
  function stopTimer() { if (TM.timer) { global.clearInterval(TM.timer); TM.timer = null; } }
  function paintTimer() {
    var r = TM.total > 0 ? TM.left / TM.total : 0;
    el('tbar-fill').style.width = Math.max(0, Math.min(100, r * 100)) + '%';
    setText(el('tbar-txt'), (r <= 0.25 ? '！ ' : '') + 'のこり ' + Math.ceil(TM.left) + ' びょう');
    el('tbar').className = 'tbar' + (r <= 0.25 ? ' low' : (r <= 0.5 ? ' mid' : ''));
  }
  function startTimer(sec) {
    stopTimer();
    el('tbarw').style.display = TM.on ? 'block' : 'none';
    if (!TM.on) { return; }
    TM.total = sec; TM.left = sec; paintTimer();
    TM.timer = global.setInterval(function () {
      TM.left -= 0.25;
      if (TM.left <= 0) { TM.left = 0; paintTimer(); stopTimer(); onTimeout(); return; }
      paintTimer();
    }, 250);
  }
  /* じかんぎれ＝まちがい 1回と おなじ あつかい（1回目＝ヒントの うごき＋ぼうが もどる／2回目＝こたえ）。ばつは ない */
  function onTimeout() {
    var q;
    if (!G || G.done || screen !== 'play') { return; }
    q = G.qs[G.idx];
    G.tries++;
    if (G.tries === 1) {
      KZ.snd.play('oshii');
      if (q.type !== 'count') { onHint(); }
      setText(el('msg'), 'じかんだよ！ もういちど えらんでみよう');
      el('msg').className = 'msg warn';
      el('hint-btn').style.display = 'none';
      startTimer(KZ.timeFor(q));
    } else {
      revealAnswer(q, 'じかんだよ。');
    }
  }
  /* こたえを 出して、まわる ようすを 見せる（2回 まちがえた とき・2回目の じかんぎれ） */
  function revealAnswer(q, head) {
    var nodes = choiceNodes();
    G.done = true; stopTimer();
    KZ.snd.play('kotae');
    nodes[q.answerIndex].className += ' right';
    setText(nodes[q.answerIndex].getElementsByClassName('mark')[0], '✓ こたえ');
    setText(el('msg'), head + 'こたえは これ。まわる ようすを みてね');
    el('msg').className = 'msg warn';
    el('hint-btn').style.display = 'none';
    playTurnAnim(q, function () { el('next-btn').style.display = 'inline-block'; }, 800);
  }

  function paintChoices() {
    var q = G.qs[G.idx], nodes = el('choices').getElementsByTagName('canvas'), i;
    for (i = 0; i < nodes.length; i++) { KZ.paintCanvas(nodes[i], q.choices[i], 0); }
  }

  function repeatArrow(dir, times, size) {
    var s = '', i;
    for (i = 0; i < times; i++) { s += KZ.arrowSvg(dir, size || 44); }
    return s;
  }

  function choiceNodes() { return el('choices').getElementsByClassName('choice'); }

  function onChoice(i) {
    var q = G.qs[G.idx], nodes = choiceNodes(), node = nodes[i], leaves = 0;
    if (G.done) { return; }
    if (i === q.answerIndex) {
      G.done = true; stopTimer();
      node.className += ' right';
      setText(node.getElementsByClassName('mark')[0], '✓ せいかい');
      leaves = (G.tries === 0) ? 2 : 1;
      KZ.snd.play(G.tries === 0 ? 'ok' : 'ok2');
      G.ok++; if (G.tries === 0) { G.firstOk++; }
      G.leaves += leaves;
      setText(el('msg'), (G.tries === 0 ? 'せいかい！ はっぱ 2まい' : 'せいかい！ はっぱ 1まい'));
      el('msg').className = 'msg good';
      playTurnAnim(q, function () { el('next-btn').style.display = 'inline-block'; }, 650);
    } else {
      G.tries++;
      node.className += ' wrong';
      setText(node.getElementsByClassName('mark')[0], '！ ちがう');
      if (G.tries === 1) {
        KZ.snd.play('oshii');
        setText(el('msg'), 'おしい！ もういちど えらんでみよう');
        el('msg').className = 'msg warn';
      } else {
        revealAnswer(q, '');
      }
    }
    el('hint-btn').style.display = 'none';
  }

  /* もとの かたちを 実際に まわして 見せる（紙を まわす 練習の かわり）。
     1回ぶん（90度）まわして 止まり、「1かい」と数えてから つぎの 1回へ＝「3かい まわる」の イメージを つける */
  var TURN_MS = 650, PAUSE_MS = 550;
  function playTurnAnim(q, done, delay) {
    var canvas = el('q-before'), view, sign, total, start = null, n = 0, cnt = el('q-count');
    if (q.type === 'count') { view = q.before; sign = 1; total = q.times; }
    else { view = { base: q.base, mirror: 0, rot: 0 }; sign = (q.dir === 'migi') ? 1 : -1; total = q.times; }
    stopAnim();
    setText(cnt, '');
    function step(ts) {
      var t, ang;
      if (start === null) { start = ts; KZ.snd.sweep(TURN_MS / 1000); }
      t = Math.min(1, (ts - start) / TURN_MS);
      ang = sign * (n + easeInOut(t)) * (Math.PI / 2);
      KZ.paintCanvas(canvas, view, ang);
      if (t < 1) { animTimer = requestFrame(step); return; }
      n++;
      setText(cnt, n + 'かい' + (n === total ? '！' : ''));
      KZ.snd.play(n === total ? 'last' : 'count' + Math.min(3, n));
      if (n < total) {
        animTimer = global.setTimeout(function () { start = null; animTimer = requestFrame(step); }, PAUSE_MS);
      } else {
        animTimer = null; if (done) { done(); }
      }
    }
    /* せいかいの おとが おわってから まわしはじめる */
    if (delay) { animTimer = global.setTimeout(function () { animTimer = requestFrame(step); }, delay); }
    else { animTimer = requestFrame(step); }
  }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function requestFrame(fn) {
    if (global.requestAnimationFrame) { return global.requestAnimationFrame(fn); }
    return global.setTimeout(function () { fn((new Date()).getTime()); }, 16);
  }
  function stopAnim() {
    if (animTimer === null) { return; }
    if (global.cancelAnimationFrame) { global.cancelAnimationFrame(animTimer); }
    global.clearTimeout(animTimer);
    animTimer = null;
  }

  /* ヒント＝もとの かたちを ゆっくり まわして、すぐ もどす（答えは 見せきらない） */
  function onHint() {
    var q = G.qs[G.idx], canvas = el('q-before'), view, sign, start = null, dur = 1400;
    if (G.done || q.type === 'count') { return; }
    view = { base: q.base, mirror: 0, rot: 0 }; sign = (q.dir === 'migi') ? 1 : -1;
    stopAnim();
    KZ.snd.sweep(0.7);
    function step(ts) {
      var t, ang;
      if (start === null) { start = ts; }
      t = Math.min(1, (ts - start) / dur);
      /* 半分までは まわして、のこりで もどす。いちばん まわった ときで 60度 */
      ang = sign * (Math.PI / 3) * Math.sin(Math.PI * t);
      KZ.paintCanvas(canvas, view, ang);
      if (t < 1) { animTimer = requestFrame(step); } else { animTimer = null; KZ.paintCanvas(canvas, view, 0); }
    }
    animTimer = requestFrame(step);
    setText(el('msg'), 'こっちに まわるよ。●や しるしが どこへ いくか みてね');
    el('msg').className = 'msg';
  }

  function onNext() {
    G.idx++;
    if (G.idx >= G.qs.length) { finishRound(); return; }
    renderQuestion();
  }

  function finishRound() {
    var stat = S.lv[G.level], events, i, lines = [], stars = '', adultId = null;
    stat.rounds++; stat.q += G.qs.length; stat.ok += G.ok;
    events = KZ.addLeaves(S, G.leaves);
    KZ.saveState(S);
    for (i = 0; i < G.qs.length; i++) { stars += (i < G.firstOk) ? '★' : (i < G.ok ? '☆' : '・'); }
    setText(el('res-title'), G.ok === G.qs.length ? 'ぜんぶ せいかい！' : 'おつかれさま！');
    setText(el('res-score'), G.qs.length + 'もんちゅう ' + G.ok + 'もん せいかい');
    setText(el('res-stars'), stars);
    setText(el('res-leaves'), 'はっぱ ＋' + G.leaves + 'まい（ぜんぶで ' + S.total + 'まい）');
    for (i = 0; i < events.length; i++) {
      if (events[i].kind === 'stage') { lines.push(KZ.STAGE_NAME[events[i].stage] + ' に なった！'); }
      if (events[i].kind === 'adult') { adultId = events[i].id; lines.push(KZ.picById(events[i].id).name + ' が うまれた！ ずかんに はいったよ'); }
      if (events[i].kind === 'lap') { lines.push('ぜんぶの いきものが そろった！ ' + events[i].lap + 'しゅうめ'); }
    }
    /* もりあがる おと＝ぜんぶ せいかいは ながい ファンファーレ。そだったら キラキラを つづけて */
    KZ.snd.play(G.ok === G.qs.length ? 'perfect' : 'round');
    if (lines.length > 0) { KZ.snd.play('grow', G.ok === G.qs.length ? 1.5 : 1.1); }
    if (lines.length === 0) { lines.push(KZ.STAGE_NAME[KZ.stageOf(S.cLeaves)] + ' が そだっているよ（せいちゅうまで あと ' + (KZ.GROW[3] - S.cLeaves) + 'まい）'); }
    setText(el('res-events'), lines.join(' ／ '));
    lastRes = adultId ? { stage: 3, id: adultId } : { stage: KZ.stageOf(S.cLeaves), id: KZ.ZUKAN[S.cIndex % KZ.ZUKAN.length].id };
    KZ.paintStage(el('res-egg'), lastRes.stage, lastRes.id);
    /* つぎの レベルの おすすめ（4／5 以上 で ひとつ 上を すすめる） */
    if (G.level < 3 && G.firstOk >= Math.ceil(G.qs.length * 0.8)) {
      el('res-up').style.display = 'inline-block';
      setText(el('res-up'), 'つぎは「' + KZ.LEVELS[G.level + 1].name + '」に チャレンジ');
    } else { el('res-up').style.display = 'none'; }
    show('result');
  }

  /* ================= ずかん ================= */
  /* ずかん＝1ページ 10ぴき（よこおき 1画面に おさめる）。まえ・つぎ で めくる */
  var Z = { page: 0, per: 10, all: false };   /* all＝おとなのひと の「ぜんぶ みる」（きろくは 変えない） */
  function renderZukan() {
    var box = el('zukan-list'), i, pic, card, c, got, cv, pages = Math.ceil(KZ.ZUKAN.length / Z.per), from, to;
    if (Z.page < 0) { Z.page = 0; }
    if (Z.page > pages - 1) { Z.page = pages - 1; }
    from = Z.page * Z.per; to = Math.min(KZ.ZUKAN.length, from + Z.per);
    box.innerHTML = '';
    for (i = from; i < to; i++) {
      pic = KZ.ZUKAN[i];
      got = 0; for (c = 0; c < S.zukan.length; c++) { if (S.zukan[c] === pic.id) { got++; } }
      if (Z.all && !got) { got = 1; }
      card =doc.createElement('div'); card.className = 'zcard' + (got ? '' : ' none');
      cv = doc.createElement('canvas'); cv.className = 'zcv'; card.appendChild(cv);
      card.appendChild(doc.createElement('div')).textContent = got ? pic.name + (got > 1 ? ' ×' + got : '') : '？？？';
      box.appendChild(card);
      if (got) { KZ.paintStage(cv, 3, pic.id); } else { KZ.paintStage(cv, 0, pic.id); }
    }
    for (i = 0, got = 0; i < KZ.ZUKAN.length; i++) { if (S.zukan.indexOf(KZ.ZUKAN[i].id) >= 0) { got++; } }
    setText(el('zukan-page'), (Z.page + 1) + ' ／ ' + pages + ' ページ（' + (Z.all ? 'ぜんぶ みる' : got + '／' + KZ.ZUKAN.length + ' しゅるい') + '）');
    el('zukan-prev').style.visibility = Z.page > 0 ? 'visible' : 'hidden';
    el('zukan-next').style.visibility = Z.page < pages - 1 ? 'visible' : 'hidden';
  }
  /* 1画面の検査（tools/fit_check.html）が ずかんを ぜんぶ そろえた姿を 測るための 入口（きろくは 書きかえない） */
  KZ.uiState = function () { return S; };
  /* 制限時間の 検査（tools/timer_check.html）の 入口 */
  KZ.uiTimer = function () { return TM; };
  KZ.uiRound = function () { return G; };
  KZ.uiTimeout = function () { onTimeout(); };
  KZ.uiPaintTimer = function (left) { TM.left = left; paintTimer(); };
  /* 絵が 読めたら、いま 見えている 画面を 描き直す */
  var lastRes = null;
  KZ.onImgReady = function () {
    if (screen === 'zukan') { renderZukan(); }
    else if (screen === 'result' && lastRes) { KZ.paintStage(el('res-egg'), lastRes.stage, lastRes.id); }
  };

  /* ================= おとなのひと ================= */
  function renderGrown() {
    var t = el('grown-table'), i, rows = '';
    el('grown-name').value = S.name || '';
    el('grown-per').value = String(S.perRound);
    el('grown-snd').value = (S.sound === false) ? 'off' : 'on';
    for (i = 1; i <= 3; i++) {
      rows += '<tr><td>' + KZ.LEVELS[i].name + '</td><td>' + S.lv[i].rounds + '</td><td>' + S.lv[i].q + '</td><td>' + S.lv[i].ok + '</td></tr>';
    }
    t.innerHTML = '<tr><th>レベル</th><th>まわり</th><th>もんだい</th><th>せいかい</th></tr>' + rows;
    setText(el('grown-ver'), 'はんすう ' + KZ.APP_VERSION + '・はっぱ ' + S.total + '・ずかん ' + S.zukan.length);
    el('reset-2').style.display = 'none';
  }
  var holdTimer = null;
  function holdStart() { holdTimer = global.setTimeout(function () { holdTimer = null; renderGrown(); show('grown'); }, 1200); }
  function holdEnd() { if (holdTimer) { global.clearTimeout(holdTimer); holdTimer = null; } }

  /* ================= 版の 取りなおし（おかえりクエスト・オセロと同型） ================= */
  var UPD_KEY = 'kurukuru_upd';
  function tidyUrl() {
    if (!global.history || !global.history.replaceState) { return; }
    if (global.location.search.indexOf('v=') < 0) { return; }
    try { global.history.replaceState(null, '', global.location.pathname); } catch (e) { /* 見ためだけ */ }
  }
  function checkUpdate() {
    var x;
    if (!global.XMLHttpRequest) { return; }
    try { x = new global.XMLHttpRequest(); } catch (e) { return; }
    try { x.open('GET', 'version.txt?t=' + (new Date()).getTime(), true); } catch (e2) { return; }
    x.onreadystatechange = function () {
      var v, now, last = null, part;
      if (x.readyState !== 4 || x.status !== 200) { return; }
      v = parseInt(String(x.responseText).replace(/[^0-9]/g, ''), 10);
      now = (new Date()).getTime();
      if (!(v > KZ.APP_VERSION)) { return; }
      try { last = global.sessionStorage.getItem(UPD_KEY); } catch (e3) { /* 無くても進む */ }
      if (last) { part = String(last).split(':'); if (part[0] === String(v) && (now - parseInt(part[1], 10)) < 30000) { return; } }
      if (screen !== 'home') { return; }
      try { global.sessionStorage.setItem(UPD_KEY, v + ':' + now); } catch (e4) { /* 無くても進む */ }
      global.location.replace('./?v=' + v);
    };
    try { x.send(null); } catch (e5) { /* 通信できなくても あそべる */ }
  }
  var cacheReady = false;
  function reloadIfIdle() {
    if (!cacheReady || screen !== 'home') { return; }
    cacheReady = false; global.location.reload();
  }
  function watchCache() {
    var ac = global.applicationCache;
    if (!ac || !ac.addEventListener) { return; }
    ac.addEventListener('updateready', function () {
      try { ac.swapCache(); } catch (e) { /* つぎに ひらいたときに 入れかわる */ }
      cacheReady = true; reloadIfIdle();
    }, false);
  }

  /* ================= 押したときの 受けとり ================= */
  function init() {
    var i;
    on('lv-1', function () { startRound(1); });
    on('lv-2', function () { startRound(2); });
    on('lv-3', function () { startRound(3); });
    on('zukan-btn', function () { Z.page = 0; Z.all = false; renderZukan(); show('zukan'); });
    on('zukan-prev', function () { Z.page--; renderZukan(); });
    on('zukan-next', function () { Z.page++; renderZukan(); });
    on('grown-zukan-all', function () { Z.page = 0; Z.all = true; renderZukan(); show('zukan'); });   /* おとなのひと＝絵の見え方を 確かめる（きろくは 変えない） */
    KZ.preloadZukan();
    on('zukan-back', function () { Z.all = false; renderHome(); show('home'); });
    on('play-back', function () { stopAnim(); renderHome(); show('home'); });
    on('next-btn', onNext);
    on('hint-btn', onHint);
    on('res-again', function () { startRound(G.level); });
    on('res-up', function () { startRound(Math.min(3, G.level + 1)); });
    on('res-home', function () { renderHome(); show('home'); });
    el('choices').addEventListener('click', function (ev) {
      var t = ev.target, n = 0;
      while (t && n < 5) {
        if (t.getAttribute && t.getAttribute('data-i') !== null) { onChoice(parseInt(t.getAttribute('data-i'), 10)); return; }
        t = t.parentNode; n++;
      }
    }, false);
    /* おとなのひと＝ながおし */
    var gb = el('grown-btn');
    gb.addEventListener('touchstart', function (ev) { ev.preventDefault(); holdStart(); }, false);
    gb.addEventListener('touchend', holdEnd, false);
    gb.addEventListener('touchcancel', holdEnd, false);
    gb.addEventListener('mousedown', holdStart, false);
    gb.addEventListener('mouseup', holdEnd, false);
    gb.addEventListener('mouseleave', holdEnd, false);
    on('grown-back', function () { renderHome(); show('home'); });
    on('grown-save', function () {
      S.name = String(el('grown-name').value || '').slice(0, 8);
      S.perRound = parseInt(el('grown-per').value, 10) === 10 ? 10 : 5;
      S.sound = el('grown-snd').value !== 'off';
      KZ.snd.on = S.sound;
      if (!S.sound && KZ.snd.keep) { try { KZ.snd.keep.pause(); } catch (ep) { /* つぎの タッチで もどる */ } }
      KZ.saveState(S); renderHome(); show('home');
    });
    on('reset-1', function () { el('reset-2').style.display = 'inline-block'; });
    on('reset-2', function () {
      var keep = { name: S.name, perRound: S.perRound, sound: S.sound };
      S = KZ.freshState(); S.name = keep.name; S.perRound = keep.perRound; S.sound = keep.sound;
      KZ.saveState(S); renderGrown(); setText(el('grown-ver'), 'きろくを けしました');
    });
    global.addEventListener('resize', function () {
      if (screen === 'play' && G) { paintChoices(); KZ.paintCanvas(el('q-before'), G.qs[G.idx].type === 'count' ? G.qs[G.idx].before : { base: G.qs[G.idx].base, mirror: 0, rot: 0 }, 0); if (G.qs[G.idx].type === 'count') { KZ.paintCanvas(el('q-after'), G.qs[G.idx].after, 0); } }
      if (screen === 'home') { renderHome(); }
    }, false);
    /* おとのためし（おとなのひと）＝みじかい 音を 鳴らし、そのときの 状態を 画面に 出す（写し元＝こころの じゅんび grown-snd-test）。
       resume は あとから 効くので、少し 待って もう一度 状態を 書く */
    on('grown-snd-test', function () {
      var was = KZ.snd.on, r;
      KZ.snd.on = true; KZ.snd.unlock();
      r = KZ.snd.play('ok');
      KZ.snd.on = was;
      setText(el('grown-snd-res'), (r ? 'ならしました' : 'おとが つくれません') + '（' + KZ.snd.status() + '）');
      global.setTimeout(function () {
        setText(el('grown-snd-res'), (r ? 'ならしました' : 'おとが つくれません') + '（' + KZ.snd.status() + '）');
      }, 600);
    });
    /* 画面が かくれたら むおんの ループを 止める（つぎの タッチで また ながす） */
    doc.addEventListener('visibilitychange', function () { if (doc.hidden && KZ.snd.keep) { try { KZ.snd.keep.pause(); } catch (ev) { /* つぎの タッチで もどる */ } } }, false);
    /* 押した 手ごたえ（へこんで 戻る）と ピンチの 拡大止め */
    KZ.pressFeel(doc);
    /* おと＝さいしょの タッチで おこす。ボタンを おしたら「ぽっ」 */
    KZ.snd.on = (S.sound !== false);
    doc.addEventListener('touchend', function () { KZ.snd.unlock(); }, false);
    doc.addEventListener('click', function (ev) {
      KZ.snd.unlock();
      if (ev.target && ev.target.tagName === 'BUTTON') { KZ.snd.play('tap'); }
    }, false);
    tidyUrl();
    watchCache();
    renderHome();
    show('home');
    for (i = 0; i < 1; i++) { /* 何もしない（lint 用の空ループを避けるための形） */ }
  }

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init, false); } else { init(); }
})(window);
