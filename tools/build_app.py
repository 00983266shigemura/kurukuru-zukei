# -*- coding: utf-8 -*-
"""くるくる ずけい ── index.html と offline.appcache を組み立てる唯一の道具。

src/template.html の <!--APP_JS--> に src/app.js、<!--UI_JS--> に src/ui.js を埋め込み、
index.html に書く。あわせて version.txt と app.js の APP_VERSION が一致するかを見て、
offline.appcache（端末にしまうファイルの一覧）を md5 入りで書き直す
（中身が変わるたびに一覧も変わる＝古い版が端末に残り続けない）。

使い方＝ python3 tools/build_app.py        終了コード 0=できた / 1=できなかった
"""
import hashlib
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def read(p):
    return io.open(p, encoding='utf-8').read()


def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()


def main():
    app = read(os.path.join(ROOT, 'src', 'app.js'))
    ui = read(os.path.join(ROOT, 'src', 'ui.js'))
    tpl = read(os.path.join(ROOT, 'src', 'template.html'))
    m = re.search(r'^\s*KZ\.APP_VERSION = (\d+);', app, re.M)
    if not m:
        sys.exit('✕ src/app.js に APP_VERSION の行がありません')
    ver = int(m.group(1))
    vp = os.path.join(ROOT, 'version.txt')
    if not os.path.exists(vp):
        sys.exit('✕ version.txt がありません')
    raw = read(vp).strip()
    if not re.match(r'^\d+$', raw) or int(raw) != ver:
        sys.exit('✕ version.txt（%s）と APP_VERSION（%d）が一致しません' % (raw, ver))
    if '</script' in app or '</script' in ui:
        sys.exit('✕ JS の中に </script が含まれています（埋め込むと壊れる）')
    if tpl.count('<!--APP_JS-->') != 1 or tpl.count('<!--UI_JS-->') != 1:
        sys.exit('✕ template.html の埋め込み印が1つずつではありません')
    html = tpl.replace('<!--APP_JS-->', app.rstrip('\n')).replace('<!--UI_JS-->', ui.rstrip('\n'))
    out = os.path.join(ROOT, 'index.html')
    with io.open(out, 'w', encoding='utf-8', newline='\n') as fp:
        fp.write(html)
    icon = os.path.join(ROOT, 'icon.png')
    if not os.path.exists(icon):
        sys.exit('✕ icon.png がありません（python3 tools/make_icon.py で作る）')
    # ずかん の絵（img/zukan/）は app.js の ZUKAN_IMGS と 名前も数も 同じであること（1枚でも欠けると「?」のまま）
    zdir = os.path.join(ROOT, 'img', 'zukan')
    zfiles = sorted(f for f in os.listdir(zdir) if f.endswith('.png')) if os.path.isdir(zdir) else []
    zids = re.findall(r"\['([a-z_]+)', '[^']+'\]", app.split('var ZUKAN_IMGS')[1].split('];')[0]) if 'var ZUKAN_IMGS' in app else []
    if sorted(i + '.png' for i in zids) != zfiles:
        sys.exit('✕ img/zukan/ の絵（%d枚）と app.js の ZUKAN_IMGS（%d）が合いません' % (len(zfiles), len(zids)))
    zpaths = ['img/zukan/' + f for f in zfiles]
    zsum = hashlib.md5(''.join(md5(os.path.join(ROOT, p)) for p in zpaths).encode('utf-8')).hexdigest()
    manifest = (
        'CACHE MANIFEST\n'
        '# くるくる ずけい はんすう %d\n'
        '# index.html md5 %s\n'
        '# icon.png md5 %s\n'
        '# img/zukan %d files md5 %s\n'
        '\nCACHE:\n./\nindex.html\nicon.png\n%s\n\nNETWORK:\n*\n'
    ) % (ver, md5(out), md5(icon), len(zpaths), zsum, '\n'.join(zpaths))
    with io.open(os.path.join(ROOT, 'offline.appcache'), 'w', encoding='utf-8', newline='\n') as fp:
        fp.write(manifest)
    print('できました ＝ index.html（%d バイト・はんすう %d・md5 %s）・offline.appcache' % (os.path.getsize(out), ver, md5(out)))


if __name__ == '__main__':
    main()
