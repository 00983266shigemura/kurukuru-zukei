# くるくる ずけい を GitHub Pages へ公開する台本（しげが1行で実行する。名前は毎回この1つ）
#   中でやること（実行順）
#   1 組み立てと中身の一致  2 公開先の登録  3 取り込みが途中で止まっていないか  4 GitHub に置き場が無ければ作る
#   5 公開先の分を先に取り込む  6 送る  7 送れたか  8 Pages（公開のしくみ）を入れる  9 本番の中身が手元と同じか
#   止まる条件に当たったら その場で終わる（強制上書き・履歴の書き換えはしない）。6より前で止まれば公開は何も変わらない。
#
# ===== 回収プロローグ（ここから・変更しない）=====
RUN_ID="kurukuru_$(date +%Y%m%d_%H%M%S)"
LOG_DIR="${KZ_LOG_DIR:-/Users/shigemurasatoshi/dev/kurukuru-zukei/logs}"
mkdir -p "$LOG_DIR"
LOG="${LOG_DIR}/run_${RUN_ID}.log"
setopt noclobber
if ! { : > "$LOG" } 2>/dev/null; then
  if [[ -e "$LOG" ]]; then
    print -u2 "この台本は実行済みです（run_id=${RUN_ID}）。二重実行を防ぐため何もせず終了します。"
    exit 0
  else
    print -u2 "ログを作成できません。何も実行せず終了します: ${LOG}"
    exit 78
  fi
fi
unsetopt noclobber
exec 3>&1 4>&2
exec > >(tee -a "$LOG") 2>&1
trap 'rc=$?; exec 1>&3 2>&4; sleep 0.3; print -r -- "END run_id=${RUN_ID} exit=${rc}" >> "$LOG"' EXIT
print -r -- "BEGIN run_id=${RUN_ID}"
# ===== 回収プロローグ（ここまで）=====

# 試験のときだけ環境変数で差し替える。本番は既定値のまま。
GIT="${KZ_GIT:-/usr/bin/git}"
GH="${KZ_GH:-/Users/shigemurasatoshi/dev/tools/gh_2.97.0_macOS_arm64/bin/gh}"
CURL="${KZ_CURL:-/usr/bin/curl}"
REPO_DIR="${KZ_REPO_DIR:-/Users/shigemurasatoshi/dev/kurukuru-zukei}"
OWNER="00983266shigemura"
NAME="kurukuru-zukei"
R="${OWNER}/${NAME}"
ORIGIN_URL="${KZ_ORIGIN_URL:-https://github.com/${R}.git}"
PAGES_URL="${KZ_PAGES_URL:-https://${OWNER}.github.io/${NAME}/}"
WAIT="${KZ_WAIT:-10}"
TRIES="${KZ_TRIES:-30}"

stop() { print "✕ 中止：$1"; print "（ここで止めました。結果はCCが読みます）"; exit 1; }

print "== 1/9 組み立てと中身の一致 =="
/usr/bin/python3 "${REPO_DIR}/tools/build_app.py" > /dev/null || stop "組み立てに失敗しました（何も公開していません）"
DIRTY="$("$GIT" -C "$REPO_DIR" status --porcelain)" || stop "中身の見比べができませんでした"
if [[ -n "$DIRTY" ]]; then
  print "----"; print -r -- "$DIRTY"; print "----"
  stop "部品と ページ が食い違っています（または未保存の直しがあります）。上の行をCCへ貼ってください"
fi
[[ "$("$GIT" -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)" == "main" ]] || stop "作業中の枝が main ではありません"
LOCAL_MD5="$(/sbin/md5 -q "${REPO_DIR}/index.html")"
print "✓ 一致（index.html md5=${LOCAL_MD5}）"

print "== 2/9 公開先の登録 =="
if "$GIT" -C "$REPO_DIR" remote get-url origin > /dev/null 2>&1; then
  NOW="$("$GIT" -C "$REPO_DIR" remote get-url origin)"
  [[ "$NOW" == "$ORIGIN_URL" ]] || stop "登録されている公開先（${NOW}）が台本の知っている場所（${ORIGIN_URL}）と違います"
  print "✓ 登録ずみ＝${NOW}"
else
  "$GIT" -C "$REPO_DIR" remote add origin "$ORIGIN_URL" || stop "公開先を登録できませんでした"
  print "✓ 登録しました＝${ORIGIN_URL}"
fi

print "== 3/9 取り込みが途中で止まっていないか =="
if [[ -d "$REPO_DIR/.git/rebase-merge" || -d "$REPO_DIR/.git/rebase-apply" || -f "$REPO_DIR/.git/MERGE_HEAD" ]]; then
  stop "取り込みが途中で止まっています。何もせず中止します"
fi
print "✓ 止まっていません"

print "== 4/9 GitHub に置き場が無ければ作る（公開・空） =="
if "$GH" repo view "$R" --json name > /dev/null 2>&1; then
  print "✓ 置き場は あります＝${R}"
else
  "$GH" repo create "$R" --public --description "かたちを まわすと どう見える？ 年長向けの 回転図形の あそび" > /dev/null || stop "置き場を作れませんでした"
  print "✓ 置き場を作りました＝${R}"
fi

print "== 5/9 公開先の分を先に取り込む =="
if [[ -z "$("$GIT" -C "$REPO_DIR" ls-remote --heads origin main 2>/dev/null)" ]]; then
  print "✓ 公開先にはまだ何もありません＝取り込みは要りません"
else
  if ! "$GIT" -C "$REPO_DIR" pull --rebase origin main; then
    "$GIT" -C "$REPO_DIR" rebase --abort
    stop "取り込みでぶつかったので元へ戻しました。何も反映していません"
  fi
  print "✓ 取り込みました"
fi

print "== 6/9 送る =="
"$GIT" -C "$REPO_DIR" push -u origin main || stop "送信に失敗しました（公開は変わっていません）"

print "== 7/9 送れたか =="
"$GIT" -C "$REPO_DIR" fetch origin main > /dev/null 2>&1
LOCAL="$("$GIT" -C "$REPO_DIR" rev-parse HEAD)"
REMOTE="$("$GIT" -C "$REPO_DIR" rev-parse origin/main)"
[[ "$LOCAL" == "$REMOTE" ]] || stop "手元（${LOCAL}）と公開先（${REMOTE}）が一致しません"
print "✓ 手元＝公開先＝${LOCAL}"

print "== 8/9 Pages（公開のしくみ）を入れる =="
if "$GH" api "repos/${R}/pages" --jq .html_url > /dev/null 2>&1; then
  print "✓ Pages は入っています"
else
  "$GH" api -X POST "repos/${R}/pages" -f 'source[branch]=main' -f 'source[path]=/' > /dev/null || stop "Pages を入れられませんでした"
  print "✓ Pages を入れました（枝 main・場所 /）"
fi

print "== 9/9 本番の中身が手元と同じか（最大 $((WAIT*TRIES)) 秒 待つ） =="
LIVE=""
for i in $(seq 1 "$TRIES"); do
  LIVE="$("$CURL" -s -f "${PAGES_URL}index.html?check=${RUN_ID}" | /sbin/md5 -q)"
  [[ "$LIVE" == "$LOCAL_MD5" ]] && break
  sleep "$WAIT"
done
[[ "$LIVE" == "$LOCAL_MD5" ]] || stop "本番の index.html（${LIVE}）が手元（${LOCAL_MD5}）と一致しません。配信にもう少し時間がかかっている可能性があります＝CCが確認します"
ICON="$("$CURL" -s -o /dev/null -w '%{http_code}' "${PAGES_URL}icon.png?check=${RUN_ID}")"
[[ "$ICON" == "200" ]] || stop "本番に icon.png がありません（${ICON}）"
print "✓ 本番 index.html md5=${LIVE}（手元と一致）・icon.png=200"
print ""
print "iPad で開く場所＝ ${PAGES_URL}"
print "== 完了：合格（残りの確認はCCが行います） =="
exit 0
