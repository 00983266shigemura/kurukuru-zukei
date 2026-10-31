#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""くるくる ずけい ── 古いSafari（iOS 10.3.3）で動く書き方かを機械で見る（つよくなるオセロの道具と同じ）。

2012年のiPadのSafariは新しい書き方（let/const/アロー/テンプレート文字列など）を
読み込んだ時点で止まる＝1文字でも混ざるとファイル全体が動かない（おかえりクエストの実測）。

使い方＝ python3 tools/check_es5.py ファイル…   終了コード 0=PASS / 1=FAIL
"""
import re
import sys

BAD = [
    ("let 宣言", r"(?<![\w.$])let\s+[A-Za-z_$]"),
    ("const 宣言", r"(?<![\w.$])const\s+[A-Za-z_$]"),
    ("アロー関数 =>", r"=>"),
    ("テンプレート文字列 `", r"`"),
    ("class 宣言", r"(?<![\w.$])class\s+[A-Za-z_$]"),
    ("省略記法 ?.", r"\?\."),
    ("省略記法 ??", r"\?\?"),
    ("べき乗 **", r"[^*]\*\*[^*]"),
    ("for...of", r"(?<![\w.$])for\s*\([^)]*\sof\s"),
    ("分割代入 {a} =", r"(?<![\w.$])(var|let|const)\s*[\{\[]"),
    ("Object.assign", r"Object\.assign"),
    ("Array.from", r"Array\.from"),
    ("includes(", r"\.includes\s*\("),
    ("Promise", r"(?<![\w.$])Promise\b"),
    ("Symbol", r"(?<![\w.$])Symbol\b"),
    ("startsWith/endsWith", r"\.(startsWith|endsWith)\s*\("),
    ("Number.isInteger", r"Number\.isInteger"),
    ("padStart/padEnd", r"\.pad(Start|End)\s*\("),
    ("classList.replace", r"classList\.replace"),
    ("fetch(", r"(?<![\w.$])fetch\s*\("),
    # 2026-10-31 追加＝CCメモリ old-ipad-webapp-constraints ①が名指しする「同世代で避けるもの」と、査読で素通りを実測した書き方。
    # 本来は構文解析で既定拒否にしたいが、この Mac に ES5 の構文解析器が無い（node・esprima・jsc なし＝実測）ため、当面は列挙で止める。
    ("展開・残余 ...", r"\.\.\."),
    ("論理代入 ||= &&= ??=", r"(\|\||&&|\?\?)="),
    (".at(", r"\.at\s*\("),
    ("replaceAll", r"\.replaceAll\s*\("),
    ("structuredClone", r"(?<![\w.$])structuredClone\b"),
    ("Object.fromEntries", r"Object\.fromEntries"),
    (".flat( .flatMap(", r"\.flat(Map)?\s*\("),
    ("正規表現の後読み・名前つき (?<", r"\(\?<"),
    ("数字の区切り 1_000", r"(?<![\w$])\d+_\d"),
    ("async await", r"(?<![\w.$])(async\s+function|async\s*\(|await\s)"),
    ("catch の省略 catch {", r"catch\s*\{"),
    ("クラスの # 欄", r"(?<![\w$])#[A-Za-z_$]"),
]

# 検査が効くかの確かめ用＝1行に1つ、止めるべき書き方を並べる（--selftest で全部見つかること）
SELFTEST_BAD = [
    "let a = 1;", "const b = 2;", "var f = (x) => x;", "var s = `t`;", "class A {}",
    "var c = o?.p;", "var d = o ?? 1;", "var e = 2 ** 3;", "for (var k of l) {}", "var {x} = o;",
    "Object.assign({}, o);", "Array.from(l);", "l.includes(1);", "Promise.resolve();", "Symbol('x');",
    "s.startsWith('a');", "Number.isInteger(1);", "s.padStart(2);", "el.classList.replace('a', 'b');", "fetch('u');",
    "var g = {...o};", "a ||= 1;", "l.at(-1);", "s.replaceAll('a', 'b');", "structuredClone(o);",
    "Object.fromEntries(l);", "l.flat();", "var r = /(?<=a)b/;", "var n = 1_000;", "async function h() {}",
    "try {} catch {}", "var p = this.#q;",
]


def selftest():
    missed = []
    for i, line in enumerate(SELFTEST_BAD):
        src = strip_noise(line)
        if not any(re.search(pat, src) for _, pat in BAD):
            missed.append(line)
    ok_src = strip_noise("var a = 1; function f(x) { return x + 1; } var s = 'let a => ...';")
    false_hit = [name for name, pat in BAD if re.search(pat, ok_src)]
    print("止めるべき書き方 %d件中 見逃し %d件・正しい書き方の誤検知 %d件" % (len(SELFTEST_BAD), len(missed), len(false_hit)))
    for m in missed:
        print("    見逃し: " + m)
    for m in false_hit:
        print("    誤検知: " + m)
    return 0 if not missed and not false_hit else 1


def strip_noise(src):
    """文字列と注釈を空白に置き換える（そこに書かれた記号を拾わないため）"""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append(re.sub(r"[^\n]", " ", src[i:j]))
            i = j
        elif c == "/" and i + 1 < n and src[i + 1] == "/":
            j = src.find("\n", i)
            j = n if j < 0 else j
            out.append(" " * (j - i))
            i = j
        elif c in "'\"":
            j = i + 1
            while j < n and src[j] != c and src[j] != "\n":
                j += 2 if src[j] == "\\" else 1
            j = min(j + 1, n)
            out.append(re.sub(r"[^\n]", " ", src[i:j]))
            i = j
        else:
            out.append(c)
            i += 1
    return "".join(out)


def main():
    bad_total = 0
    for path in sys.argv[1:]:
        with open(path, encoding="utf-8") as fp:
            raw = fp.read()
        if path.endswith(".html"):
            # HTML は <script> の中だけを見る（CSS の #id などを拾わない）。行番号は保つ
            keep = []
            for m in re.finditer(r"<script[^>]*>(.*?)</script>", raw, flags=re.S):
                keep.append((m.start(1), m.end(1)))
            buf = list(re.sub(r"[^\n]", " ", raw))
            for a, b in keep:
                buf[a:b] = list(raw[a:b])
            src = strip_noise("".join(buf))
        else:
            src = strip_noise(raw)
        hits = []
        for name, pat in BAD:
            for m in re.finditer(pat, src):
                line = src.count("\n", 0, m.start()) + 1
                hits.append((line, name, raw.splitlines()[line - 1].strip()[:70]))
        hits.sort()
        if hits:
            bad_total += len(hits)
            print("✕ %s ＝ %d件" % (path, len(hits)))
            for line, name, text in hits:
                print("    %d行目  %s  ：%s" % (line, name, text))
        else:
            print("✓ %s ＝ 古い書き方だけ（%d行）" % (path, raw.count("\n") + 1))
    print("合計の引っかかり = %d件 → %s" % (bad_total, "PASS" if bad_total == 0 else "FAIL"))
    sys.exit(0 if bad_total == 0 else 1)


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    main()
