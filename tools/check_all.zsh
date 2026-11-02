# くるくる ずけい ── 公開前の検査をまとめて回す（CCが使う。しげ用のスクリプトは push.zsh）
#   1 組み立て  2 古い書き方  3 字の在庫と漢字  4 ホーム画面の絵  5 自己点検（本物のブラウザで src/app.js を実行）
#   6 iPad よこおきの 1がめん（無音の複製で）  7 公開物に書かない語
# 置き場所はこのファイルから決める（別のアプリへ写しても、写した先を検査する）
# 終了コード 0=全部PASS / 1=どれか不合格
ROOT="${0:A:h:h}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
LOG="$ROOT/logs/check_$(date +%Y%m%d_%H%M%S).log"
FAILFILE="$ROOT/logs/.check_fail"
mkdir -p "$ROOT/logs"
rm -f "$FAILFILE"
{
print "== 0/7 検査する場所＝$ROOT =="
print "== 1/7 組み立て =="
/usr/bin/python3 "$ROOT/tools/build_app.py" || touch "$FAILFILE"
print "== 2/7 古い書き方だけか（src/app.js・src/ui.js・index.html） =="
/usr/bin/python3 "$ROOT/tools/check_es5.py" --selftest || touch "$FAILFILE"
/usr/bin/python3 "$ROOT/tools/check_es5.py" "$ROOT/src/app.js" "$ROOT/src/ui.js" "$ROOT/index.html" || touch "$FAILFILE"
print "== 3/7 字の在庫（絵文字なし）と 子どもの画面の漢字 =="
/usr/bin/python3 "$ROOT/tools/check_chars.py" "$ROOT/index.html" "$ROOT/README.md" || touch "$FAILFILE"
/usr/bin/python3 "$ROOT/tools/check_kana.py" --selftest || touch "$FAILFILE"
/usr/bin/python3 "$ROOT/tools/check_kana.py" || touch "$FAILFILE"
print "== 4/7 ホーム画面の絵 =="
/usr/bin/python3 "$ROOT/tools/make_icon.py" --check || touch "$FAILFILE"
print "== 5/7 自己点検（ブラウザで実行・画面つきの 項目 K26・K30 は 無音の複製の 中で） =="
/usr/bin/python3 "$ROOT/tools/mkpage.py" || touch "$FAILFILE"
TMP="$ROOT/logs/selftest_dom.html"
"$CHROME" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --virtual-time-budget=20000 \
  --dump-dom "file://$ROOT/tools/test.html" > "$TMP" 2>/dev/null
RESULT=$(/usr/bin/python3 "$ROOT/tools/read_selftest.py" "$TMP")
print -r -- "$RESULT"
print -r -- "$RESULT" | head -1 | grep -q '^PASS=[0-9]* FAIL=0$' || touch "$FAILFILE"
print "== 6/7 iPad よこおきで 1がめんに おさまるか（1024×640・ぜんぶの がめん・無音の複製で）と 制限時間 =="
/usr/bin/python3 "$ROOT/tools/mkpage.py" --selftest || touch "$FAILFILE"
/usr/bin/python3 "$ROOT/tools/mkpage.py" || touch "$FAILFILE"
FIT=$("$CHROME" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --virtual-time-budget=20000 \
  --dump-dom "file://$ROOT/tools/fit_check.html#size=1024x640" 2>/dev/null | sed -n '/<pre id="out">/,/<\/pre>/p' | sed -e 's/<pre id="out">//' -e 's/<\/pre>//')
print -r -- "$FIT"
# 合格は「FIT=PASS」だけの行（検査ページの中の文字には一致させない）
print -r -- "$FIT" | grep -qx 'FIT=PASS' || touch "$FAILFILE"
# 制限時間＝仮想の時計で 本当に 時間を すすめて、じかんぎれ 1回目・2回目・止まる場面を 確かめる（無音の複製で）
TIMER=$("$CHROME" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --virtual-time-budget=200000 \
  --dump-dom "file://$ROOT/tools/timer_check.html" 2>/dev/null | sed -n '/<pre id="out">/,/<\/pre>/p' | sed -e 's/<pre id="out">//' -e 's/<\/pre>//')
print -r -- "$TIMER"
print -r -- "$TIMER" | grep -qx 'TIMER=PASS' || touch "$FAILFILE"
print "== 7/7 公開物に書かない語（受験校・受験番号など） =="
/usr/bin/python3 "$ROOT/tools/check_private.py" --selftest || touch "$FAILFILE"
/usr/bin/python3 "$ROOT/tools/check_private.py" || touch "$FAILFILE"
if [[ -e "$FAILFILE" ]]; then print "== けっか: FAIL =="; else print "== けっか: PASS =="; fi
} 2>&1 | tee "$LOG"
if [[ -e "$FAILFILE" ]]; then rm -f "$FAILFILE"; exit 1; fi
exit 0
