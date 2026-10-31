#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""くるくる ずけい ── 2012年の iPad に無い字（絵文字など）が混ざっていないかを見る。

考え方＝許可した字だけを通す（default-deny）。
  ・ASCII・ひらがな・カタカナ・漢字・全角記号は通す
  ・それ以外（記号の帯 U+2000〜）は、下の ALLOW にある符号位置だけ通す
  ・絵文字の帯（U+1F000 以上）は一切通さない
新しい記号を使いたくなったら ALLOW へ意識して足す＝そこで世代を確かめる。

使い方＝ python3 tools/check_chars.py ファイル…   終了コード 0=PASS / 1=FAIL
"""
import io
import sys
import unicodedata

ALLOW = {
    0x2013: '– Unicode1.1', 0x2014: '— Unicode1.1', 0x2015: '― Unicode1.1', 0x2018: '‘', 0x2019: '’',
    0x201C: '“', 0x201D: '”', 0x2026: '… Unicode1.1', 0x2030: '‰',
    0x2190: '←', 0x2191: '↑', 0x2192: '→', 0x2193: '↓', 0x21BA: '↺', 0x21BB: '↻',
    0x2212: '−', 0x2460: '①', 0x2461: '②', 0x2462: '③', 0x2463: '④', 0x2464: '⑤',
    0x25A1: '□', 0x25B3: '△', 0x25CB: '○', 0x25CF: '●', 0x2605: '★ Unicode1.1', 0x2606: '☆ Unicode1.1',
    0x2713: '✓ Unicode1.1', 0x2715: '✕ Unicode1.1', 0x2733: '✳',
    0xFE0F: '異体字セレクタ',
}


def ok_char(ch):
    o = ord(ch)
    if o < 0x2000:
        return True
    if 0x3000 <= o <= 0x30FF:      # 句読点・ひらがな・カタカナ
        return True
    if 0x4E00 <= o <= 0x9FFF:      # 漢字
        return True
    if 0xFF00 <= o <= 0xFFEF:      # 全角英数・記号
        return True
    return o in ALLOW


def main():
    bad_total = 0
    for path in sys.argv[1:]:
        src = io.open(path, encoding='utf-8').read()
        hits = {}
        for i, ch in enumerate(src):
            if not ok_char(ch):
                line = src.count('\n', 0, i) + 1
                hits.setdefault(ch, []).append(line)
        if hits:
            bad_total += len(hits)
            print('✕ %s ＝ %d種類' % (path, len(hits)))
            for ch, lines in sorted(hits.items()):
                try:
                    name = unicodedata.name(ch)
                except ValueError:
                    name = '?'
                print('    U+%04X %s  %s  行=%s' % (ord(ch), ch, name, ','.join(str(x) for x in lines[:5])))
        else:
            print('✓ %s ＝ 許可した字だけ' % path)
    print('合計 = %d種類 → %s' % (bad_total, 'PASS' if bad_total == 0 else 'FAIL'))
    sys.exit(0 if bad_total == 0 else 1)


if __name__ == '__main__':
    main()
