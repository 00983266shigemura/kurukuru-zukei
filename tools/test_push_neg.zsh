# くるくる ずけい ── push.zsh の「止まる系」の発火試験（通信なし＝4/9 より前で止まる3通り）
#   (a) 未保存の変更がある → 1/9 で止まる
#   (b) 取り込みが途中 → 3/9 で止まる
#   (c) 公開先の登録が違う → 2/9 で止まる
#   試験用の複製を scratchpad に作り、環境変数で台本に差し替えて実行する。本物の repo には触れない。
# 終了コード 0=3通りとも想定どおり止まった / 1=どれかが想定と違う
ROOT="/Users/shigemurasatoshi/dev/kurukuru-zukei"
WORK="${1:-/tmp/kz_push_neg_$$}"
mkdir -p "$WORK/logs"
bad=0
run_case() {
  local name="$1" expect="$2" dir="$3"
  local out
  out="$(KZ_REPO_DIR="$dir" KZ_LOG_DIR="$WORK/logs" KZ_GH=/usr/bin/false zsh "$ROOT/push.zsh" 2>&1)"
  local rc=$?
  if [[ $rc -eq 1 ]] && print -r -- "$out" | grep -q -- "$expect"; then
    print "✓ $name ＝ 想定どおり止まった（$expect）"
  else
    print "✕ $name ＝ 想定と違う（exit=$rc）"; print -r -- "$out" | tail -5; bad=1
  fi
  sleep 1
}
# (a)
rm -rf "$WORK/a"; git clone -q "$ROOT" "$WORK/a" && cp "$ROOT/icon.png" "$WORK/a/icon.png" && print "x" >> "$WORK/a/README.md"
run_case "(a) 未保存の変更" "未保存の直し" "$WORK/a"
# (b)
rm -rf "$WORK/b"; git clone -q "$ROOT" "$WORK/b" && cp "$ROOT/icon.png" "$WORK/b/icon.png" && git -C "$WORK/b" remote set-url origin "https://github.com/00983266shigemura/kurukuru-zukei.git" && mkdir -p "$WORK/b/.git/rebase-merge"
run_case "(b) 取り込みが途中" "取り込みが途中" "$WORK/b"
# (c)
rm -rf "$WORK/c"; git clone -q "$ROOT" "$WORK/c" && cp "$ROOT/icon.png" "$WORK/c/icon.png" && git -C "$WORK/c" remote set-url origin "https://github.com/someone-else/other.git"
run_case "(c) 公開先が違う" "台本の知っている場所" "$WORK/c"
rm -rf "$WORK"
[[ $bad -eq 0 ]] && print "== けっか: PASS（3/3） ==" || print "== けっか: FAIL =="
exit $bad
