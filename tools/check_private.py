# -*- coding: utf-8 -*-
"""公開物に書かない語（受験校・受験番号など）が、公開リポジトリに入っていないかを見る。

なぜ＝小学校受験2027 トラック正本§3「外部に公開しない。受験校・日程は非公開情報として扱う」。
公開リポジトリに一度載ると、消すには履歴の書き換え（しげの事前承認が要る操作）が要る。だから送る前に止める。
守る対象が固有名の有限の集まりなので、ここは列挙で妥当（全ての語の許可一覧は作れない）。

見る範囲＝git が追跡しているファイル全部の中身と、コミットの件名・本文（これから送る分を含む）。
語の一覧＝ /Users/shigemurasatoshi/dev/shige_tools/kid_app_private_words.txt（git に載せない）。一覧が無ければ不合格。

使い方:  python3 tools/check_private.py   /  python3 tools/check_private.py --selftest
終了コード: 0=見つからない / 1=見つかった・一覧が無い・検査が効かない
"""
import io
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
WORDS = '/Users/shigemurasatoshi/dev/shige_tools/kid_app_private_words.txt'


def load_words():
    if not os.path.isfile(WORDS):
        return None
    out = []
    with io.open(WORDS, encoding='utf-8') as f:
        for line in f:
            w = line.split('#', 1)[0].strip()
            if w:
                out.append(w)
    return out


def scan(texts, words):
    hits = []
    for name, text in texts:
        for w in words:
            if w in text:
                hits.append((name, w))
    return hits


def repo_texts():
    files = subprocess.check_output(['git', '-C', REPO, 'ls-files'], universal_newlines=True).split('\n')
    texts = []
    for p in files:
        if not p:
            continue
        full = os.path.join(REPO, p)
        try:
            with io.open(full, encoding='utf-8') as f:
                texts.append((p, f.read()))
        except (UnicodeDecodeError, IOError):
            continue
    log = subprocess.check_output(['git', '-C', REPO, 'log', '--format=%s%n%b'], universal_newlines=True)
    texts.append((u'コミットの件名と本文', log))
    return texts


def main():
    words = load_words()
    if words is None or not words:
        print(u'不合格: 語の一覧がありません（%s）' % WORDS)
        return 1
    if '--selftest' in sys.argv:
        n = len(scan([(u'見本', u'あいう' + words[0] + u'えお')], words))
        print(u'一覧の語を混ぜた見本＝%s' % (u'見つけた' if n == 1 else u'見逃した'))
        return 0 if n == 1 else 1
    hits = scan(repo_texts(), words)
    for name, w in hits:
        print(u'✕ 書かない語「%s」が %s にある' % (w, name))
    print(u'公開物の書かない語 = %d件（一覧 %d語） → %s' % (len(hits), len(words), u'PASS' if not hits else u'FAIL'))
    return 0 if not hits else 1


if __name__ == '__main__':
    sys.exit(main())
