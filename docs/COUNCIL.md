# Kiln · Council mode

Council lets a student ask the same question to multiple Kiln coaches and watch a synthesizer combine the replies into a single verdict. The synthesis runs on a different process behind the **Gensyn AXL** peer-to-peer mesh, so the work is provably off-orchestrator · the architecture is unchanged whether both nodes are on `127.0.0.1` (the demo box) or on two separate machines on the public internet.

> **Council requires a local AXL mesh.** Convene runs two AXL node binaries on the developer's machine, so the deployed URL cannot reach them. Clone the repo and follow the [Run order locally](#run-order-locally) section below to see it work.

---

## Why a separate process

The whole point of using AXL is to demonstrate that one part of the inference pipeline (the synthesis) lives on a different machine than the orchestrator and is reached only through an encrypted peer mesh. If we ran the synthesis in-process or behind a localhost socket, AXL would be doing nothing useful · the Gensyn prize criteria explicitly disqualify "a centralised message broker replacing what AXL provides."

So Kiln runs **two AXL nodes**: one alongside the Next.js orchestrator, one alongside a standalone synth daemon. The synth process never imports the orchestrator. The orchestrator never imports the synth. They speak only AXL envelopes.

---

## The two nodes

| Node  | API bridge          | Holds                                                  |
|-------|---------------------|--------------------------------------------------------|
| coach | `127.0.0.1:9102`    | The Next orchestrator on the same machine talks to it |
| synth | `127.0.0.1:9112`    | A standalone synth daemon (`pnpm council:synth`)      |

Each node has a persistent ed25519 keypair · its peer id is the hex of the public key. Messages are JSON envelopes `{ kind, queryId, payload }` shipped through the encrypted Yggdrasil + gVisor TCP transport that AXL provides.

Configs live in `axl/coach.config.json` and `axl/synth.config.json`. Each lists the other as a `peer` so they discover each other on boot.

---

## End-to-end of one Convene click

1. Browser POSTs `{ tokenIds, question }` to `/api/council`.
2. The route reads each picked iNFT's persona from `dataDescriptions[0]` on chain and runs inference per coach against 0G Compute in parallel.
3. The route packs the per-coach replies into one envelope of kind `council/synthesize` and ships it to the synth peer over `coach.localhost:9102/send`.
4. `web/src/server/council-synth-worker.ts`, polling `synth.localhost:9112/recv` in a separate process, picks the envelope up, runs a synthesis prompt against 0G Compute (Qwen 2.5 7B) that asks for a 6-sentence verdict ending with `Verdict: …`.
5. The synth worker ships a `council/result` envelope back over `synth.localhost:9112/send` to the coach peer id.
6. The orchestrator's long-poll on `coach.localhost:9102/recv` matches the `queryId` and returns both the per-coach replies and the synthesized verdict to the browser.

The synthesis call **never** appears in the orchestrator's process · it lands in the synth worker, which only knows how to reach the orchestrator through AXL's mesh routing. There is no shared Redis, no localhost socket, no shared database. Move the synth machine to another datacenter and only the AXL `Peers` config changes.

---

## Run order locally

Three terminals, in this order.

### Terminal 1 · boot the AXL mesh

```bash
cd axl && ./start.sh
```

What this does:

- Builds the AXL Go binary if it does not exist (one-time, requires Go 1.25.5+)
- Generates ed25519 keypairs for the coach and synth nodes if they do not exist (one-time, written to `axl/keys/`)
- Starts both nodes on the configured ports
- Tails their logs to a single terminal so you can watch the handshake

Confirm the handshake with:

```bash
curl -s http://127.0.0.1:9102/topology
curl -s http://127.0.0.1:9112/topology
```

Both should list two peers (self + the other node).

### Terminal 2 · synth daemon

```bash
cd web && pnpm council:synth
```

This starts `web/src/server/council-synth-worker.ts`, which long-polls `synth.localhost:9112/recv` waiting for envelopes. It runs as a regular Node process, not as a Next.js route · that is the whole point.

You should see `[synth] listening on synth.localhost:9112` in the log. If it complains about Compute credentials, check that `web/.env.local` has `KILN_OPS_PK` set.

### Terminal 3 · the Next.js app

```bash
cd web && pnpm dev
```

Visit `http://localhost:3000/council`. The local-only notice card sits at the top. Below it, pick 2 or 3 coaches, type a question, click **Convene**.

You should see four phases stream by in the loading affordance:

1. `inference` · per-coach replies running against 0G Compute
2. `mesh` · envelope handed to AXL
3. `synthesis` · the synth worker is doing its thing
4. `done` · per-coach replies + verdict displayed

---

## Troubleshooting

**`council:synth` exits immediately with `cannot reach synth.localhost`.**
The AXL mesh isn't up. Run `cd axl && ./start.sh` first and wait for both `topology` calls to return two peers each.

**Convene hangs at `mesh` phase.**
The synth worker either isn't running or can't reach 0G Compute. Check terminal 2 for errors. The most common cause is `KILN_OPS_PK` missing or the ledger having insufficient funds.

**Convene hangs at `synthesis` phase.**
0G Compute returned a response but the orchestrator never saw it via AXL. Most likely cause: one of the AXL nodes died. Check terminal 1's log; restart `./start.sh` if needed.

**Verdict cuts off mid-sentence.**
The synth prompt asks for "6 sentences ending with `Verdict:`". If the model refuses or returns fewer sentences, the synth worker still returns whatever it got · this is intentional so the UI is never blank.

**It works locally but I want to deploy it.**
You'd need to run the synth worker on a separate host with a public-routable AXL node, then update both `axl/coach.config.json` and `axl/synth.config.json` to reference the new public peer addresses. The application code does not change. We chose not to ship a hosted synth for the demo because the prize criteria emphasize "across separate AXL nodes, not just in-process" and the local two-node setup demonstrates that without operational complexity.

---

## Why this is the right shape for a council, not just a multi-call

Three things we get from running synthesis off-process via AXL that we wouldn't get from `Promise.all`-ing three inference calls:

1. **Provable separation.** A judge or auditor can read the topology and confirm that the synthesis tx came from a different peer id than the orchestrator. With in-process synthesis there is no such evidence.
2. **Pluggable synth providers.** Tomorrow, `synth` could be a different model (a stronger judge), a different wallet (a paid arbiter), or a different machine entirely. The orchestrator does not change.
3. **Failure isolation.** If the synth process crashes mid-Convene, the orchestrator's long-poll times out and it returns the per-coach replies without a verdict. The student still gets value; only the synthesis layer is degraded.

These are the same arguments AXL makes for itself, applied to the smallest interesting unit of agent coordination · multi-coach Q&A with a meta-judge.
