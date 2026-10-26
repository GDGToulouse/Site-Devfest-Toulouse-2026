#!/bin/sh
# Guard for a load test on beta (#690): beta shares the VPS with prod. Polls
# prod's health endpoint and stops every running k6 as soon as prod answers
# slowly or not at all three times in a row.
#
#   sh scripts/load-test/watch-prod.sh            # in a second terminal
#   MAX_SECONDS=1.5 sh scripts/load-test/watch-prod.sh

URL="${PROD_HEALTH_URL:-https://devfesttoulouse.fr/api/health}"
MAX_SECONDS="${MAX_SECONDS:-2}"
INTERVAL="${INTERVAL:-2}"
strikes=0

echo "Watching $URL — k6 is stopped after 3 answers slower than ${MAX_SECONDS}s or failed."
while :; do
  out=$(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 10 "$URL")
  code=${out% *}
  seconds=${out#* }
  slow=$(awk -v t="$seconds" -v m="$MAX_SECONDS" 'BEGIN { print (t > m) ? 1 : 0 }')
  if [ "$code" != "200" ] || [ "$slow" = "1" ]; then
    strikes=$((strikes + 1))
  else
    strikes=0
  fi
  printf '%s prod %s %ss%s\n' "$(date +%H:%M:%S)" "$code" "$seconds" "$([ $strikes -gt 0 ] && echo " (strike $strikes)")"
  if [ $strikes -ge 3 ]; then
    echo "Prod is suffering: stopping k6."
    pkill -INT -x k6 || true
    exit 1
  fi
  sleep "$INTERVAL"
done
