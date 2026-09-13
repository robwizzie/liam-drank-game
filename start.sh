#!/usr/bin/env bash
# Serve the cabinet and open it in a browser. No build step, no dependencies
# beyond python3 (or node, as a fallback). Ctrl-C to stop.
#
#   ./start.sh              → first free port from 8080
#   PORT=9000 ./start.sh    → start looking at 9000 instead

set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8080}"
port_busy() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1
  else
    return 1
  fi
}
while port_busy "$PORT"; do
  PORT=$((PORT + 1))
done

URL="http://localhost:$PORT/"

echo
echo "  THE CABINET   $URL"
echo
echo "  space  drink            1-4  switch which player you drive"
echo "  shift  brace            T    back to the 4-player cabinet keys"
echo "  arrows menus            F1   test panel (live ml/sec, fill, empty)"
echo "  esc    pause            ctrl-c here to stop the server"
echo

# open the browser once the server is actually answering
(
  for _ in $(seq 1 50); do
    if curl -sfo /dev/null "$URL" 2>/dev/null; then break; fi
    sleep 0.1
  done
  case "$(uname -s)" in
    Darwin) open "$URL" ;;
    Linux)  xdg-open "$URL" >/dev/null 2>&1 || true ;;
    *)      echo "  open $URL in your browser" ;;
  esac
) &

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes http-server . -p "$PORT" -a 127.0.0.1
else
  echo "need python3 or node (npx) to serve the folder" >&2
  exit 1
fi
