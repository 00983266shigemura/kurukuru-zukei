# くるくる ずけい ── 公開前の検査をまとめて回す（CCが使う。しげ用の台本は push.zsh）
#   1 組み立て  2 古い書き方  3 字の在庫  4 ホーム画面の絵  5 自己点検（本物のブラウザで src/app.js を実行）
# 終了コード 0=全部PASS / 1=どれか不合格
ROOT="/Users/shigemurasatoshi/dev/kurukuru-zukei"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
LOG="$ROOT/logs/check_$(date +%Y%m%d_%H%M%S).log"
FAILFILE="$ROOT/logs/.check_fail"
mkdir -p "$ROOT/logs"
rm -f "$FAILFILE"
{
print "== 1/5 組み立て =="
/usr/bin/python3 "$ROOT/tools/build_app.py" || touch "$FAILFILE"
print "== 2/5 古い書き方だけか（src/app.js・src/ui.js・index.html） =="
/usr/bin/python3 "$ROOT/tools/check_es5.py" "$ROOT/src/app.js" "$ROOT/src/ui.js" "$ROOT/index.html" || touch "$FAILFILE"
print "== 3/5 字の在庫（絵文字なし） =="
/usr/bin/python3 "$ROOT/tools/check_chars.py" "$ROOT/index.html" "$ROOT/README.md" || touch "$FAILFILE"
print "== 4/5 ホーム画面の絵 =="
/usr/bin/python3 "$ROOT/tools/make_icon.py" --check || touch "$FAILFILE"
print "== 5/5 自己点検（ブラウザで実行） =="
TMP="$ROOT/logs/selftest_dom.html"
"$CHROME" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --virtual-time-budget=20000 \
  --dump-dom "file://$ROOT/tools/test.html" > "$TMP" 2>/dev/null
RESULT=$(/usr/bin/python3 "$ROOT/tools/read_selftest.py" "$TMP")
print -r -- "$RESULT"
print -r -- "$RESULT" | head -1 | grep -q '^PASS=[0-9]* FAIL=0$' || touch "$FAILFILE"
if [[ -e "$FAILFILE" ]]; then print "== けっか: FAIL =="; else print "== けっか: PASS =="; fi
} 2>&1 | tee "$LOG"
if [[ -e "$FAILFILE" ]]; then rm -f "$FAILFILE"; exit 1; fi
exit 0
