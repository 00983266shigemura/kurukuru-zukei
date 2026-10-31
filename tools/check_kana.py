# -*- coding: utf-8 -*-
"""子どもの画面に漢字が混ざっていないかを見る（しげ指示 2026-10-15「混入している漢字をひらがな、カタカナ似直して」）。

見る範囲:
  src/template.html の <body> から「おとなのひと」画面の手前まで（コメントとタグは除く）
  src/ui.js と src/app.js の文字列（コメントは除く。app.js は自己点検 KZ.selfTest より前だけ）
大人の画面（おとなのひと）は漢字を使ってよい（しげ指示 2026-09-24「管理画面は計算なし・漢字の大人向け」）。

使い方:  python3 tools/check_kana.py   /  python3 tools/check_kana.py --selftest
終了コード: 0=漢字なし / 1=漢字あり（または検査が効かない）
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
KANJI = re.compile(u'[㐀-䶿一-鿿豈-﫿]')
ADULT_START = u'<!-- ===== おとなのひと'


def read(p):
    with io.open(os.path.join(REPO, p), encoding='utf-8') as f:
        return f.read()


def strip_js_comments(s):
    s = re.sub(r'/\*.*?\*/', lambda m: u'\n' * m.group(0).count(u'\n'), s, flags=re.S)
    return re.sub(r'(^|[^:\'"])//[^\n]*', r'\1', s)


def scan_template(text):
    body = text[text.find(u'<body>'):]
    cut = body.find(ADULT_START)
    if cut < 0:
        raise ValueError(u'おとなのひと画面の目印が見つからない＝範囲を決められない')
    body = body[:cut]
    body = re.sub(r'<!--.*?-->', u'', body, flags=re.S)
    hits = []
    for i, line in enumerate(body.split(u'\n')):
        t = re.sub(r'<[^>]+>', u'', line)
        if KANJI.search(t):
            hits.append(u'template: ' + t.strip())
    return hits


def scan_js(name, text):
    if name.endswith(u'app.js'):
        k = text.find(u'KZ.selfTest = function')
        if k > 0:
            text = text[:k]
    text = strip_js_comments(text)
    hits = []
    for m in re.finditer(r"'([^'\n]*)'", text):
        if KANJI.search(m.group(1)):
            hits.append(name + u': ' + m.group(1))
    return hits


def run(tpl, ui, app):
    return scan_template(tpl) + scan_js(u'src/ui.js', ui) + scan_js(u'src/app.js', app)


def main():
    tpl, ui, app = read('src/template.html'), read('src/ui.js'), read('src/app.js')
    if '--selftest' in sys.argv:
        bad_ui = ui + u"\nvar x = '漢字の まざった ことば';\n"
        bad_tpl = tpl.replace(u'<body>', u'<body>\n<p>見える</p>', 1)
        n1 = len(run(tpl, bad_ui, app)) - len(run(tpl, ui, app))
        n2 = len(run(bad_tpl, ui, app)) - len(run(tpl, ui, app))
        ok = n1 == 1 and n2 == 1
        print(u'漢字を足した文字列＝%s・画面の文＝%s' % (u'見つけた' if n1 == 1 else u'見逃した', u'見つけた' if n2 == 1 else u'見逃した'))
        return 0 if ok else 1
    hits = run(tpl, ui, app)
    for h in hits:
        print(u'✕ 漢字: ' + h)
    print(u'子どもの画面の漢字 = %d件 → %s' % (len(hits), u'PASS' if not hits else u'FAIL'))
    return 0 if not hits else 1


if __name__ == '__main__':
    sys.exit(main())
