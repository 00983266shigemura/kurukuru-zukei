# -*- coding: utf-8 -*-
"""自己点検のページ（tools/test.html）をブラウザに描かせた結果（--dump-dom）から、<pre id="out"> の中身を取り出す。"""
import html
import io
import re
import sys

src = io.open(sys.argv[1], encoding='utf-8', errors='replace').read()
m = re.search(r'<div id="out">(.*?)</div>', src, re.S)
if not m:
    print('FAIL=no-output（ブラウザが出力を返しませんでした）')
    sys.exit(1)
print(html.unescape(m.group(1)).strip())
