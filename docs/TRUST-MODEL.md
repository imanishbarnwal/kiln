# Kiln · Trust model

We prefer accuracy over marketing. This page is the careful reader's reference: what is real, what is simplified for the demo, what is honestly out of scope today, and what each ship-it gap costs in the worst case.

If you want the one-liner: **everything that touches your wallet is real on chain; the cryptographic verifier and the executor identity are pragmatic stand-ins that we have planned migrations for.**

---

## The four disclosures

### 1. The training files are not yet used by inference (in the way you might assume)

**What is real.** Files a coach uploads are encrypted in the browser with AES-256-GCM, pinned to 0G Storage, and committed on chain as `dataHashes[0]`. The encrypted artifact is the **tamper-evident provenance** record · nobody can swap it for different content without an on-chain `Updated` event traceable to the owner.

**What is also real.** In parallel with the encrypted upload, the readable text content is chunked into a separate **manifest** stored unencrypted in 0G Storage. That manifest's root hash is committed inside the persona JSON as `ragHash`. The inference route fetches the manifest at chat time, runs **BM25** over the chunks against the student's latest question, and prepends the top-3 retrieved passages to the system prompt as `Reference material from <coach name>'s notebook · cite by [#index] when you use it:`. The coach's own words show up in the conversation, citation included.

**Honest framing.** The encrypted artifact is the **private original** (think lecture-notes-grade · the coach owns the only key). The manifest is the **publicly-readable corpus** (think syllabus-grade · what any verifier can audit). Today they're cousins, not strict twins · the chunked manifest is generated from the same source material the coach uploaded but is intentionally less guarded so retrieval is fast.

**What is not yet real.** No fine-tuning. No LoRA adapters trained on the coach's data. The base model is Qwen 2.5 7B Instruct doing system-prompt-driven role-play, augmented by BM25 retrieval. It is closer to "extremely well-prompted RAG" than to "the coach's personality has been baked into the weights."

**Path to v2.**
1. **Embeddings.** Replace BM25 with dense embeddings via 0G Compute's embedding endpoint when it ships. Better recall on conceptual queries; BM25 stays as the deterministic fallback.
2. **Real fine-tuning.** Kick off a LoRA job on 0G Compute at mint time, store the adapter root in `dataHashes`, load at inference. The iNFT then owns weights, not just a prompt.

### 2. Real on-chain attestation, with a documented bridge

On Aristotle mainnet, `KilnAttestationOracle` enforces ECDSA signatures over extended proof envelopes. Each proof carries:

- A **nonce**, stamped on chain at first use — a successfully verified proof can never be replayed.
- An **expiry**, rejected past clock time, capped at `now + 365 days + 60 second skew window`.
- A **signature** recovered to a trusted-signer address registered by the contract admin.
- A **domain tag** (`KILN_PREIMAGE_V1` or `KILN_TRANSFER_V1`) bound into the signed digest, so a preimage proof can never be replayed as a transfer proof.

ECDSA enforcement uses canonical low-`s` (EIP-2) plus strict `v ∈ {27, 28}` — malleated signatures revert.

The trust anchor is a backend signer registered by `admin.addTrustedSigner(...)` — the same ops wallet that authorizes inference sessions. The chain of custody runs:

```
0G Compute TEE  →  Kiln backend (re-signs)  →  KilnAttestationOracle on chain
```

The on-chain check is mathematically real. The bridge from raw 0G TEE attestation to a Kiln-signed envelope is the backend — that backend is a single point of trust today. Rotating to per-key separation and a decentralized signer set is on the post-hackathon roadmap.

`mockMode` is supported on the oracle but admin-only. On Aristotle the admin calls `lockMainnetMode()` once after deploy; from that point `setMockMode(true)` reverts forever. The flag exists on Galileo testnet to keep the existing demo working without coach-signed proofs.

### 3. The executor is a single server-side wallet

**What is real.** The rent-session inference proxy and the `endSession` settlement both sign from the wallet whose address we store as `KILN_OPS_ADDRESS`. That address must have been authorized via `KilnAgentNFT.authorizeUsage(tokenId, executor)` by the iNFT owner, otherwise the inference route returns `403 executor no longer authorized`. Transfers wipe the authorization, which is what makes "seller provably loses access" actually provable.

**What is the simplification.** It's one wallet. Centralized in operational terms · if it's compromised, an attacker could serve fake inferences for any coach who has authorized it. The contract still protects ownership and payouts; only the inference quality is at risk.

**Migration paths.** Pick one or combine.
- **Coach-self-host.** A coach runs their own inference provider and authorizes their own address. Maximum sovereignty, maximum operational burden on the coach.
- **0G Compute provider network.** Decentralize the executor role across the 0G provider mesh. Coaches authorize a registry contract, the contract attests which providers are valid.
- **TEE attestation chain.** The executor is a pool of attested enclaves; the verifier checks the attestation receipt before accepting an `endSession` tx.

### 4. Sessions are 30 minutes, time-limited client-side

**What is real.** `DEFAULT_SESSION_SECONDS = 30 * 60`. The countdown runs in the browser and the timer state is mirrored on the coach's `/profile` page. When zero hits, the frontend fires `/api/session/end` which calls `KilnMarket.endSession(sessionId, rating)` from the executor wallet · payout splits 90 / 8 / 2 to owner / treasury / ecosystem in a single tx.

**What is fragile.** If every browser tab for an active session is closed before the timer expires, the on-chain settle never happens automatically. The payment stays escrowed in `KilnMarket` until the coach manually settles from `/profile`. So the worst case is "abandoned session leaves coach unpaid until they notice," not "coach gets paid twice" or "payment is lost."

**Migration.** Either:
- Add a contract-level `expiresAt` to each session and a public `forceSettle(sessionId)` anyone can call after expiry. Self-policing.
- Run a server cron that scans `SessionStarted` events and reaps stale ones from the executor wallet. Operationally simpler, still centralized.

---

## What is genuinely on chain (no asterisks)

For the avoidance of doubt, here is the unqualified list.

- The iNFT itself · `KilnAgentNFT` on Galileo, owner enforced by the contract.
- The persona · `dataDescriptions[0]` for every minted token, queryable by anyone via `dataDescriptionsOf(tokenId)`.
- The encrypted artifact's hash · `dataHashes[0]`, the keccak256 of the ciphertext.
- The retrieval manifest's hash · `ragHash` field inside the persona JSON, points to the chunked corpus on 0G Storage.
- Listing state · `KilnMarket.listings(tokenId)`, owner-set pricing.
- Sessions · `KilnMarket.sessions(sessionId)` with student address, paid amount, and settled flag.
- Authorizations · `KilnAgentNFT.authorizedUsersOf(tokenId)`. Wiped on transfer.
- Subnames · `<label>.kiln.eth` records on the Sepolia ENS registry, with `addr` set to the iNFT owner.
- The 90 / 8 / 2 payout split · enforced at the `endSession` and `startLicense` settlement boundaries.

If a feature does not appear in this list, treat it as off-chain and check the disclosure above for context.

---

## How to verify any of this yourself

1. **The persona is on chain.** Open `/chat/<tokenId>` and click the **Intelligence · embedded on 0G Chain** panel. You'll see the contract address, the data hash, and the decoded persona JSON live from the contract.
2. **The executor is one wallet.** Look at `KilnAgentNFT.authorizedUsersOf(tokenId)` for any iNFT. It returns one address. That's our ops wallet.
3. **Sessions are time-limited.** Start a session and inspect `/api/inference/session/[id]` · the route reads the on-chain session state, verifies it's not settled, and pulls the persona from chain on every request.
