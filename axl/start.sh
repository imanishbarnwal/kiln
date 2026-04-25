#!/usr/bin/env bash
# Boot the two-node AXL mesh used by Kiln's Council mode.
#
# Coach node · listens on 9101 (TLS), HTTP bridge on 9102.
# Synth node · peers to coach, HTTP bridge on 9112.
#
# Both nodes hold persistent ed25519 keys (private-coach.pem,
# private-synth.pem) so their peer ids are stable across restarts.
# The peer ids are baked into web/.env.local · regenerate keys only
# if you rotate the env config too.

set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -x ./node ]]; then
  echo "AXL binary missing · build it first:"
  echo "  cd ../vendor/axl && PATH=~/.local/go/bin:\$PATH make build && cp node ../../axl/"
  exit 1
fi

if pgrep -f "axl/node" > /dev/null 2>&1; then
  echo "AXL nodes already running. Stop first with ./stop.sh"
  exit 1
fi

mkdir -p logs
./node -config coach-config.json > logs/coach.log 2>&1 &
COACH_PID=$!
echo $COACH_PID > logs/coach.pid
echo "[coach]  pid $COACH_PID  log axl/logs/coach.log"

# Give the coach a moment to bind its listener before the synth dials in.
sleep 1.5

./node -config synth-config.json > logs/synth.log 2>&1 &
SYNTH_PID=$!
echo $SYNTH_PID > logs/synth.pid
echo "[synth]  pid $SYNTH_PID  log axl/logs/synth.log"

sleep 2
echo
echo "Topology check (coach side):"
curl -sS http://127.0.0.1:9102/topology | python3 -c "
import sys, json
t = json.load(sys.stdin)
print(f'  our  pubkey: {t[\"our_public_key\"]}')
for p in t.get('peers', []):
    print(f'  peer pubkey: {p[\"public_key\"]}  up={p[\"up\"]}')
" || echo "  (topology probe failed · check axl/logs/coach.log)"

echo
echo "Council mesh ready. Next:"
echo "  cd web && pnpm council:synth   # the synth daemon polls /recv"
echo "  cd web && pnpm dev             # the orchestrator route lives in Next"
