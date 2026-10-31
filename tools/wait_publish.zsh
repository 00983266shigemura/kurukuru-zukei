# くるくる ずけい ── しげが push.zsh を実行し終わるのを待ち、ログの END 行と本番の照合値を出す（CCが背景で使う）
#   使い方＝ zsh tools/wait_publish.zsh [待つ秒数（既定1800）]
D="/Users/shigemurasatoshi/dev/kurukuru-zukei/logs"
LIMIT="${1:-1800}"
PAGES_URL="https://00983266shigemura.github.io/kurukuru-zukei/"
n0=$(ls "$D" 2>/dev/null | grep -c '^run_kurukuru_.*\.log$')
t=0
while [ "$t" -lt "$LIMIT" ]; do
  n=$(ls "$D" 2>/dev/null | grep -c '^run_kurukuru_.*\.log$')
  if [ "$n" -gt "$n0" ]; then
    f="$D/$(ls -t "$D" | grep '^run_kurukuru_.*\.log$' | head -1)"
    if grep -q '^END run_id=' "$f"; then
      print "LOG=$f"
      grep '^END run_id=' "$f"
      grep -E '^(✓|✕)' "$f" | tail -12
      LOCAL=$(/sbin/md5 -q /Users/shigemurasatoshi/dev/kurukuru-zukei/index.html)
      LIVE=$(/usr/bin/curl -s -f "${PAGES_URL}index.html?cc=$(date +%s)" | /sbin/md5 -q)
      print "LOCAL_MD5=$LOCAL"
      print "LIVE_MD5=$LIVE"
      [ "$LOCAL" = "$LIVE" ] && print "LIVE_MATCH=yes" || print "LIVE_MATCH=no"
      exit 0
    fi
  fi
  sleep 5
  t=$((t + 5))
done
print "TIMEOUT_NO_RUN"
exit 1
