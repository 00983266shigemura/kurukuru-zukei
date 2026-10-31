#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""くるくる ずけい ── ホーム画面の絵（icon.png）を作る唯一の道具（つよくなるオセロの道具と同じ型）。

絵の中身＝青い地に、白い カードが すこし かたむいて おかれ、その中に 橙の△と 青の○。
まわりを 白い まわる やじるしが かこむ＝「かたちを まわす」が 一目で分かる。文字は入れない。

大きさ＝180×180。透明を持たない（RGB）＝iOS 10 は透明部分を黒で塗るため。
色は src/template.html と同じ名札（--ao / --daidai / --shiro）。

使い方＝ python3 tools/make_icon.py          ← icon.png を作り直す
         python3 tools/make_icon.py --check  ← 作らずに、今ある icon.png を見るだけ
終了コード＝0（できた）/ 1（できなかった）
"""
import math
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, 'icon.png')

SIZE = 180
SS = 8
AO = (0x00, 0x72, 0xB2)
AO_DARK = (0x00, 0x4c, 0x7a)
DAIDAI = (0xE6, 0x9F, 0x00)
SHIRO = (0xff, 0xfd, 0xf7)
SUMI = (0x1b, 0x1b, 0x1b)


def rot(p, cx, cy, deg):
    a = math.radians(deg)
    x, y = p[0] - cx, p[1] - cy
    return (cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a))


def draw():
    n = SIZE * SS
    im = Image.new('RGB', (n, n), AO)
    d = ImageDraw.Draw(im)
    cx = cy = n / 2.0
    # まわる やじるし（白・太い弧＋三角の先）
    r = n * 0.40
    w = int(n * 0.065)
    d.arc([cx - r, cy - r, cx + r, cy + r], start=200, end=110, fill=SHIRO, width=w)
    tip = rot((cx + r, cy), cx, cy, 110)
    ang = math.radians(110)
    tx, ty = -math.sin(ang), math.cos(ang)   # 進む向き（時計まわり）
    nx, ny = math.cos(ang), math.sin(ang)    # 外向き
    L = n * 0.11
    W = n * 0.085
    tri = [(tip[0] + tx * L, tip[1] + ty * L), (tip[0] + nx * W, tip[1] + ny * W), (tip[0] - nx * W, tip[1] - ny * W)]
    d.polygon(tri, fill=SHIRO)
    # カード（白・すこし かたむき）
    h = n * 0.26
    corners = [(cx - h, cy - h), (cx + h, cy - h), (cx + h, cy + h), (cx - h, cy + h)]
    corners = [rot(p, cx, cy, -12) for p in corners]
    d.polygon(corners, fill=SHIRO, outline=SUMI, width=int(n * 0.012))
    # ますの線（まん中に たて・よこ）
    mid_v = [rot((cx, cy - h), cx, cy, -12), rot((cx, cy + h), cx, cy, -12)]
    mid_h = [rot((cx - h, cy), cx, cy, -12), rot((cx + h, cy), cx, cy, -12)]
    d.line(mid_v, fill=SUMI, width=int(n * 0.008))
    d.line(mid_h, fill=SUMI, width=int(n * 0.008))
    # 橙の△（左上の ます）
    q = h / 2.0
    t = [(cx - q, cy - q - q * 0.7), (cx - q + q * 0.7, cy - q + q * 0.55), (cx - q - q * 0.7, cy - q + q * 0.55)]
    d.polygon([rot(p, cx, cy, -12) for p in t], fill=DAIDAI, outline=SUMI, width=int(n * 0.008))
    # 青の○（右下の ます）
    c = rot((cx + q, cy + q), cx, cy, -12)
    rr = q * 0.6
    d.ellipse([c[0] - rr, c[1] - rr, c[0] + rr, c[1] + rr], outline=AO, width=int(n * 0.03))
    return im.resize((SIZE, SIZE), Image.LANCZOS)


def look(path):
    if not os.path.exists(path):
        return '絵がありません＝' + path
    try:
        with Image.open(path) as im:
            im.verify()
        with Image.open(path) as im:
            if im.size != (SIZE, SIZE):
                return '大きさが %s＝%d×%d でなければなりません' % (im.size, SIZE, SIZE)
            if im.mode != 'RGB':
                return '色の持ち方が %s＝RGB（透明なし）でなければなりません' % im.mode
    except Exception as e:
        return 'こわれています＝' + str(e)
    return ''


def main():
    if '--check' in sys.argv:
        bad = look(OUT)
        if bad:
            sys.exit('✕ ' + bad)
        print('✓ %s ＝ %d×%d・透明なし・こわれていない（%d バイト）' % (OUT, SIZE, SIZE, os.path.getsize(OUT)))
        return
    im = draw()
    im.save(OUT, 'PNG', optimize=True)
    bad = look(OUT)
    if bad:
        sys.exit('書きましたが確かめに落ちました＝' + bad)
    print('できました ＝ %s（%d×%d・%d バイト）' % (OUT, SIZE, SIZE, os.path.getsize(OUT)))


if __name__ == '__main__':
    main()
