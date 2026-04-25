#!/usr/bin/env bash
# Stop the two-node AXL mesh.

set -euo pipefail

cd "$(dirname "$0")"

for role in coach synth; do
  pidfile="logs/${role}.pid"
  if [[ -f "$pidfile" ]]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo "[${role}]  stopped pid $pid"
    fi
    rm -f "$pidfile"
  fi
done

# Belt + braces · catch anything started outside this script
remaining=$(pgrep -f "axl/node" || true)
if [[ -n "$remaining" ]]; then
  echo "Killing leftover AXL processes: $remaining"
  echo "$remaining" | xargs kill 2>/dev/null || true
fi
