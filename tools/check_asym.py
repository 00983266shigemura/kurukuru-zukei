#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""くるくる ずけい ── 絵（PNG）が「回しても ひっくり返しても 見分けられる」かを機械で見る。

ChatGPT 等で作った いきものの絵を img/ に置く前に通す。
  ・4回の回転（0・90・180・270度）が 全部ちがう
  ・左右にひっくり返した4つも、回転のどれとも ちがう
ちがいは「画素の 1.5% 以上」（64×64 に縮めて比べる＝app.js の自己点検 T3 と同じ基準）。

使い方＝ python3 tools/check_asym.py img/*.png   終了コード 0=全部PASS / 1=FAIL あり
"""
import sys

from PIL import Image, ImageOps


def variants(im):
    im = im.convert('RGB').resize((64, 64), Image.LANCZOS)
    out = []
    for mirror in (False, True):
        base = ImageOps.mirror(im) if mirror else im
        for k in range(4):
            out.append(base.rotate(-90 * k, expand=False))
    return out


def diff_count(a, b):
    pa, pb = a.load(), b.load()
    n = 0
    for y in range(64):
        for x in range(64):
            c1, c2 = pa[x, y], pb[x, y]
            if abs(c1[0] - c2[0]) + abs(c1[1] - c2[1]) + abs(c1[2] - c2[2]) > 60:
                n += 1
    return n


def main():
    bad = 0
    need = int(64 * 64 * 0.015)
    for path in sys.argv[1:]:
        try:
            im = Image.open(path)
        except Exception as e:
            print('✕ %s ＝ 開けません（%s）' % (path, e))
            bad += 1
            continue
        if im.size[0] != im.size[1]:
            print('✕ %s ＝ 正方形ではありません %s' % (path, im.size))
            bad += 1
            continue
        vs = variants(im)
        worst = None
        for a in range(8):
            for b in range(a + 1, 8):
                d = diff_count(vs[a], vs[b])
                if worst is None or d < worst[0]:
                    worst = (d, a, b)
        if worst[0] > need:
            print('✓ %s ＝ 8とおり 全部ちがう（いちばん近い組の差=%d画素）' % (path, worst[0]))
        else:
            print('✕ %s ＝ 変種%dと%dが ほぼ同じ（差=%d画素・%d以上が必要）' % (path, worst[1], worst[2], worst[0], need + 1))
            bad += 1
    print('合計の不合格 = %d → %s' % (bad, 'PASS' if bad == 0 else 'FAIL'))
    sys.exit(0 if bad == 0 else 1)


if __name__ == '__main__':
    main()
