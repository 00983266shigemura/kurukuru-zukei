# -*- coding: utf-8 -*-
"""試験用・目視用の複製ページを作る唯一の道具（くるくる ずけい）。

なぜ（しげ指示 2026-09-16・原文のまま）:
  「裏側でアプリをテストするときに効果音が鳴らないようにして。
    これに限らず、すべてのテストで同じようにして。」

考え方:
  鳴った音をあとで止めるのではなく、鳴らないページしか作れないようにする。
  CCがブラウザで開いてよいのは、この道具が作った複製だけ（index.html を直接開かない）。

無音化のしくみ（index.html 本体には触らない）:
  アプリの音は必ず AudioContext（古い iPad では webkitAudioContext）を作るところを通る。
  その入口を「使うと例外になる」形へ差し替える。アプリ側は try で囲んでいるので、
  あそびは止まらず、音の しくみだけが作られない。
  あとで音を足しても、入口が同じなので自動的に無音になる。

無音の確かめ方:
  window.__audioAsked＝音の入口を作ろうとした回数（0より大きい＝塞ぎが効いた証拠）。
  KZ.snd.ctx が null のまま＝音の しくみは作られていない。
  0回は素通りであって無音の証拠にならない（tools/fit_check.html が両方を見る）。

使い方:
  python3 tools/mkpage.py                 （logs/silent_index.html を作る）
  python3 tools/mkpage.py --out <パス>
  python3 tools/mkpage.py --selftest      （目印の無い複製が正しく落ちるか）

終了コード: 0=成功 / 1=失敗
"""
import argparse
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
INDEX = os.path.join(REPO, 'index.html')
DEFAULT_OUT = os.path.join(REPO, 'logs', 'silent_index.html')
ANCHOR = u'<head>'
MARK = u'/* KURUKURU-TESTPAGE-SILENCE v1 */'

SILENCE = u"""<script>
""" + MARK + u"""
/* 無音化（試験用・目視用の複製だけ。公開物には入らない） */
window.__audioAsked = 0;
(function () {
  function blocked() {
    window.__audioAsked++;
    throw new Error('この複製では音を出せません（tools/mkpage.py の無音化）');
  }
  try { window.AudioContext = blocked; } catch (e) {}
  try { window.webkitAudioContext = blocked; } catch (e) {}
  try { window.OfflineAudioContext = blocked; } catch (e) {}
  try { window.Audio = blocked; } catch (e) {}
})();
</script>
"""


def build(src_text):
    if src_text.count(ANCHOR) < 1:
        raise ValueError('index.html に <head> が無い＝無音化を入れる場所が無い')
    out = src_text.replace(ANCHOR, ANCHOR + u'\n' + SILENCE, 1)
    # 複製は logs/ に置くので、img/ などの相対パスは ひとつ上（リポジトリの根）から引く
    out = out.replace(ANCHOR, ANCHOR + u'\n<base href="../">', 1)
    return out


def check(text):
    """無音化の目印が、最初の <script> より前に入っているか"""
    i = text.find(MARK)
    if i < 0:
        return False
    first_app_script = text.find(u'<script', text.find(u'</script>', i))
    return text.find(u'AudioContext = blocked', i) > i and (first_app_script < 0 or first_app_script > i)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=DEFAULT_OUT)
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    with io.open(INDEX, encoding='utf-8') as f:
        src = f.read()
    if a.selftest:
        good = build(src)
        bad = src
        ok1 = check(good)
        ok2 = not check(bad)
        print(u'目印あり＝%s・目印なし＝%s' % (u'合格' if ok1 else u'不合格', u'落ちた' if ok2 else u'通ってしまった'))
        return 0 if (ok1 and ok2) else 1
    out = build(src)
    if not check(out):
        print(u'失敗: 無音化の目印が入っていないので書きません')
        return 1
    d = os.path.dirname(a.out)
    if d and not os.path.isdir(d):
        os.makedirs(d)
    with io.open(a.out, 'w', encoding='utf-8') as f:
        f.write(out)
    print(u'無音の複製を作りました＝%s' % a.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
