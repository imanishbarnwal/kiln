# AXL · Council mode mesh

Two-node Gensyn AXL setup that powers Kiln's `/council` flow. The Go binary lives in `./node` (gitignored), the persistent ed25519 keys live in `./private-coach.pem` and `./private-synth.pem` (also gitignored), and the configs are committed.

## What runs here

| Node  | TLS listen     | API bridge          | Role                                                          |
|-------|----------------|---------------------|---------------------------------------------------------------|
| coach | `127.0.0.1:9101` | `http://127.0.0.1:9102` | Receives the council orchestrator's outbound envelopes      |
| synth | _none_         | `http://127.0.0.1:9112` | Peers out to coach · runs the synthesis worker on top      |

Both nodes share the default `tcp_port` (`7000`) · AXL's mesh routing assumes peers reach each other on the same gVisor TCP port, so we leave it unset and let the default apply.

## First-time setup

```bash
# 1. Install Go 1.25.5 (any path works; just point Make at it)
curl -sSLO https://go.dev/dl/go1.25.5.darwin-arm64.tar.gz
mkdir -p ~/.local && tar -C ~/.local -xzf go1.25.5.darwin-arm64.tar.gz

# 2. Clone AXL upstream and build the binary
mkdir -p vendor && cd vendor
git clone --depth=1 https://github.com/gensyn-ai/axl.git
cd axl && PATH=~/.local/go/bin:$PATH make build
cp node ../../axl/

# 3. Generate persistent ed25519 keys for both nodes (LibreSSL cannot do
#    ed25519 in genpkey, so we use a tiny Go helper · see scripts/genkey.go
#    in the parent doc, or any Python with the cryptography package).
```

If you rotate the keys, recompute the peer ids and update `web/.env.local`:

```
AXL_COACH_PEER_ID=<hex of coach pubkey>
AXL_SYNTH_PEER_ID=<hex of synth pubkey>
```

## Daily flow

```bash
./start.sh                # boot both nodes, prints peer ids and topology
cd ../web && pnpm council:synth   # synth daemon polls /recv
cd ../web && pnpm dev             # the Next orchestrator route
```

```bash
./stop.sh                 # kill both nodes (looks at logs/*.pid)
```

## Verify the mesh by hand

```bash
COACH=$(cat private-coach.pem | ... )   # see scripts in parent README
SYNTH=$(cat private-synth.pem | ... )

# Send a hello from synth to coach
curl -X POST http://127.0.0.1:9112/send \
  -H "X-Destination-Peer-Id: $COACH" \
  --data 'hello over the mesh'

# Coach drains the envelope
curl -i http://127.0.0.1:9102/recv
```
