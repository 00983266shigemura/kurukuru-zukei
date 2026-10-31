/* くるくる ずけい ―― まわした かたちを あてる あそび（2012年の iPad・iOS 10.3.3 で動く書き方）
   きまり＝
   ・古い Safari で動く書き方だけ（var と function。let/const/アロー/テンプレート文字列は使わない）
   ・絵文字は使わない（この端末の字の在庫は 2016年で止まっている）
   ・赤と緑を「意味の区別」に使わない（色は Okabe-Ito の 青・橙・紫・水色・黄・緑青 から）
   ・端末内保存（localStorage）は try-catch で包み、やり直しの手段を画面に置く
   このファイルは tools/build_app.py が index.html へ埋め込む。直すのは src/ だけ。 */
(function (global) {
  'use strict';

  var KZ = {};
  /* このファイルを直したら この数字を +1 する。version.txt にも同じ数字を書く（build_app.py が照合する） */
  KZ.APP_VERSION = 3;
  KZ.SCHEMA = 1;          /* 端末内保存の形。変えると古い記録は捨てて作り直す */
  KZ.STORE_KEY = 'kurukuru_zukei_v1';

  /* ================= いろ（Okabe-Ito） ================= */
  var COL = {
    ao: '#0072B2', daidai: '#E69F00', murasaki: '#CC79A7', mizu: '#56B4E9',
    ki: '#F0E442', ryokuao: '#009E73', sumi: '#1b1b1b', shiro: '#ffffff',
    usui: '#8a949c', kami: '#fffdf7'
  };
  KZ.COL = COL;

  /* ================= らんすう（試験では たねを 固定できる） ================= */
  var rngState = null;
  function rnd() {
    if (rngState === null) { return Math.random(); }
    /* mulberry32 */
    rngState = (rngState + 0x6D2B79F5) | 0;
    var t = rngState;
    t = Math.imul ? Math.imul(t ^ (t >>> 15), t | 1) : (((t ^ (t >>> 15)) * (t | 1)) | 0);
    t ^= t + (Math.imul ? Math.imul(t ^ (t >>> 7), t | 61) : (((t ^ (t >>> 7)) * (t | 61)) | 0));
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  KZ.seed = function (s) { rngState = (s === null || s === undefined) ? null : (s | 0); };
  function ri(n) { return Math.floor(rnd() * n); }
  function pick(arr) { return arr[ri(arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) { j = ri(i + 1); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  KZ.shuffle = shuffle;

  /* ================= しるし（ますの中の 図形） =================
     period＝回して元に戻るまでの数。mirror＝左右をひっくり返したときの向きの対応。
     左右にひっくり返して 別の種類の しるしに なるものは 入れない（鏡の答えが作れなくなるため）。 */
  var MARKS = {
    maru:    { period: 1, mirror: [0] },
    kuro:    { period: 1, mirror: [0] },
    shikaku: { period: 1, mirror: [0] },
    batsu:   { period: 1, mirror: [0] },
    sankaku: { period: 4, mirror: [0, 3, 2, 1] },   /* 0=うえ 1=みぎ 2=した 3=ひだり */
    hanbun:  { period: 4, mirror: [1, 0, 3, 2] },   /* 0=ひだりうえ が ぬってある 1=みぎうえ 2=みぎした 3=ひだりした */
    sen:     { period: 2, mirror: [0, 1] }          /* 0=よこ 1=たて */
  };
  KZ.MARKS = MARKS;
  var MARK_NAMES = ['maru', 'kuro', 'shikaku', 'batsu', 'sankaku', 'hanbun', 'sen'];
  var ORIENTED = ['sankaku', 'hanbun', 'sen'];

  /* ================= かたち（grid か pic） ================= */
  /* grid＝{kind:'grid', n:2|3, cells:[{r,c,m,o}]}  pic＝{kind:'pic', id:'sakana'} */

  function transformGrid(fig, mirror, rot) {
    var n = fig.n, out = [], i, cell, r, c, o, m, k;
    for (i = 0; i < fig.cells.length; i++) {
      cell = fig.cells[i]; r = cell.r; c = cell.c; o = cell.o; m = cell.m;
      if (mirror) { c = n - 1 - c; o = MARKS[m].mirror[o]; }
      for (k = 0; k < rot; k++) {
        /* みぎに 90度＝(r,c) → (c, n-1-r)。しるしの向きも ひとつ すすむ */
        var nr = c, nc = n - 1 - r;
        r = nr; c = nc;
        o = (o + 1) % MARKS[m].period;
      }
      out.push({ r: r, c: c, m: m, o: o });
    }
    return { kind: 'grid', n: n, cells: out };
  }
  KZ.transformGrid = transformGrid;

  function gridSig(fig) {
    var parts = [], i, cell;
    for (i = 0; i < fig.cells.length; i++) {
      cell = fig.cells[i];
      parts.push(cell.r + ',' + cell.c + ',' + cell.m + ',' + cell.o);
    }
    parts.sort();
    return 'g' + fig.n + ':' + parts.join(';');
  }

  /* view＝{base, mirror:0|1, rot:0..3}＝画面に出す 1枚 */
  function viewSig(view) {
    if (view.base.kind === 'grid') {
      return gridSig(transformGrid(view.base, view.mirror, view.rot));
    }
    if (view.base.kind === 'cardview') {
      return cardSig(view.base);
    }
    return 'p:' + view.base.id + ':' + view.mirror + ':' + view.rot + ':' + (view.twist ? 1 : 0);
  }
  KZ.viewSig = viewSig;

  /* ================= 本番型の カード（問題14-2）＝4つの ますに 線の絵。cells＝[左上, 右上, 左下, 右下] の {id, o} ================= */
  function cardSig(card) {
    var parts = [], i;
    for (i = 0; i < 4; i++) { parts.push(card.cells[i].id + ':' + (card.cells[i].o % symOf(card.cells[i].id))); }
    return 'c:' + parts.join(',');
  }
  KZ.cardSig = cardSig;
  /* カード全体を みぎに 90度 k回 まわす＝ますの位置 左上→右上→右下→左下 と、各絵の向き +1 */
  var CW_POS = [1, 3, 0, 2];
  function rotateCard(card, k) {
    var cells = card.cells.slice(), i, j, next;
    for (j = 0; j < k; j++) {
      next = [null, null, null, null];
      for (i = 0; i < 4; i++) { next[CW_POS[i]] = { id: cells[i].id, o: (cells[i].o + 1) % 4 }; }
      cells = next;
    }
    return { kind: 'cardview', cells: cells };
  }
  KZ.rotateCard = rotateCard;
  function cloneCard(card) {
    var cells = [], i;
    for (i = 0; i < 4; i++) { cells.push({ id: card.cells[i].id, o: card.cells[i].o }); }
    return { kind: 'cardview', cells: cells };
  }
  /* まちがいの えらびし（本番の ひっかけの型）。元と同じなら null を返す */
  function cardOneOff(card) {        /* 1ますだけ 向きが ちがう */
    var c = cloneCard(card), idx = [], i, p;
    for (i = 0; i < 4; i++) { if (symOf(c.cells[i].id) === 4) { idx.push(i); } }
    if (!idx.length) { return null; }
    p = pick(idx);
    c.cells[p].o = (c.cells[p].o + 1 + ri(3)) % 4;
    return c;
  }
  function cardSwap(card) {          /* 2つの ますを 入れかえる（向きは そのまま） */
    var c = cloneCard(card), a = ri(4), b = (a + 1 + ri(3)) % 4, t;
    t = c.cells[a]; c.cells[a] = c.cells[b]; c.cells[b] = t;
    return c;
  }
  function cardSlide(base, k) {      /* 位置だけ まわして 絵の向きは 元のまま（よくある まちがい） */
    var c = rotateCard(base, k), i, byId = {};
    for (i = 0; i < 4; i++) { byId[base.cells[i].id] = base.cells[i].o; }
    for (i = 0; i < 4; i++) { c.cells[i].o = byId[c.cells[i].id]; }
    return c;
  }
  function cardDiffCount(a, b) {
    var n = 0, i;
    for (i = 0; i < 4; i++) {
      if (a.cells[i].id !== b.cells[i].id || (a.cells[i].o % symOf(a.cells[i].id)) !== (b.cells[i].o % symOf(b.cells[i].id))) { n++; }
    }
    return n;
  }
  KZ.cardDiffCount = cardDiffCount;
  function makeCardBase() {
    var ids = shuffle(CARD_IDS4).slice(0, 3), cells = [], i, extra;
    /* 4つめは ときどき 回しても同じ形（ひしがた・じゅうじ）を混ぜる＝過去問と同じ */
    extra = (rnd() < 0.35) ? pick(['daiya', 'juji', 'hachi']) : pick(CARD_IDS4);
    while (ids.indexOf(extra) >= 0) { extra = pick(CARD_IDS4); }
    ids.push(extra);
    ids = shuffle(ids);
    for (i = 0; i < 4; i++) { cells.push({ id: ids[i], o: ri(4) }); }
    return { kind: 'cardview', cells: cells };
  }
  KZ.makeCardBase = makeCardBase;

  /* 回しても ひっくり返しても 全部ちがう かたちか（8とおりが 全部ちがう） */
  function allDistinct(base) {
    var seen = {}, m, k, s;
    for (m = 0; m < 2; m++) {
      for (k = 0; k < 4; k++) {
        s = viewSig({ base: base, mirror: m, rot: k });
        if (seen[s]) { return false; }
        seen[s] = true;
      }
    }
    return true;
  }
  KZ.allDistinct = allDistinct;

  /* ますの かたちを 1つ作る（8とおりが 全部ちがうものだけ 返す） */
  function makeGrid(n, count, needOriented) {
    var tries, fig, spots, i, cells, m, o, picked;
    for (tries = 0; tries < 200; tries++) {
      spots = [];
      for (i = 0; i < n * n; i++) { spots.push(i); }
      spots = shuffle(spots).slice(0, count);
      cells = [];
      picked = false;
      for (i = 0; i < spots.length; i++) {
        if (needOriented && i === 0) { m = pick(ORIENTED); } else { m = pick(MARK_NAMES); }
        if (ORIENTED.indexOf(m) >= 0) { picked = true; }
        o = ri(MARKS[m].period);
        cells.push({ r: Math.floor(spots[i] / n), c: spots[i] % n, m: m, o: o });
      }
      fig = { kind: 'grid', n: n, cells: cells };
      if (needOriented && !picked) { continue; }
      if (allDistinct(fig)) { return fig; }
    }
    /* ここへは まず来ない（3ますに 2つ以上の しるしで ほぼ必ず 見つかる）。
       来たら 確実に ちがう かたち を 返す */
    return { kind: 'grid', n: 2, cells: [{ r: 0, c: 0, m: 'sankaku', o: 1 }, { r: 1, c: 1, m: 'kuro', o: 0 }] };
  }
  KZ.makeGrid = makeGrid;

  /* ================= いきもの（絵） ================= */
  /* 絵は 100×100 の ますの まん中を (0,0) として 描く。左右・上下が ちがって見えるように 作る。
     （回しても ひっくり返しても 見分けが つくかは tools/test.html が 画素で 確かめる） */
  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  function ellipse(ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry);
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.restore();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  function poly(ctx, pts, fill, stroke, lw) {
    var i;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) { ctx.lineTo(pts[i][0], pts[i][1]); }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  function line(ctx, x1, y1, x2, y2, color, lw) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
  }

  /* twist＝「一部だけ 上下が ちがう」絵（まちがいの えらびしに使う＝ほとんど同じで 1か所だけ ちがう）。
     feat() の中の部品だけを 上下にひっくり返す。からだは そのまま。 */
  function feat(ctx, twist, fn) {
    ctx.save();
    if (twist) { ctx.scale(1, -1); }
    fn();
    ctx.restore();
  }

  var PICS = [
    { id: 'sakana', name: 'さかな', sym: 4, draw: function (ctx, twist) {
      poly(ctx, [[-26, 0], [-42, -15], [-42, 15]], COL.ao, COL.sumi, 2);             /* お */
      feat(ctx, twist, function () { poly(ctx, [[-16, -11], [-4, -36], [14, -11]], COL.mizu, COL.sumi, 2); }); /* せびれ（上だけ・大きめ。twist＝おなかに） */
      ellipse(ctx, -4, 0, 26, 14, COL.ao, COL.sumi, 2);                             /* からだ */
      circle(ctx, 10, -4, 4.5, COL.shiro, COL.sumi, 1.5); circle(ctx, 11, -4, 2, COL.sumi); /* め */
      line(ctx, 17, 5, 22, 3, COL.sumi, 2);                                         /* くち */
    } },
    { id: 'katatsumuri', name: 'かたつむり', sym: 4, draw: function (ctx, twist) {
      ellipse(ctx, 6, 18, 30, 8, COL.murasaki, COL.sumi, 2);                        /* からだ */
      circle(ctx, 26, 8, 9, COL.murasaki, COL.sumi, 2);                             /* あたま */
      feat(ctx, twist, function () {
        line(ctx, 29, 0, 33, -12, COL.sumi, 2.5); circle(ctx, 33, -13, 2.5, COL.sumi); /* つの（twist＝下向き） */
        line(ctx, 23, 0, 21, -10, COL.sumi, 2.5); circle(ctx, 21, -11, 2.5, COL.sumi);
      });
      circle(ctx, -10, -2, 20, COL.daidai, COL.sumi, 2);                            /* から */
      ctx.beginPath(); ctx.strokeStyle = COL.sumi; ctx.lineWidth = 2.5;
      ctx.arc(-10, -2, 12, 0, Math.PI * 1.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(-8, -4, 5, 0, Math.PI * 1.5); ctx.stroke();           /* うずまき */
      circle(ctx, 29, 6, 1.8, COL.sumi);                                            /* め */
    } },
    { id: 'tentoumushi', name: 'てんとうむし', sym: 4, draw: function (ctx, twist) {
      line(ctx, -16, -6, -30, -14, COL.sumi, 2.5); line(ctx, -20, 6, -34, 8, COL.sumi, 2.5);
      line(ctx, -14, 18, -26, 28, COL.sumi, 2.5); line(ctx, 16, -6, 30, -14, COL.sumi, 2.5);
      line(ctx, 20, 6, 34, 8, COL.sumi, 2.5); line(ctx, 14, 18, 26, 28, COL.sumi, 2.5); /* あし */
      circle(ctx, 0, 4, 23, COL.daidai, COL.sumi, 2);                               /* からだ */
      circle(ctx, 0, -18, 10, COL.sumi);                                            /* あたま */
      line(ctx, 0, -10, 0, 27, COL.sumi, 2);                                        /* まん中の せん */
      feat(ctx, twist, function () {
        ctx.translate(0, 4); circle(ctx, -11, -6, 5.5, COL.sumi); circle(ctx, 10, 5, 5.5, COL.sumi); circle(ctx, -8, 12, 4.5, COL.sumi); /* もよう（左2・右1。twist＝上下が入れかわる） */
      });
    } },
    { id: 'kotori', name: 'ことり', sym: 4, draw: function (ctx, twist) {
      feat(ctx, twist, function () { poly(ctx, [[-16, 2], [-38, -10], [-34, 8]], COL.mizu, COL.sumi, 2); }); /* お（twist＝下向き） */
      line(ctx, 4, 18, 4, 30, COL.sumi, 2.5); line(ctx, -6, 18, -6, 30, COL.sumi, 2.5); /* あし */
      ellipse(ctx, 0, 4, 21, 15, COL.mizu, COL.sumi, 2);                            /* からだ */
      ellipse(ctx, -3, 3, 12, 6, COL.ao, COL.sumi, 1.5);                            /* はね */
      circle(ctx, 17, -13, 11, COL.mizu, COL.sumi, 2);                              /* あたま */
      poly(ctx, [[26, -15], [38, -11], [26, -7]], COL.daidai, COL.sumi, 1.5);       /* くちばし */
      circle(ctx, 19, -15, 2.2, COL.sumi);                                          /* め */
    } },
    { id: 'imomushi', name: 'いもむし', sym: 4, draw: function (ctx, twist) {
      circle(ctx, -28, 10, 9, COL.ryokuao, COL.sumi, 2);
      circle(ctx, -13, 7, 10, COL.ryokuao, COL.sumi, 2);
      circle(ctx, 3, 5, 11, COL.ryokuao, COL.sumi, 2);                             /* からだ（右ほど大きい） */
      feat(ctx, twist, function () {
        line(ctx, 25, -10, 30, -24, COL.sumi, 2.5); circle(ctx, 30, -25, 2.5, COL.sumi);
        line(ctx, 18, -10, 16, -22, COL.sumi, 2.5); circle(ctx, 16, -23, 2.5, COL.sumi); /* つの（twist＝下向き） */
      });
      circle(ctx, 22, 1, 13, COL.ryokuao, COL.sumi, 2);                             /* あたま */
      circle(ctx, 27, -3, 2.5, COL.sumi);                                           /* め */
      line(ctx, 27, 5, 31, 7, COL.sumi, 2);                                         /* くち */
    } },
    { id: 'zou', name: 'ぞう', sym: 4, draw: function (ctx, twist) {
      feat(ctx, twist, function () { line(ctx, 28, 0, 38, -10, COL.sumi, 3); });     /* しっぽ（twist＝下向き） */
      ctx.fillStyle = COL.murasaki; ctx.strokeStyle = COL.sumi; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(-6, 14, 9, 16); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(14, 14, 9, 16); ctx.fill(); ctx.stroke();            /* あし */
      ellipse(ctx, 6, 4, 25, 17, COL.murasaki, COL.sumi, 2);                        /* からだ */
      feat(ctx, twist, function () {
        ctx.beginPath(); ctx.moveTo(-28, 2); ctx.quadraticCurveTo(-40, 10, -34, 28);
        ctx.strokeStyle = COL.murasaki; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-28, 2); ctx.quadraticCurveTo(-40, 10, -34, 28);
        ctx.strokeStyle = COL.sumi; ctx.lineWidth = 11; ctx.globalCompositeOperation = 'destination-over'; ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';                               /* はな（twist＝上へ あがる） */
      });
      circle(ctx, -20, -6, 14, COL.murasaki, COL.sumi, 2);                          /* あたま */
      ellipse(ctx, -12, -4, 6, 9, COL.mizu, COL.sumi, 1.5);                         /* みみ */
      circle(ctx, -25, -10, 2.2, COL.sumi);                                         /* め */
    } }
  ];
  KZ.PICS = PICS;

  /* 過去問の かたち（2026年度の 回転図形 問題14-1・14-2＝2×2の ますに 4つの絵）。
     sym＝回して 見分けられる 向きの数（4＝90度ごとに ちがう／2＝180度で 同じ／1＝どう回しても 同じ）。
     asked=true（sym 4）の かたちは 問題14-1型で きく側の 絵に 使える。sym 1・2 は まわりの 絵にだけ 使う。 */
  var SHAPES = [
    { id: 'sankakuS', name: 'さんかく', asked: true, sym: 4, draw: function (ctx) {
      poly(ctx, [[-28, -26], [30, 0], [-28, 26]], COL.shiro, COL.sumi, 3);          /* 右むきの さんかく */
    } },
    { id: 'gokaku', name: 'ごかくけい', asked: true, sym: 4, draw: function (ctx) {
      var i, p = [];
      for (i = 0; i < 5; i++) { p.push([30 * Math.cos(-Math.PI / 2 + i * Math.PI * 2 / 5), 30 * Math.sin(-Math.PI / 2 + i * Math.PI * 2 / 5)]); }
      poly(ctx, p, COL.shiro, COL.sumi, 3);                                         /* とがりが 上 */
    } },
    { id: 'tee', name: 'ティー', asked: true, sym: 4, draw: function (ctx) {
      poly(ctx, [[-32, -26], [32, -26], [32, -8], [9, -8], [9, 30], [-9, 30], [-9, -8], [-32, -8]], COL.shiro, COL.sumi, 3);
    } },
    { id: 'hata', name: 'はた', asked: true, sym: 4, draw: function (ctx) {
      poly(ctx, [[-28, -30], [28, -30], [28, 30], [0, 10], [-28, 30]], COL.shiro, COL.sumi, 3); /* きりこみが 下 */
    } },
    { id: 'eru', name: 'エル', asked: true, sym: 4, draw: function (ctx) {
      poly(ctx, [[-26, -30], [-8, -30], [-8, 12], [30, 12], [30, 30], [-26, 30]], COL.shiro, COL.sumi, 3);
    } },
    { id: 'fukku', name: 'フック', asked: true, sym: 4, draw: function (ctx) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.arc(2, -4, 20, Math.PI * 0.15, Math.PI * 1.6); ctx.lineTo(-6, 30);
      ctx.strokeStyle = COL.sumi; ctx.lineWidth = 16; ctx.stroke();
      ctx.beginPath(); ctx.arc(2, -4, 20, Math.PI * 0.15, Math.PI * 1.6); ctx.lineTo(-6, 30);
      ctx.strokeStyle = COL.shiro; ctx.lineWidth = 10; ctx.stroke();
    } },
    { id: 'daiya', name: 'ひしがた', asked: false, sym: 1, draw: function (ctx) {
      poly(ctx, [[0, -32], [32, 0], [0, 32], [-32, 0]], COL.shiro, COL.sumi, 3);
    } },
    { id: 'daikei', name: 'だいけい', asked: true, sym: 4, draw: function (ctx) {
      poly(ctx, [[-18, -22], [18, -22], [32, 22], [-32, 22]], COL.shiro, COL.sumi, 3);
    } },
    { id: 'marusan', name: 'まるに さんかく', asked: true, sym: 4, draw: function (ctx) {
      circle(ctx, 0, 0, 30, COL.shiro, COL.sumi, 3);
      poly(ctx, [[0, -16], [15, 10], [-15, 10]], COL.shiro, COL.sumi, 2.5);
    } },
    { id: 'yaue', name: 'うえ やじるし', asked: true, sym: 4, draw: function (ctx) {
      poly(ctx, [[0, -34], [30, -2], [12, -2], [12, 32], [-12, 32], [-12, -2], [-30, -2]], COL.shiro, COL.sumi, 3);
    } },
    { id: 'kagi', name: 'まがった ぼう', asked: true, sym: 4, draw: function (ctx) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-26, 28); ctx.lineTo(-6, -12); ctx.lineTo(32, -22);
      ctx.strokeStyle = COL.sumi; ctx.lineWidth = 18; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-26, 28); ctx.lineTo(-6, -12); ctx.lineTo(32, -22);
      ctx.strokeStyle = COL.ao; ctx.lineWidth = 12; ctx.stroke();
    } },
    { id: 'yajirushi', name: 'やじるし', asked: true, sym: 4, draw: function (ctx) {
      poly(ctx, [[-30, 14], [8, -24], [-2, -34], [34, -34], [34, 2], [24, -8], [-14, 30]], COL.shiro, COL.sumi, 3);
    } },
    { id: 'kuroba', name: 'クローバー', asked: true, sym: 4, draw: function (ctx) {
      var i, p = [[-15, -15], [15, -15], [-15, 15], [15, 15]];
      for (i = 0; i < 4; i++) { circle(ctx, p[i][0], p[i][1], 16, COL.shiro, COL.sumi, 2.5); }
      circle(ctx, -15, -15, 7.5, COL.sumi);
    } },
    { id: 'masu', name: 'ますと てん', asked: true, sym: 4, draw: function (ctx) {
      var i;
      ctx.strokeStyle = COL.sumi; ctx.lineWidth = 2.5; ctx.fillStyle = COL.shiro;
      ctx.beginPath(); ctx.rect(-30, -30, 60, 60); ctx.fill(); ctx.stroke();
      for (i = 1; i < 3; i++) { line(ctx, -30 + 20 * i, -30, -30 + 20 * i, 30, COL.sumi, 2); line(ctx, -30, -30 + 20 * i, 30, -30 + 20 * i, COL.sumi, 2); }
      circle(ctx, 0, -20, 7, COL.sumi);
    } },
    { id: 'wai', name: 'えだ', asked: true, sym: 4, draw: function (ctx) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 34); ctx.moveTo(0, 6); ctx.lineTo(-26, -24); ctx.moveTo(0, 6); ctx.lineTo(26, -24);
      ctx.strokeStyle = COL.sumi; ctx.lineWidth = 16; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 34); ctx.moveTo(0, 6); ctx.lineTo(-26, -24); ctx.moveTo(0, 6); ctx.lineTo(26, -24);
      ctx.strokeStyle = COL.daidai; ctx.lineWidth = 10; ctx.stroke();
    } },
    { id: 'kagiana', name: 'かぎあな', asked: true, sym: 4, draw: function (ctx) {
      ctx.fillStyle = COL.shiro; ctx.strokeStyle = COL.sumi; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.rect(-10, 2, 20, 32); ctx.fill(); ctx.stroke();
      circle(ctx, 0, -10, 19, COL.shiro, COL.sumi, 2.5);
      ctx.fillStyle = COL.shiro; ctx.beginPath(); ctx.rect(-8.5, 2, 17, 8); ctx.fill();
    } },
    { id: 'hachi', name: 'ひょうたん', asked: false, sym: 2, draw: function (ctx) {
      circle(ctx, 0, -15, 16, COL.shiro, COL.sumi, 2.5); circle(ctx, 0, 15, 16, COL.shiro, COL.sumi, 2.5);
    } },
    { id: 'juji', name: 'じゅうじ', asked: false, sym: 1, draw: function (ctx) {
      poly(ctx, [[-8, -32], [8, -32], [8, -8], [32, -8], [32, 8], [8, 8], [8, 32], [-8, 32], [-8, 8], [-32, 8], [-32, -8], [-8, -8]], COL.shiro, COL.sumi, 2.5);
    } }
  ];
  KZ.SHAPES = SHAPES;

  var PIC_BY_ID = {};
  (function () {
    var i;
    for (i = 0; i < PICS.length; i++) { PIC_BY_ID[PICS[i].id] = PICS[i]; }
    for (i = 0; i < SHAPES.length; i++) { PIC_BY_ID[SHAPES[i].id] = SHAPES[i]; }
  })();
  KZ.picById = function (id) { return PIC_BY_ID[id]; };
  /* きく側に 使える 絵（いきもの＋4回の回転が 全部ちがう かたち） */
  var ASKABLE = [];
  (function () {
    var i;
    for (i = 0; i < PICS.length; i++) { ASKABLE.push(PICS[i].id); }
    for (i = 0; i < SHAPES.length; i++) { if (SHAPES[i].asked) { ASKABLE.push(SHAPES[i].id); } }
  })();
  KZ.ASKABLE = ASKABLE;
  var ALL_IDS = [];
  (function () { var k; for (k in PIC_BY_ID) { if (PIC_BY_ID.hasOwnProperty(k)) { ALL_IDS.push(k); } } })();
  /* 本番型（問題14-2）の カードに使う かたち＝過去問と同じ 線の絵だけ（いきものは使わない） */
  var CARD_IDS = [], CARD_IDS4 = [];
  (function () {
    var i;
    for (i = 0; i < SHAPES.length; i++) { CARD_IDS.push(SHAPES[i].id); if (SHAPES[i].sym === 4) { CARD_IDS4.push(SHAPES[i].id); } }
  })();
  KZ.CARD_IDS = CARD_IDS;
  function symOf(id) { return PIC_BY_ID[id].sym || 4; }
  KZ.symOf = symOf;

  /* ================= しるしを 描く ================= */
  function drawMark(ctx, m, o, s) {
    /* s＝ますの大きさ。(0,0) が ますの まん中 */
    var h = s * 0.32, k;
    ctx.lineWidth = Math.max(2, s * 0.09); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (m === 'maru') {
      ctx.beginPath(); ctx.arc(0, 0, h, 0, Math.PI * 2); ctx.strokeStyle = COL.ao; ctx.stroke();
    } else if (m === 'kuro') {
      ctx.beginPath(); ctx.arc(0, 0, h, 0, Math.PI * 2); ctx.fillStyle = COL.murasaki; ctx.fill();
      ctx.strokeStyle = COL.sumi; ctx.lineWidth = 2; ctx.stroke();
    } else if (m === 'shikaku') {
      ctx.beginPath(); ctx.rect(-h, -h, h * 2, h * 2); ctx.fillStyle = COL.mizu; ctx.fill();
      ctx.strokeStyle = COL.sumi; ctx.lineWidth = 2; ctx.stroke();
    } else if (m === 'batsu') {
      ctx.strokeStyle = COL.sumi;
      ctx.beginPath(); ctx.moveTo(-h, -h); ctx.lineTo(h, h); ctx.moveTo(h, -h); ctx.lineTo(-h, h); ctx.stroke();
    } else if (m === 'sankaku') {
      ctx.save(); ctx.rotate(o * Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, -h * 1.1); ctx.lineTo(h * 1.05, h * 0.8); ctx.lineTo(-h * 1.05, h * 0.8); ctx.closePath();
      ctx.fillStyle = COL.daidai; ctx.fill(); ctx.strokeStyle = COL.sumi; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    } else if (m === 'hanbun') {
      k = s * 0.36;
      ctx.save(); ctx.rotate(o * Math.PI / 2);
      ctx.beginPath(); ctx.rect(-k, -k, k * 2, k * 2); ctx.strokeStyle = COL.sumi; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-k, -k); ctx.lineTo(k, -k); ctx.lineTo(-k, k); ctx.closePath();   /* ひだりうえ の はんぶん */
      ctx.fillStyle = COL.ao; ctx.fill();
      ctx.restore();
    } else if (m === 'sen') {
      ctx.save(); ctx.rotate(o * Math.PI / 2);
      ctx.strokeStyle = COL.sumi; ctx.lineWidth = Math.max(3, s * 0.12);
      ctx.beginPath(); ctx.moveTo(-h * 1.1, 0); ctx.lineTo(h * 1.1, 0); ctx.stroke();
      ctx.restore();
    }
  }
  KZ.drawMark = drawMark;

  /* ================= 1枚を 描く =================
     ctx の (0,0) が カードの まん中、size が カードの 1辺。extra＝アニメ用の 余分な回転（ラジアン） */
  function drawView(ctx, size, view, extra, opts) {
    var pad = size * 0.06, inner = size - pad * 2, n, cs, i, cell, fig, r, c, scale;
    opts = opts || {};
    ctx.save();
    ctx.rotate(extra || 0);
    /* かみ */
    ctx.fillStyle = opts.paper || COL.kami;
    ctx.strokeStyle = opts.frame || COL.sumi; ctx.lineWidth = Math.max(2, size * 0.02);
    roundRect(ctx, -size / 2, -size / 2, size, size, size * 0.08); ctx.fill(); ctx.stroke();
    if (view.base.kind === 'grid') {
      fig = transformGrid(view.base, view.mirror, view.rot);
      n = fig.n; cs = inner / n;
      ctx.strokeStyle = COL.usui; ctx.lineWidth = Math.max(1.5, size * 0.012);
      for (i = 1; i < n; i++) {
        ctx.beginPath(); ctx.moveTo(-inner / 2 + cs * i, -inner / 2); ctx.lineTo(-inner / 2 + cs * i, inner / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-inner / 2, -inner / 2 + cs * i); ctx.lineTo(inner / 2, -inner / 2 + cs * i); ctx.stroke();
      }
      ctx.strokeStyle = COL.sumi; ctx.lineWidth = Math.max(2, size * 0.015);
      ctx.strokeRect(-inner / 2, -inner / 2, inner, inner);
      for (i = 0; i < fig.cells.length; i++) {
        cell = fig.cells[i]; r = cell.r; c = cell.c;
        ctx.save();
        ctx.translate(-inner / 2 + cs * (c + 0.5), -inner / 2 + cs * (r + 0.5));
        drawMark(ctx, cell.m, cell.o, cs);
        ctx.restore();
      }
    } else if (view.base.kind === 'card') {
      /* 過去問型＝2×2の ますに 4つの絵。しるし● は きく絵の ますの 外がわの かど */
      cs = inner / 2; scale = cs / 100 * 0.86;
      ctx.save();
      ctx.rotate(view.rot * Math.PI / 2);
      ctx.strokeStyle = COL.sumi; ctx.lineWidth = Math.max(2, size * 0.015);
      ctx.strokeRect(-inner / 2, -inner / 2, inner, inner);
      ctx.beginPath(); ctx.moveTo(0, -inner / 2); ctx.lineTo(0, inner / 2); ctx.moveTo(-inner / 2, 0); ctx.lineTo(inner / 2, 0); ctx.stroke();
      for (i = 0; i < 4; i++) {
        r = Math.floor(i / 2); c = i % 2;
        ctx.save();
        ctx.translate(-inner / 2 + cs * (c + 0.5), -inner / 2 + cs * (r + 0.5));
        ctx.scale(scale, scale); ctx.lineJoin = 'round';
        PIC_BY_ID[view.base.cells[i]].draw(ctx, false);
        ctx.restore();
        if (i === view.base.mark) {
          ctx.save();
          ctx.translate(-inner / 2 + cs * (c + 0.5), -inner / 2 + cs * (r + 0.5));
          ctx.beginPath();
          ctx.arc((c === 0 ? -1 : 1) * cs * 0.41, (r === 0 ? -1 : 1) * cs * 0.41, Math.max(3.5, cs * 0.07), 0, Math.PI * 2);
          ctx.fillStyle = COL.sumi; ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
    } else if (view.base.kind === 'cardview') {
      /* 本番型＝4つの ますに 線の絵。各絵は 自分の向き o で 描く（カード全体の回転は cells に 焼き込み済み） */
      cs = inner / 2; scale = cs / 100 * 0.86;
      ctx.strokeStyle = COL.sumi; ctx.lineWidth = Math.max(2, size * 0.015);
      ctx.strokeRect(-inner / 2, -inner / 2, inner, inner);
      ctx.beginPath(); ctx.moveTo(0, -inner / 2); ctx.lineTo(0, inner / 2); ctx.moveTo(-inner / 2, 0); ctx.lineTo(inner / 2, 0); ctx.stroke();
      for (i = 0; i < 4; i++) {
        r = Math.floor(i / 2); c = i % 2;
        ctx.save();
        ctx.translate(-inner / 2 + cs * (c + 0.5), -inner / 2 + cs * (r + 0.5));
        ctx.rotate(view.base.cells[i].o * Math.PI / 2);
        ctx.scale(scale, scale); ctx.lineJoin = 'round';
        PIC_BY_ID[view.base.cells[i].id].draw(ctx, false);
        ctx.restore();
      }
    } else {
      scale = inner / 100;
      ctx.save();
      ctx.rotate(view.rot * Math.PI / 2);
      ctx.scale(view.mirror ? -scale : scale, scale);
      ctx.lineJoin = 'round';
      PIC_BY_ID[view.base.id].draw(ctx, !!view.twist);
      ctx.restore();
    }
    ctx.restore();
  }
  KZ.drawView = drawView;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* canvas に 1枚を 描く（Retina の 倍率に 合わせる） */
  function paintCanvas(canvas, view, extra, opts) {
    var css = canvas.clientWidth || parseInt(canvas.getAttribute('width'), 10) || 120;
    var dpr = global.devicePixelRatio || 1, ctx, px = Math.round(css * dpr);
    /* たて・よこ 両方を見る＝よこだけ見ると、倍率2の端末で 既定の 300×150 が「同じ」と誤判定され、絵が つぶれる（2026-10-31 実測） */
    if (canvas.width !== px || canvas.height !== px) { canvas.width = px; canvas.height = px; }
    ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.translate(css / 2, css / 2);
    drawView(ctx, css * 0.92, view, extra, opts);
  }
  KZ.paintCanvas = paintCanvas;

  /* ================= もんだいを 作る =================
     level 1＝やさしい：みぎに1かい だけ。えらぶのは 3まい。
     level 2＝ふつう：みぎ1・みぎ2・ひだり1。えらぶのは 4まい（鏡の かたちも まざる）。
     level 3＝むずかしい：みぎ1〜3・ひだり1〜2 ＋「なんかい まわした？」。 */
  /* 出る問題の 型と 割合
     やさしい＝基本型（3まい）50%・14-1型（●の絵の向き）50%。みぎに1かい だけ。
     ふつう＝本番型（14-2＝カード全体・4まい・ちがう回し方1つ＋1ますちがい1つ＋位置だけ1つ）50%・基本型（鏡と「一部だけ ちがう」絵）50%。
     むずかしい＝本番型（4まい 全部が「1〜2ますだけ ちがう」ひっかけ）60%・基本型 25%・回数型 15%。みぎ1〜3・ひだり1〜2。 */
  var LEVELS = {
    1: { name: 'やさしい', moves: [['migi', 1]], choices: 3, countQ: 0, tokaQ: 0.5, cardQ: 0 },
    2: { name: 'ふつう', moves: [['migi', 1], ['migi', 2], ['hidari', 1]], choices: 4, countQ: 0, tokaQ: 0, cardQ: 0.5 },
    3: { name: 'むずかしい', moves: [['migi', 1], ['migi', 2], ['migi', 3], ['hidari', 1], ['hidari', 2]], choices: 4, countQ: 0.15, tokaQ: 0, cardQ: 0.6 }
  };
  KZ.LEVELS = LEVELS;

  function rotOf(dir, times) { return dir === 'migi' ? (times % 4) : ((4 - times % 4) % 4); }
  KZ.rotOf = rotOf;

  function makeBase(level) {
    if (rnd() < 0.5) { return { kind: 'pic', id: pick(PICS).id }; }
    if (level === 1) { return makeGrid(2, 2, true); }
    if (level === 2) { return makeGrid(3, 3, true); }
    return makeGrid(3, 4, true);
  }

  /* 過去問型の カード＝4つの ちがう絵。きく絵は ASKABLE から */
  function makeCard() {
    var asked = pick(ASKABLE), others = shuffle(ALL_IDS), cells = [], i, mark;
    for (i = 0; i < others.length && cells.length < 3; i++) { if (others[i] !== asked) { cells.push(others[i]); } }
    mark = ri(4);
    cells.splice(mark, 0, asked);
    return { kind: 'card', cells: cells, mark: mark };
  }
  KZ.makeCard = makeCard;

  /* 本番型（14-2）の 1問を作る。えらびしは カード全体 4まい */
  function makeCardQuestion(level) {
    var lv = LEVELS[level], tries, base, mv, rot, correct, cands, seen, s, i, q, k, d, kinds, pool;
    for (tries = 0; tries < 60; tries++) {
      base = makeCardBase();
      mv = pick(lv.moves);
      rot = rotOf(mv[0], mv[1]);
      correct = rotateCard(base, rot);
      seen = {}; seen[cardSig(correct)] = true;
      cands = [];
      /* まちがいの 候補を 多めに作って、正解と 同じ見た目のものを 捨てる */
      pool = [];
      if (level === 2) {
        k = (rot + 1 + ri(3)) % 4; pool.push(['rot', rotateCard(base, k)]);
        pool.push(['one', cardOneOff(correct)]);
        pool.push(['slide', cardSlide(base, rot)]);
        pool.push(['one', cardOneOff(correct)]);
        pool.push(['swap', cardSwap(correct)]);
      } else {
        pool.push(['one', cardOneOff(correct)]);
        pool.push(['one', cardOneOff(correct)]);
        pool.push(['slide', cardSlide(base, rot)]);
        pool.push(['swap', cardSwap(correct)]);
        pool.push(['one', cardOneOff(correct)]);
        k = (rot + 1 + ri(3)) % 4; pool.push(['rot', rotateCard(base, k)]);
      }
      kinds = [];
      for (i = 0; i < pool.length && cands.length < 3; i++) {
        d = pool[i][1];
        if (!d) { continue; }
        s = cardSig(d);
        if (seen[s]) { continue; }
        /* むずかしい は「ほとんど同じ」だけを 使う（ちがいは 2ます以内。rot は 最後の 保険） */
        if (level === 3 && pool[i][0] !== 'rot' && cardDiffCount(d, correct) > 2) { continue; }
        seen[s] = true;
        cands.push({ base: d, mirror: 0, rot: 0, kind: pool[i][0] });
        kinds.push(pool[i][0]);
      }
      if (cands.length < 3) { continue; }
      cands = shuffle([{ base: correct, mirror: 0, rot: 0, kind: 'ok' }].concat(cands));
      q = { type: 'card', level: level, base: base, dir: mv[0], times: mv[1], correct: { base: correct, mirror: 0, rot: 0 }, choices: cands, answerIndex: -1, wording: 'yajirushi' };
      for (i = 0; i < cands.length; i++) { if (cands[i].kind === 'ok') { q.answerIndex = i; } }
      return q;
    }
    return null;
  }
  KZ.makeCardQuestion = makeCardQuestion;

  /* 基本型の「ほとんど同じ」まちがい＝絵なら 一部だけ 上下が ちがう（twist）。ますなら 1つの しるしの向きだけ ちがう */
  function subtleOf(correct) {
    var fig, idx = [], i, p, cell;
    if (correct.base.kind === 'pic') { return { base: correct.base, mirror: 0, rot: correct.rot, twist: 1 }; }
    fig = transformGrid(correct.base, correct.mirror, correct.rot);
    for (i = 0; i < fig.cells.length; i++) { if (MARKS[fig.cells[i].m].period > 1) { idx.push(i); } }
    if (!idx.length) { return null; }
    p = pick(idx); cell = fig.cells[p];
    cell.o = (cell.o + 1 + ri(MARKS[cell.m].period - 1)) % MARKS[cell.m].period;
    return { base: fig, mirror: 0, rot: 0 };
  }

  function makeQuestion(level) {
    var lv = LEVELS[level], base, mv, rot, correct, q, cands, i, m, k, v, s, seen, correctSig, rots, mirrors, chosen, wording, roll, sub;
    roll = rnd();
    if (roll < lv.cardQ) {
      q = makeCardQuestion(level);
      if (q) { return q; }
      roll = lv.cardQ;   /* 作れなければ 基本型へ */
    }
    if (roll < lv.cardQ + lv.tokaQ) {
      /* 過去問型＝カードを まわしたとき、●の絵は どう見える？（えらぶのは その絵の 4つの向き） */
      base = makeCard();
      mv = pick(lv.moves);
      rot = rotOf(mv[0], mv[1]);
      cands = [];
      for (k = 0; k < 4; k++) { cands.push({ base: { kind: 'pic', id: base.cells[base.mark] }, mirror: 0, rot: k }); }
      cands = shuffle(cands);
      q = { type: 'toka', level: level, base: base, dir: mv[0], times: mv[1], correct: { base: base, mirror: 0, rot: rot }, choices: cands, answerIndex: -1, wording: 'yajirushi' };
      for (i = 0; i < cands.length; i++) { if (cands[i].rot === rot) { q.answerIndex = i; } }
      return q;
    }
    base = makeBase(level);
    if (roll < lv.cardQ + lv.tokaQ + lv.countQ) {
      /* なんかい まわした？（みぎまわり・1〜3かい）*/
      rot = 1 + ri(3);
      return {
        type: 'count', level: level, base: base, dir: 'migi', times: rot,
        before: { base: base, mirror: 0, rot: 0 },
        after: { base: base, mirror: 0, rot: rot },
        choices: [1, 2, 3], answerIndex: rot - 1
      };
    }
    mv = pick(lv.moves);
    rot = rotOf(mv[0], mv[1]);
    correct = { base: base, mirror: 0, rot: rot };
    correctSig = viewSig(correct);
    rots = []; mirrors = []; seen = {}; seen[correctSig] = true;
    for (m = 0; m < 2; m++) {
      for (k = 0; k < 4; k++) {
        v = { base: base, mirror: m, rot: k }; s = viewSig(v);
        if (seen[s]) { continue; }
        seen[s] = true;
        if (m === 0) { rots.push(v); } else { mirrors.push(v); }
      }
    }
    chosen = [];
    if (level === 1) {
      /* まわしていない もの を よく まぜる（「まわってない」を 見分ける 練習） */
      if (rnd() < 0.5 && rot !== 0) { chosen.push({ base: base, mirror: 0, rot: 0 }); rots = removeSig(rots, viewSig(chosen[0])); }
      else { chosen.push(pick(rots)); rots = removeSig(rots, viewSig(chosen[0])); }
      /* 鏡の かたち（正解を ひっくり返したもの）を 1つ */
      chosen.push(pickMirror(mirrors, rot));
    } else {
      /* ふつう・むずかしい＝「ほとんど同じ」1まい（一部だけ ちがう）＋鏡 1まい＋ちがう回し方 1まい */
      rots = shuffle(rots);
      sub = subtleOf(correct);
      if (sub && !seen[viewSig(sub)]) { seen[viewSig(sub)] = true; chosen.push(sub); } else { chosen.push(rots[1]); }
      chosen.push(rots[0]);
      chosen.push(pickMirror(mirrors, rot));
    }
    cands = shuffle([correct].concat(chosen));
    wording = (level === 1) ? 'dir' : (rnd() < 0.5 ? 'dir' : 'yajirushi');
    q = { type: 'turn', level: level, base: base, dir: mv[0], times: mv[1], correct: correct, choices: cands, answerIndex: -1, wording: wording };
    for (i = 0; i < cands.length; i++) { if (viewSig(cands[i]) === correctSig) { q.answerIndex = i; } }
    return q;
  }
  KZ.makeQuestion = makeQuestion;

  function removeSig(list, sig) {
    var out = [], i;
    for (i = 0; i < list.length; i++) { if (viewSig(list[i]) !== sig) { out.push(list[i]); } }
    return out;
  }
  function pickMirror(mirrors, rot) {
    var i;
    for (i = 0; i < mirrors.length; i++) { if (mirrors[i].rot === rot) { return mirrors[i]; } }
    return pick(mirrors);
  }

  /* ================= もんだい文 ================= */
  function questionText(q) {
    var t = q.times + 'かい';
    if (q.type === 'count') { return 'なんかい まわしたかな？'; }
    if (q.type === 'toka') { return 'やじるしの ほうに ' + t + ' まわすと、●の えは どれ？'; }
    if (q.type === 'card') { return 'やじるしの ほうに ' + t + ' まわすと、どれに なる？'; }
    if (q.wording === 'yajirushi') { return 'やじるしの ほうに ' + t + ' まわすと どれ？'; }
    return (q.dir === 'migi' ? 'みぎに ' : 'ひだりに ') + t + ' まわすと どれ？';
  }
  KZ.questionText = questionText;

  /* まわる やじるしの 絵（SVG の文字列・絵文字は使わない）。
     1こ＝90度（まるの 4ぶんの1）。うすい おうぎ形で「4ぶんの1 まわる」を見せ、
     先は 大きな 三角で つぶれないように する。みぎ＝12時から3時へ・ひだり＝左右反転 */
  function arrowSvg(dir, size) {
    var s = size || 44;
    var flip = dir === 'hidari' ? ' transform="scale(-1,1) translate(-48,0)"' : '';
    return '<svg class="arw" width="' + s + '" height="' + s + '" viewBox="0 0 48 48" aria-hidden="true">' +
      '<g' + flip + '>' +
      '<circle cx="22" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-opacity="0.45" stroke-dasharray="3 3"/>' +
      '<path d="M 22 24 L 22 8 A 16 16 0 0 1 38 24 Z" fill="currentColor" fill-opacity="0.18"/>' +
      '<path d="M 22 8 L 22 24 L 38 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-opacity="0.7"/>' +
      '<path d="M 22 8 A 16 16 0 0 1 37.3 19.5" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M 38 37 L 30.5 21 L 45.5 21 Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
      '</g></svg>';
  }
  KZ.arrowSvg = arrowSvg;

  /* ================= おと（ファイルを使わず その場で つくる） =================
     古い iPad は さいしょの タッチの中で おとの しくみを 起こす（unlock）。
     音が出せない ブラウザでも あそびは とまらない（すべて try で かこむ）。 */
  var NOTE = { C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784.0, A5: 880.0, B5: 987.8,
    C6: 1046.5, D6: 1174.7, E6: 1318.5, F6: 1396.9, G6: 1568.0, A6: 1760.0, C7: 2093.0, E4: 329.6, G4: 392.0, A4: 440.0 };
  KZ.NOTE = NOTE;
  /* おとの ならび＝[おんぷ, はじまり(びょう), ながさ(びょう), おおきさ(0〜1), なみの かたち] */
  var SOUNDS = {
    tap: [['A5', 0, 0.06, 0.35, 'triangle']],
    ok: [['C6', 0, 0.09, 0.6, 'square'], ['E6', 0.08, 0.09, 0.6, 'square'], ['G6', 0.16, 0.09, 0.6, 'square'],
      ['C7', 0.24, 0.28, 0.6, 'square'], ['G6', 0.24, 0.28, 0.35, 'triangle']],
    ok2: [['E6', 0, 0.09, 0.5, 'square'], ['A6', 0.09, 0.22, 0.5, 'square']],
    oshii: [['G5', 0, 0.12, 0.45, 'sine'], ['E5', 0.13, 0.2, 0.45, 'sine']],
    kotae: [['A4', 0, 0.16, 0.4, 'sine'], ['C5', 0.16, 0.16, 0.4, 'sine'], ['E5', 0.32, 0.26, 0.4, 'sine']],
    /* 1かいめ・2かいめ・3かいめ と だんだん たかく（かぞえる きもちを もりあげる） */
    count1: [['C6', 0, 0.16, 0.6, 'triangle']],
    count2: [['E6', 0, 0.16, 0.6, 'triangle']],
    count3: [['G6', 0, 0.16, 0.6, 'triangle']],
    last: [['C7', 0, 0.12, 0.55, 'triangle'], ['E6', 0, 0.3, 0.35, 'square'], ['G6', 0.1, 0.35, 0.35, 'square']],
    round: [['C5', 0, 0.12, 0.55, 'square'], ['E5', 0.13, 0.12, 0.55, 'square'], ['G5', 0.26, 0.12, 0.55, 'square'],
      ['C6', 0.42, 0.55, 0.5, 'square'], ['E6', 0.42, 0.55, 0.35, 'triangle'], ['G5', 0.42, 0.55, 0.35, 'triangle']],
    perfect: [['C5', 0, 0.1, 0.55, 'square'], ['E5', 0.1, 0.1, 0.55, 'square'], ['G5', 0.2, 0.1, 0.55, 'square'],
      ['C6', 0.3, 0.1, 0.55, 'square'], ['E6', 0.4, 0.1, 0.55, 'square'], ['G6', 0.5, 0.1, 0.55, 'square'],
      ['C7', 0.62, 0.7, 0.5, 'square'], ['E6', 0.62, 0.7, 0.35, 'triangle'], ['G6', 0.62, 0.7, 0.35, 'triangle']],
    grow: [['G5', 0, 0.08, 0.45, 'triangle'], ['C6', 0.07, 0.08, 0.45, 'triangle'], ['E6', 0.14, 0.08, 0.45, 'triangle'],
      ['G6', 0.21, 0.08, 0.45, 'triangle'], ['C7', 0.28, 0.08, 0.45, 'triangle'], ['E6', 0.36, 0.08, 0.4, 'triangle'],
      ['G6', 0.43, 0.08, 0.4, 'triangle'], ['C7', 0.5, 0.45, 0.5, 'triangle']]
  };
  KZ.SOUNDS = SOUNDS;
  var snd = { ctx: null, on: true, vol: 0.22 };
  KZ.snd = snd;
  function audioClass() { return global.AudioContext || global.webkitAudioContext || null; }
  /* さいしょの タッチで よぶ（なんど よんでも よい） */
  snd.unlock = function () {
    var AC, b, src;
    try {
      if (!snd.ctx) {
        AC = audioClass(); if (!AC) { return false; }
        snd.ctx = new AC();
        b = snd.ctx.createBuffer(1, 1, 22050);
        src = snd.ctx.createBufferSource(); src.buffer = b; src.connect(snd.ctx.destination);
        if (src.start) { src.start(0); } else if (src.noteOn) { src.noteOn(0); }
      }
      if (snd.ctx.state && snd.ctx.state !== 'running' && snd.ctx.resume) { snd.ctx.resume(); }
      return true;
    } catch (e) { return false; }
  };
  function tone(ctx, freq, at, dur, vol, type) {
    var o = ctx.createOscillator(), g = ctx.createGain(), peak = Math.max(0.0002, vol * snd.vol);
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(ctx.destination);
    if (o.start) { o.start(at); o.stop(at + dur + 0.03); } else { o.noteOn(at); o.noteOff(at + dur + 0.03); }
  }
  /* くるっと まわる あいだの「ひゅいーん」（ひくい→たかい） */
  snd.sweep = function (sec) {
    var ctx = snd.ctx, o, g, t;
    if (!snd.on || !ctx) { return false; }
    try {
      t = ctx.currentTime + 0.01;
      o = ctx.createOscillator(); g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(380, t);
      o.frequency.exponentialRampToValueAtTime(900, t + sec);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16 * snd.vol / 0.22, t + 0.08);
      g.gain.linearRampToValueAtTime(0.0001, t + sec);
      o.connect(g); g.connect(ctx.destination);
      if (o.start) { o.start(t); o.stop(t + sec + 0.03); } else { o.noteOn(t); o.noteOff(t + sec + 0.03); }
      return true;
    } catch (e) { return false; }
  };
  /* なまえで ならす。delay＝なんびょう あとか */
  snd.play = function (name, delay) {
    var ctx = snd.ctx, seq = SOUNDS[name], t0, i, n;
    if (!snd.on || !ctx || !seq) { return false; }
    try {
      t0 = ctx.currentTime + 0.01 + (delay || 0);
      for (i = 0; i < seq.length; i++) {
        n = seq[i];
        tone(ctx, NOTE[n[0]], t0 + n[1], n[2], n[3], n[4]);
      }
      return true;
    } catch (e) { return false; }
  };

  /* ================= きろく（端末内保存） ================= */
  function freshState() {
    return {
      schema: KZ.SCHEMA, name: '', perRound: 5, lastLevel: 1,
      total: 0, cIndex: 0, cLeaves: 0, zukan: [], lap: 0,
      lv: { 1: { rounds: 0, q: 0, ok: 0 }, 2: { rounds: 0, q: 0, ok: 0 }, 3: { rounds: 0, q: 0, ok: 0 } }
    };
  }
  KZ.freshState = freshState;

  function loadState() {
    var raw = null, s;
    try { raw = global.localStorage ? global.localStorage.getItem(KZ.STORE_KEY) : null; } catch (e) { raw = null; }
    if (!raw) { return freshState(); }
    try { s = JSON.parse(raw); } catch (e2) { return freshState(); }
    if (!s || s.schema !== KZ.SCHEMA) { return freshState(); }
    return s;
  }
  function saveState(s) {
    try { if (global.localStorage) { global.localStorage.setItem(KZ.STORE_KEY, JSON.stringify(s)); } } catch (e) { /* 保存できなくても あそべる */ }
  }
  KZ.loadState = loadState; KZ.saveState = saveState;

  /* はっぱ（せいかいで もらえる）→ いきものの せいちょう
     0〜5＝たまご 6〜13＝ようちゅう 14〜23＝さなぎ 24＝せいちゅう（ずかんへ） */
  var GROW = [0, 6, 14, 24];
  KZ.GROW = GROW;
  function stageOf(leaves) {
    if (leaves >= GROW[3]) { return 3; }
    if (leaves >= GROW[2]) { return 2; }
    if (leaves >= GROW[1]) { return 1; }
    return 0;
  }
  KZ.stageOf = stageOf;
  var STAGE_NAME = ['たまご', 'ようちゅう', 'さなぎ', 'せいちゅう'];
  KZ.STAGE_NAME = STAGE_NAME;

  /* はっぱを たして、おきたことを 返す（純粋な計算＝試験できる） */
  function addLeaves(s, n) {
    var events = [], before = stageOf(s.cLeaves), after, id;
    s.total += n;
    s.cLeaves += n;
    while (s.cLeaves >= GROW[3]) {
      id = PICS[s.cIndex % PICS.length].id;
      s.zukan.push(id);
      events.push({ kind: 'adult', id: id });
      s.cLeaves -= GROW[3];
      s.cIndex += 1;
      if (s.cIndex % PICS.length === 0) { s.lap += 1; events.push({ kind: 'lap', lap: s.lap }); }
      before = 0;
    }
    after = stageOf(s.cLeaves);
    if (after > before) { events.push({ kind: 'stage', stage: after }); }
    return events;
  }
  KZ.addLeaves = addLeaves;

  var RANKS = [[0, 'くるくる みならい'], [20, 'くるくる なかま'], [50, 'くるくる めいじん'], [100, 'くるくる はかせ'], [200, 'くるくる たつじん']];
  function rankOf(total) {
    var i, name = RANKS[0][1];
    for (i = 0; i < RANKS.length; i++) { if (total >= RANKS[i][0]) { name = RANKS[i][1]; } }
    return name;
  }
  KZ.rankOf = rankOf;
  function nextRankAt(total) {
    var i;
    for (i = 0; i < RANKS.length; i++) { if (total < RANKS[i][0]) { return RANKS[i][0]; } }
    return null;
  }
  KZ.nextRankAt = nextRankAt;

  /* ================= いきものの せいちょうの 絵 ================= */
  function drawStage(ctx, size, stage, picId) {
    var s = size / 100;
    ctx.save(); ctx.scale(s, s); ctx.lineJoin = 'round';
    if (stage === 0) {
      ellipse(ctx, 0, 2, 24, 30, COL.kami, COL.sumi, 2.5);
      circle(ctx, -8, -6, 4, COL.ki); circle(ctx, 9, 4, 5, COL.ki); circle(ctx, -4, 16, 3.5, COL.ki);
    } else if (stage === 1) {
      circle(ctx, -24, 8, 9, COL.ki, COL.sumi, 2); circle(ctx, -10, 6, 10, COL.ki, COL.sumi, 2);
      circle(ctx, 5, 4, 10, COL.ki, COL.sumi, 2); circle(ctx, 22, 2, 12, COL.ki, COL.sumi, 2);
      circle(ctx, 26, -2, 2.2, COL.sumi);
    } else if (stage === 2) {
      ctx.beginPath(); ctx.moveTo(0, -34); ctx.quadraticCurveTo(26, -6, 16, 24); ctx.quadraticCurveTo(0, 40, -16, 24);
      ctx.quadraticCurveTo(-26, -6, 0, -34); ctx.closePath();
      ctx.fillStyle = COL.daidai; ctx.fill(); ctx.strokeStyle = COL.sumi; ctx.lineWidth = 2.5; ctx.stroke();
      line(ctx, -10, -4, 10, -4, COL.sumi, 2); line(ctx, -12, 8, 12, 8, COL.sumi, 2); line(ctx, -8, 20, 8, 20, COL.sumi, 2);
      line(ctx, 0, -34, 0, -44, COL.sumi, 3);
    } else {
      ctx.lineJoin = 'round';
      PIC_BY_ID[picId].draw(ctx);
    }
    ctx.restore();
  }
  KZ.drawStage = drawStage;

  function paintStage(canvas, stage, picId) {
    var css = canvas.clientWidth || 120, dpr = global.devicePixelRatio || 1, ctx, px = Math.round(css * dpr);
    if (canvas.width !== px || canvas.height !== px) { canvas.width = px; canvas.height = px; }
    ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr); ctx.translate(css / 2, css / 2);
    drawStage(ctx, css * 0.9, stage, picId);
  }
  KZ.paintStage = paintStage;

  /* ================= 自己点検（tools/test.html から 呼ぶ） ================= */
  KZ.selfTest = function (doc) {
    var out = [], pass = 0, fail = 0;
    function ok(cond, label) { if (cond) { pass++; } else { fail++; out.push('FAIL ' + label); } }
    var i, j, k, m, q, sigs, cnt, lvl, base, fig, v, a, b, s, canvas, ctx, data, variants, diff, total, px, py, events;

    KZ.seed(12345);
    /* T1 変換の きまり */
    base = { kind: 'grid', n: 3, cells: [{ r: 0, c: 0, m: 'sankaku', o: 0 }, { r: 1, c: 2, m: 'hanbun', o: 1 }, { r: 2, c: 1, m: 'sen', o: 0 }] };
    ok(gridSig(transformGrid(base, 0, 4)) === gridSig(base), 'T1 4回まわすと もどる');
    ok(gridSig(transformGrid(transformGrid(base, 1, 0), 1, 0)) === gridSig(base), 'T1 2回ひっくり返すと もどる');
    fig = transformGrid(base, 0, 1);
    ok(fig.cells[0].r === 0 && fig.cells[0].c === 2 && fig.cells[0].o === 1, 'T1 (0,0)うえ△ → (0,2)みぎ△');
    ok(fig.cells[2].r === 1 && fig.cells[2].c === 0 && fig.cells[2].o === 1, 'T1 (2,1)よこ線 → (1,0)たて線');
    for (i = 0; i < MARK_NAMES.length; i++) {
      m = MARK_NAMES[i];
      for (j = 0; j < MARKS[m].period; j++) { ok(MARKS[m].mirror[MARKS[m].mirror[j]] === j, 'T1 ' + m + ' の鏡は 2回で もどる o=' + j); }
    }
    /* 鏡のあと回転＝逆回転のあと鏡 の関係（ますの中身で確認） */
    a = gridSig(transformGrid(transformGrid(base, 0, 1), 1, 0));
    b = gridSig(transformGrid(transformGrid(base, 1, 0), 0, 3));
    ok(a === b, 'T1 鏡と回転の 入れかえ');

    /* T1b 本番型の カードの きまり */
    base = { kind: 'cardview', cells: [{ id: 'tee', o: 0 }, { id: 'hata', o: 1 }, { id: 'eru', o: 2 }, { id: 'daiya', o: 3 }] };
    ok(cardSig(rotateCard(base, 4)) === cardSig(base), 'T1b カードは 4回で もどる');
    fig = rotateCard(base, 1);
    ok(fig.cells[1].id === 'tee' && fig.cells[1].o === 1 && fig.cells[3].id === 'hata' && fig.cells[0].id === 'eru' && fig.cells[2].id === 'daiya', 'T1b 左上→右上→右下→左下');
    ok(cardSig(rotateCard(base, 1)) !== cardSig(base), 'T1b 1回で 見た目が変わる');
    ok(cardDiffCount(base, base) === 0 && cardDiffCount(base, cardSwap(base)) === 2, 'T1b ちがう ますの数');
    ok(cardSig({ kind: 'cardview', cells: [{ id: 'daiya', o: 0 }, { id: 'tee', o: 0 }, { id: 'eru', o: 0 }, { id: 'hata', o: 0 }] }) === cardSig({ kind: 'cardview', cells: [{ id: 'daiya', o: 2 }, { id: 'tee', o: 0 }, { id: 'eru', o: 0 }, { id: 'hata', o: 0 }] }), 'T1b ひしがたは 向きを 区別しない');

    /* T2 もんだい 各レベル 600問 */
    for (lvl = 1; lvl <= 3; lvl++) {
      cnt = { turn: 0, count: 0, toka: 0, card: 0 };
      for (i = 0; i < 600; i++) {
        q = makeQuestion(lvl);
        cnt[q.type]++;
        if (q.type === 'card') {
          ok(q.choices.length === 4, 'T2 card 4まい lv' + lvl);
          sigs = {}; total = 0;
          for (j = 0; j < q.choices.length; j++) { s = cardSig(q.choices[j].base); if (sigs[s]) { total++; } sigs[s] = true; }
          ok(total === 0, 'T2 card 同じ見た目なし lv' + lvl);
          ok(q.answerIndex >= 0 && cardSig(q.choices[q.answerIndex].base) === cardSig(rotateCard(q.base, rotOf(q.dir, q.times))), 'T2 card 正解＝指示どおり lv' + lvl);
          for (j = 0; j < q.choices.length; j++) {
            if (j === q.answerIndex) { continue; }
            ok(cardDiffCount(q.choices[j].base, q.correct.base) >= 1, 'T2 card まちがいは 正解と ちがう lv' + lvl);
            if (lvl === 3 && q.choices[j].kind !== 'rot') { ok(cardDiffCount(q.choices[j].base, q.correct.base) <= 2, 'T2 card むずかしい は 2ます以内の ちがい（' + q.choices[j].kind + '）'); }
          }
          sigs = {}; total = 0;
          for (j = 0; j < 4; j++) { if (sigs[q.base.cells[j].id]) { total++; } sigs[q.base.cells[j].id] = true; }
          ok(total === 0, 'T2 card 4つの絵は 全部ちがう');
          total = 0; for (j = 0; j < 4; j++) { if (symOf(q.base.cells[j].id) === 4) { total++; } }
          ok(total >= 3, 'T2 card 向きが分かる絵が 3つ以上');
          if (lvl === 3) { total = 0; for (j = 0; j < q.choices.length; j++) { if (q.choices[j].kind === 'one') { total++; } } ok(total >= 1, 'T2 card むずかしい に 1ますちがい あり'); }
          continue;
        }
        if (q.type === 'toka') {
          ok(q.choices.length === 4, 'T2 toka 4まい lv' + lvl);
          sigs = {}; total = 0;
          for (j = 0; j < q.choices.length; j++) { s = viewSig(q.choices[j]); if (sigs[s]) { total++; } sigs[s] = true; ok(q.choices[j].base.id === q.base.cells[q.base.mark], 'T2 toka えらぶ絵＝●の絵'); }
          ok(total === 0, 'T2 toka 同じ向きなし');
          ok(q.answerIndex >= 0 && q.choices[q.answerIndex].rot === rotOf(q.dir, q.times), 'T2 toka 正解の向き lv' + lvl);
          ok(ASKABLE.indexOf(q.base.cells[q.base.mark]) >= 0, 'T2 toka きく絵は ASKABLE');
          sigs = {}; total = 0;
          for (j = 0; j < 4; j++) { if (sigs[q.base.cells[j]]) { total++; } sigs[q.base.cells[j]] = true; }
          ok(total === 0, 'T2 toka 4つの絵は 全部ちがう');
          if (lvl === 1) { ok(q.dir === 'migi' && q.times === 1, 'T2 toka やさしい は みぎ1かい'); }
          continue;
        }
        if (q.type === 'count') {
          ok(q.choices[q.answerIndex] === q.times, 'T2 count の答え lv' + lvl);
          ok(q.times >= 1 && q.times <= 3, 'T2 count の回数 lv' + lvl);
          ok(lvl === 3, 'T2 count は むずかしい だけ');
          continue;
        }
        ok(q.choices.length === LEVELS[lvl].choices, 'T2 えらぶ枚数 lv' + lvl + ' =' + q.choices.length);
        sigs = {}; total = 0;
        for (j = 0; j < q.choices.length; j++) { s = viewSig(q.choices[j]); if (sigs[s]) { total++; } sigs[s] = true; }
        ok(total === 0, 'T2 えらぶ枚数に 同じ形なし lv' + lvl);
        ok(q.answerIndex >= 0 && viewSig(q.choices[q.answerIndex]) === viewSig(q.correct), 'T2 正解が入っている lv' + lvl);
        ok(viewSig(q.correct) === viewSig({ base: q.base, mirror: 0, rot: rotOf(q.dir, q.times) }), 'T2 正解＝指示どおりの回転 lv' + lvl);
        ok(q.correct.mirror === 0, 'T2 正解は鏡でない lv' + lvl);
        if (lvl === 1) { ok(q.dir === 'migi' && q.times === 1 && q.wording === 'dir', 'T2 やさしい は みぎ1かい・ことばで'); }
        if (lvl === 2) { ok(q.times <= 2, 'T2 ふつう は 2かいまで'); }
        if (q.base.kind === 'grid') {
          ok(allDistinct(q.base), 'T2 ますの形は 8とおり全部ちがう lv' + lvl);
          ok(q.base.n === (lvl === 1 ? 2 : 3), 'T2 ますの数 lv' + lvl);
        }
        /* 鏡の かたちが かならず 1枚 */
        total = 0;
        for (j = 0; j < q.choices.length; j++) { if (q.choices[j].mirror === 1) { total++; } }
        ok(total === 1, 'T2 鏡の形が1枚 lv' + lvl + ' =' + total);
        /* ふつう・むずかしい の絵は「一部だけ ちがう」1枚 */
        if (lvl >= 2 && q.base.kind === 'pic') {
          total = 0;
          for (j = 0; j < q.choices.length; j++) { if (q.choices[j].twist) { total++; } }
          ok(total === 1, 'T2 一部だけちがう絵が1枚 lv' + lvl);
        }
      }
      if (lvl === 3) { ok(cnt.count > 40 && cnt.count < 150, 'T2 count の割合 ' + cnt.count + '/600'); }
      else { ok(cnt.count === 0, 'T2 count なし lv' + lvl); }
      if (lvl === 1) { ok(cnt.toka > 200 && cnt.toka < 400 && cnt.card === 0, 'T2 やさしい は toka あり card なし ' + cnt.toka); }
      else { ok(cnt.toka === 0 && cnt.card > 200, 'T2 lv' + lvl + ' は card ' + cnt.card + '/600・toka ' + cnt.toka); }
      ok(cnt.turn > 100, 'T2 turn の割合 lv' + lvl + ' ' + cnt.turn + '/600');
    }

    /* T3 いきものの絵＝8とおりが 画素で 見分けられる（64px四方で 1.5%＝61画素以上ちがう。
       過去問の「点の位置だけが ちがう」形も通し、対称な形（差0）は止める） */
    if (doc && doc.createElement) {
      canvas = doc.createElement('canvas'); canvas.width = 64; canvas.height = 64;
      ctx = canvas.getContext('2d');
      for (i = 0; i < PICS.length; i++) {
        variants = [];
        for (m = 0; m < 4; m++) {      /* 0=そのまま 1=鏡 2=一部ちがう 3=鏡＋一部ちがう ＝ 16とおり */
          for (k = 0; k < 4; k++) {
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 64, 64);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 64, 64);
            ctx.translate(32, 32);
            drawView(ctx, 60, { base: { kind: 'pic', id: PICS[i].id }, mirror: m % 2, rot: k, twist: m >= 2 ? 1 : 0 }, 0);
            variants.push(ctx.getImageData(0, 0, 64, 64).data);
          }
        }
        for (a = 0; a < variants.length; a++) {
          for (b = a + 1; b < variants.length; b++) {
            /* 「鏡」と「一部ちがう」が 両方ちがう組は 比べない＝えらびしに 同時に 出ない組
               （一部を上下に ひっくり返した絵を さらに 上下に ひっくり返すと 元に近づくのは 当然） */
            if ((Math.floor(a / 4) % 2) !== (Math.floor(b / 4) % 2) && (a >= 8) !== (b >= 8)) { continue; }
            diff = 0;
            for (px = 0; px < variants[a].length; px += 4) {
              if (Math.abs(variants[a][px] - variants[b][px]) + Math.abs(variants[a][px + 1] - variants[b][px + 1]) + Math.abs(variants[a][px + 2] - variants[b][px + 2]) > 60) { diff++; }
            }
            ok(diff > 64 * 64 * 0.015, 'T3 ' + PICS[i].id + ' 変種' + a + 'と' + b + ' の差=' + diff);
          }
        }
      }
        /* T3b 過去問の かたち＝きく側は 4回の回転が 画素で 見分けられる・まわり用も 描ける */
        for (i = 0; i < SHAPES.length; i++) {
          variants = [];
          for (k = 0; k < 4; k++) {
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 64, 64);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 64, 64);
            ctx.translate(32, 32);
            drawView(ctx, 60, { base: { kind: 'pic', id: SHAPES[i].id }, mirror: 0, rot: k }, 0);
            variants.push(ctx.getImageData(0, 0, 64, 64).data);
          }
          if (!SHAPES[i].asked) { ok(true, 'T3b filler'); continue; }
          for (a = 0; a < 4; a++) {
            for (b = a + 1; b < 4; b++) {
              diff = 0;
              for (px = 0; px < variants[a].length; px += 4) {
                if (Math.abs(variants[a][px] - variants[b][px]) + Math.abs(variants[a][px + 1] - variants[b][px + 1]) + Math.abs(variants[a][px + 2] - variants[b][px + 2]) > 60) { diff++; }
              }
              ok(diff > 64 * 64 * 0.015, 'T3b ' + SHAPES[i].id + ' 向き' + a + 'と' + b + ' の差=' + diff);
            }
          }
        }
        /* T3c カードが 描ける（14-1型の 4つの向き・本番型の 4つの向き） */
        for (k = 0; k < 4; k++) {
          try { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(32, 32); drawView(ctx, 60, { base: makeCard(), mirror: 0, rot: k }, 0); ok(true, 'T3c'); } catch (e3) { ok(false, 'T3c card ' + e3); }
          try { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(32, 32); drawView(ctx, 60, { base: rotateCard(makeCardBase(), k), mirror: 0, rot: 0 }, 0); ok(true, 'T3c'); } catch (e4) { ok(false, 'T3c cardview ' + e4); }
        }
        /* T3d 本番型の 1ますちがい は 画素でも ちがって見える（sym 4 の絵は 4つの向きが 全部ちがう） */
        for (i = 0; i < SHAPES.length; i++) {
          if (SHAPES[i].sym !== 4) { continue; }
          variants = [];
          for (k = 0; k < 4; k++) {
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 64, 64);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 64, 64);
            ctx.translate(32, 32);
            drawView(ctx, 60, { base: { kind: 'pic', id: SHAPES[i].id }, mirror: 0, rot: k }, 0);
            variants.push(ctx.getImageData(0, 0, 64, 64).data);
          }
          for (a = 0; a < 4; a++) {
            for (b = a + 1; b < 4; b++) {
              diff = 0;
              for (px = 0; px < variants[a].length; px += 4) {
                if (Math.abs(variants[a][px] - variants[b][px]) + Math.abs(variants[a][px + 1] - variants[b][px + 1]) + Math.abs(variants[a][px + 2] - variants[b][px + 2]) > 60) { diff++; }
              }
              ok(diff > 64 * 64 * 0.015, 'T3d ' + SHAPES[i].id + ' 向き' + a + 'と' + b + ' の差=' + diff);
            }
          }
        }
        /* T4 しるし 全部 描ける */
        for (i = 0; i < MARK_NAMES.length; i++) {
          for (j = 0; j < MARKS[MARK_NAMES[i]].period; j++) {
            try { ctx.save(); drawMark(ctx, MARK_NAMES[i], j, 20); ctx.restore(); ok(true, 'T4'); } catch (e) { ok(false, 'T4 ' + MARK_NAMES[i] + ' ' + e); }
          }
        }
        for (i = 0; i < 4; i++) { try { drawStage(ctx, 60, i, PICS[0].id); ok(true, 'T4 stage'); } catch (e2) { ok(false, 'T4 stage ' + i + ' ' + e2); } }
      }

    /* T5 はっぱと せいちょう */
    s = freshState();
    events = addLeaves(s, 5); ok(events.length === 0 && stageOf(s.cLeaves) === 0, 'T5 5まいは たまごのまま');
    events = addLeaves(s, 1); ok(events.length === 1 && events[0].kind === 'stage' && events[0].stage === 1, 'T5 6まいで ようちゅう');
    events = addLeaves(s, 18); ok(s.zukan.length === 1 && s.zukan[0] === PICS[0].id && s.cLeaves === 0 && s.cIndex === 1, 'T5 24まいで ずかんへ');
    ok(events[0].kind === 'adult', 'T5 adult イベント');
    events = addLeaves(s, 24 * 5 + 3); ok(s.zukan.length === 6 && s.lap === 1 && s.cLeaves === 3 && s.cIndex === 6, 'T5 6ひきで 1しゅう');
    ok(rankOf(0) === 'くるくる みならい' && rankOf(20) === 'くるくる なかま' && rankOf(250) === 'くるくる たつじん', 'T5 かんむり');
    ok(nextRankAt(0) === 20 && nextRankAt(200) === null, 'T5 つぎの かんむり');
    ok(questionText({ type: 'turn', dir: 'hidari', times: 2, wording: 'dir' }) === 'ひだりに 2かい まわすと どれ？', 'T5 もんだい文');
    ok(arrowSvg('hidari').indexOf('scale(-1,1)') > 0 && arrowSvg('migi').indexOf('scale(-1,1)') < 0, 'T5 やじるしの向き');
    /* やじるし＝4ぶんの1（90度）の 弧。大きい弧（180度より大きい）の しるし「1 1」を 使わない */
    ok(arrowSvg('migi').indexOf('A 16 16 0 0 1') > 0 && arrowSvg('migi').indexOf(' 0 1 1 ') < 0, 'T6 やじるしは 90度の 弧');

    /* T6 おと＝ならびの 中身が ただしい・音が出せない ときも とまらない */
    (function () {
      var name, seq, i, n, bad = 0, types = { sine: 1, square: 1, triangle: 1 }, keep = snd.ctx;
      for (name in SOUNDS) {
        if (!SOUNDS.hasOwnProperty(name)) { continue; }
        seq = SOUNDS[name];
        for (i = 0; i < seq.length; i++) {
          n = seq[i];
          if (!NOTE[n[0]] || !(n[1] >= 0) || !(n[2] > 0) || !(n[3] > 0 && n[3] <= 1) || !types[n[4]]) { bad++; }
        }
      }
      ok(bad === 0, 'T6 おとの ならび（おんぷ・ながさ・おおきさ・かたち）');
      ok(NOTE[SOUNDS.count1[0][0]] < NOTE[SOUNDS.count2[0][0]] && NOTE[SOUNDS.count2[0][0]] < NOTE[SOUNDS.count3[0][0]], 'T6 1かい→3かいで だんだん たかく');
      snd.ctx = null;
      ok(snd.play('ok') === false && snd.sweep(0.5) === false, 'T6 おとの しくみが ない ときは ならさず とまらない');
      snd.ctx = keep;
    })();

    KZ.seed(null);
    out.unshift('PASS=' + pass + ' FAIL=' + fail);
    return out;
  };

  global.KZ = KZ;
})(typeof window !== 'undefined' ? window : this);
