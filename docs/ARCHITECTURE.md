# Kiln · Architecture

How Kiln is wired end to end. Three layers of 0G plus a thin Next.js app, glued together by ERC-7857 metadata and a few editorial conventions.

If you only read one diagram, read [the one in the README](../README.md#how-it-works-in-one-diagram). This document is the layer-by-layer expansion.

---

## Table of contents

- [The four primitives](#the-four-primitives)
- [Three on-chain flows](#three-on-chain-flows)
  - [Mint](#mint)
  - [Rent](#rent)
  - [Transfer](#transfer)
- [The single question that matters · how does the chat know who it is?](#the-single-question-that-matters--how-does-the-chat-know-who-it-is)
- [ENS subnames · iNFTs you can name](#ens-subnames--infts-you-can-name)
- [Tech stack](#tech-stack)
- [Smart contracts reference](#smart-contracts-reference)
- [Repo layout](#repo-layout)

---

## The four primitives

| Primitive | What it does | Where it lives |
|---|---|---|
| **0G Storage** | Holds encrypted training artifacts and the BM25 manifest. Returns a Merkle root that the iNFT commits to, so any later tampering is detectable. | `web/src/lib/storage/` |
| **0G Compute** | Runs Qwen 2.5 7B inference inside a TEE. We bill through the broker ledger (one wallet, deposit-then-spend). | `web/src/lib/compute.ts` |
| **0G Chain** | Hosts our three contracts on Galileo (chainId 16602). EVM-compatible, native OG token for gas. | `contracts/src/` |
| **ERC-7857 (iNFT)** | The standard that lets an NFT carry private metadata + an executor authorization list. We commit the persona JSON inside `dataDescriptions[0]`. | `KilnAgentNFT.sol` |

Remove any one and the sovereignty story breaks. Storage gives provenance, Compute gives verifiable inference, Chain gives ownership, iNFT gives the binding.

---

## Three on-chain flows

### Mint

A coach fills out their name, category, blurb, and system prompt on `/onboard`, drops their training files, and clicks **Fire Model**.

1. The browser generates a 256-bit AES-GCM key, encrypts the files client-side, and uploads the ciphertext to 0G Storage via `@0gfoundation/0g-ts-sdk`. A Merkle root comes back.
2. The browser computes `sha256(ciphertext)` and serializes the persona as JSON.
3. The coach's wallet signs `KilnAgentNFT.mint(proofs, dataDescriptions, to)` where:
   - `proofs[0]` = the signed envelope (`abi.encode(dataHash, nonce, expiry, signature)`). On Galileo, mockMode accepts a placeholder signature; on Aristotle, the signature is verified against the trusted-signer registry.
   - `dataDescriptions[0]` = the persona JSON blob, prefixed with `kiln:v1:`
4. The token ends up in the coach's wallet. The persona is now public, tamper-evident, and readable by anyone on chain.

### Rent

On `/chat/[tokenId]`, a student hits **Start session**.

1. `KilnMarket.startSession{value: pricePerSession}(tokenId)` runs. Payment sits in contract escrow. A `SessionStarted` event fires.
2. Client starts a 30-minute countdown, persists the start timestamp in `sessionStorage`.
3. On each chat message, the client POSTs to `/api/inference/session/:id`. The server:
   - Reads the session on chain (must exist, must not be settled)
   - Reads `KilnAgentNFT.isAuthorized(tokenId, executor)` (wiped on transfer, so a post-transfer call 403s)
   - Reads `KilnAgentNFT.dataDescriptionsOf(tokenId)` to pull the persona
   - Prepends the system prompt, streams through 0G Compute (Qwen 2.5 7B in a TEE)
   - Pipes the SSE response back to the browser token by token
4. When the timer hits 0 (or the student clicks **End session**), the frontend pings `/api/session/end`. Our ops wallet, the configured executor, signs `KilnMarket.endSession(sessionId, rating)`. Payout splits **90 / 8 / 2** to owner / treasury / ecosystem, all in a single tx.
5. A coach looking at `/profile` sees the same live timer on their iNFT's row, including the student's short address. Auto-settle is idempotent, so whichever page (coach's or student's) hits 0:00 first is the one that broadcasts the settle tx.

### Transfer

The owner calls `KilnAgentNFT.transfer(to, tokenId, proofs)` from their wallet.

1. Our TEE proof-builder route `/api/transfer/proof` produces a `proofs[]` encoded as `abi.encode(bytes32 oldHash, bytes32 newHash, address receiver, bytes16 sealedKey)`.
2. The on-chain verifier returns `isValid = true`, the contract swaps owner, sets the new dataHash, and **wipes the `authorizedUsers` array**.
3. Result: the old owner's executor is no longer authorized. Any request against any prior session for this token now returns **403 executor no longer authorized for this iNFT**. Loss-of-access is provable without running a single test script · just read the contract.

---

## The single question that matters · how does the chat know who it is?

When you chat with **GM Alina Volkov** (iNFT #3), the underlying model is **not fine-tuned** on chess. It is Qwen 2.5 7B Instruct · a general-purpose instruction-following model running inside a 0G Compute TEE. What makes it reply like Alina instead of like Aarav is two things, both committed on chain:

1. The **system prompt** stored in `dataDescriptions[0]`, which sets her voice, register, and teaching style.
2. The coach's **uploaded notes**, chunked into a manifest in 0G Storage and **BM25-retrieved at chat time** so Alina can quote her own material verbatim instead of inventing answers.

Alina's iNFT stores this JSON in `dataDescriptions[0]` on Galileo:

```json
{
  "name": "GM Alina Volkov",
  "category": "Chess",
  "blurb": "Russian-school grandmaster. Positional play and Capablanca endgames.",
  "systemPrompt": "You are GM Alina Volkov, a Russian-school chess grandmaster rated 2620. Teach with patience. Emphasize positional play, prophylaxis, and Capablanca-style endgames. Short paragraphs. Ask one clarifying question per reply when the position is ambiguous. Reference classical games (Kasparov vs Karpov 1985 Game 16, Capablanca vs Marshall 1918, Fischer vs Spassky Game 6). Never just give the move. Teach the reason. When discussing a position, include exactly one [fen <FEN-STRING>] tag in your reply so the UI can render it."
}
```

The server reads that blob fresh from chain on every chat request. If the persona has a `ragHash` field, the server also fetches the chunked notes manifest from 0G Storage, runs **BM25** against the student's latest message, and prepends the top-3 retrieved passages to the system prompt as `Reference material from <coach name>'s notebook · cite by [#index] when you use it:`. The combined prompt then streams through 0G Compute (Qwen 2.5 7B in a TEE).

Why BM25 instead of embeddings: zero model dependency, instant cold-start, deterministic, and it actually outperforms naive embeddings on keyword-heavy domains (chess openings, asanas, frameworks). Every character of the coach's voice plus the cited material is verifiably on chain or in 0G Storage. On `/chat/[id]` the **"Intelligence · embedded on 0G Chain"** panel decodes the blob live from the contract and shows the manifest hash + chunk count so you can verify this yourself.

---

## ENS subnames · iNFTs you can name

`KilnSubnameRegistrar` on Sepolia turns each iNFT into a permanent `<label>.kiln.eth` subname so coaches show up across every ENS-aware client, not just inside Kiln.

How a claim works:

1. From `/profile`, an iNFT owner picks a label (`mira`). The modal hits the live registrar to confirm it's free.
2. The user signs a tiny EIP-191 message (`Kiln · claim mira.kiln.eth for iNFT #5`). No chain switch · the wallet stays on Galileo.
3. `/api/ens/claim` recovers the signer, confirms `KilnAgentNFT.ownerOf(tokenId)` matches, and the **ops wallet** (which already paid for the parent name) submits the actual `register` tx on Sepolia. Cost to the user: zero gas.
4. The registrar sets the subname's `addr` record to the iNFT owner, writes `kiln.tokenId`, `kiln.chain`, `description`, and `url` text records, then **transfers ownership of the subnode to the user** so they manage records via the standard ENS app afterwards.

What that buys the rest of the app:

- `/chat/mira.kiln.eth` and `/chat/mira` both resolve via the registrar's `subnodeToken` mapping and route to the canonical numeric tokenId. Bare numbers (`/chat/5`) still work.
- The marketplace search box accepts subnames (with or without the `.kiln.eth` suffix) and matches on the same label that's stored on chain.
- Wallet → name resolution for the app's own UI (the Transfer modal, the rep card, the chat masthead) still uses **mainnet ENS** through the existing `lib/ens.ts` reverse-lookup helper. The two namespaces don't conflict.

---

## Tech stack

Pinned versions, the live ones in `web/package.json` and `contracts/foundry.toml`.

| Layer | Library | Version | Why |
|---|---|---|---|
| Frontend | Next.js | `16.2.4` | App Router, Turbopack, route handlers |
| | React | `19.2.4` | |
| | Tailwind | `4` | Palette-driven via CSS custom properties |
| | Privy | `@privy-io/react-auth@3` + `@privy-io/wagmi@4` | Email / Google / external wallet onboarding |
| | ethers | `^6.16` | Wallet signer wrapping the EIP-1193 provider |
| | viem | `^2.48` | Chain definitions, ABIs, event log parsing |
| | Fraunces + Geist | Google Fonts | Display serif + utility sans + mono mark type |
| Contracts | Solidity | `0.8.24`, `evm_version = cancun` | Required for 0G Chain |
| | Foundry | `1.5.1-stable` | Build + test + deploy |
| | OpenZeppelin | `5.6.1` | Access control for contract admin |
| | 0g-agent-nft | `eip-7857-draft` branch | Reference ERC-7857 we compare against |
| 0G SDKs | `@0gfoundation/0g-ts-sdk` | `1.2.1` | Storage indexer + upload + download |
| | `@0glabs/0g-serving-broker` | `0.7.5` | Compute ledger + TEE inference |

**Important scope note:** the Compute SDK is still under the legacy `@0glabs` namespace while Storage moved to `@0gfoundation`. This tripped us for hours · the older `@0glabs/0g-ts-sdk@0.3.3` is abandoned and reverts at `estimateGas` on Galileo. Always use `@0gfoundation/0g-ts-sdk` for Storage.

---

## Smart contracts reference

### KilnAgentNFT

A non-upgradeable ERC-7857 implementation. We chose not to fork the upgradeable reference because a proxy rollout is unnecessary for our deployment posture and adds friction to the demo.

Key functions:

```solidity
function mint(bytes[] proofs, string[] dataDescriptions, address to)
    returns (uint256 tokenId);

function transfer(address to, uint256 tokenId, bytes[] proofs);

function clone(address to, uint256 tokenId, bytes[] proofs)
    returns (uint256 newTokenId);

function authorizeUsage(uint256 tokenId, address user);

function refine(uint256 tokenId, bytes[] proofs, string[] newDescriptions);

function dataDescriptionsOf(uint256 tokenId) view returns (string[]);
function dataHashesOf(uint256 tokenId) view returns (bytes32[]);
function ownerOf(uint256 tokenId) view returns (address);
function authorizedUsersOf(uint256 tokenId) view returns (address[]);
function isAuthorized(uint256 tokenId, address user) view returns (bool);
```

A transfer wipes `authorizedUsers` for the token, which is what makes "seller provably loses access" real rather than aspirational. `refine` lets the owner update both the data hashes AND the persona JSON in one tx, so coaches can evolve their voice without losing the token's identity.

### KilnMarket

Listing, per-session rent, bulk license, payout split, ecosystem fund.

```solidity
function list(uint256 tokenId, uint256 pricePerSession,
              uint256 licensePricePerDay, string metadataURI);

function startSession(uint256 tokenId) payable returns (uint256 sessionId);
function endSession(uint256 sessionId, uint8 rating); // executor-only

function startLicense(uint256 tokenId, uint256 durationDays, uint256 seats)
    payable returns (uint256 licenseId);
function revokeLicense(uint256 licenseId);

function setExecutor(address newExecutor); // admin
function withdrawEcosystem(address to, uint256 amount); // admin
```

Split: 90% owner, 8% treasury, 2% ecosystem fund (retained in contract). Bulk licenses settle immediately on `startLicense`; sessions escrow and settle on `endSession`.

### KilnAttestationOracle

**`KilnAttestationOracle`** — implements the canonical `IERC7857DataVerifier` interface. Verifies ECDSA signatures over extended proof envelopes carrying a nonce, expiry, and either a preimage (mint / refine / update) or transfer-validity (transfer / clone) payload. Stamps each `(signer, nonce)` pair as used so a proof cannot be replayed. Admin can rotate trusted signers and toggle `mockMode` (used on Galileo for the demo flow; always `false` on Aristotle, locked via `lockMainnetMode()` after deploy).

The proof envelope shapes:

- **Preimage proof:** `abi.encode(bytes32 dataHash, uint256 nonce, uint256 expiry, bytes signature)` — passed to `mint`, `update`, `refine`.
- **Transfer proof:** `abi.encode(bytes32 oldDataHash, bytes32 newDataHash, address receiver, bytes16 sealedKey, uint256 nonce, uint256 expiry, bytes signature)` — passed to `transfer`, `clone`.

The signed digest format is `keccak256(abi.encode(fields, DOMAIN))` where `DOMAIN` is `KILN_PREIMAGE_V1` or `KILN_TRANSFER_V1`. Backend signs the raw keccak digest (not EIP-191 prefixed, not EIP-712 typed-data) — `wallet.signingKey.sign(digest)` from ethers v6.

Backend flow:

```
Frontend → POST /api/transfer/proof or /api/attestation/preimage
       ↓
Backend builds envelope, ECDSA-signs with KILN_OPS_PK ops wallet
       ↓
Returns proof bytes
       ↓
User's wallet → KilnAgentNFT.transfer(...) or .refine(...)
       ↓
KilnAgentNFT → oracle.verifyPreimage(proofs) or verifyTransferValidity(proofs)
       ↓
Oracle: decode → check signer trusted → low-s + v ∈ {27,28} → check nonce → check expiry → return isValid + struct
       ↓
KilnAgentNFT: out[i].oldDataHash == stored, out[i].receiver == to → ok → mutate state
```

### KilnSubnameRegistrar (Sepolia)

A thin wrapper over the standard ENS NameWrapper that mints `<label>.kiln.eth` subnames bound to a Kiln tokenId. Lives on Sepolia (chain id `11155111`). The ops wallet submits the registration tx so the user pays no gas; ownership of the subnode is then transferred to the user.

---

## Repo layout

```
kiln/
├── contracts/                       Foundry project
│   ├── src/
│   │   ├── KilnAgentNFT.sol        non-upgradeable IERC7857 implementation
│   │   ├── KilnMarket.sol          listing + sessions + licenses + split
│   │   └── KilnAttestationOracle.sol  IERC7857DataVerifier — ECDSA envelope
│   ├── test/
│   │   ├── KilnAgentNFT.t.sol      unit tests for mint/transfer/refine
│   │   └── KilnMarket.t.sol        pricing/split/licenses/admin tests
│   └── script/DeployTestnet.s.sol
│
├── axl/                             Gensyn AXL mesh config (see COUNCIL.md)
│
└── web/                             Next.js 16 app
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx             landing
    │   │   ├── onboard/             upload + mint
    │   │   ├── market/              catalog
    │   │   ├── profile/             coach studio with live-session timers
    │   │   ├── council/             multi-coach panel via AXL mesh
    │   │   ├── chat/[tokenId]/      pay + stream + transfer
    │   │   └── api/
    │   │       ├── storage/upload/  @0gfoundation/0g-ts-sdk round-trip
    │   │       ├── inference/session/[id]/  streaming proxy w/ auth gate
    │   │       ├── session/end/     executor-signed settlement
    │   │       ├── transfer/proof/  TEE proof-builder for ERC-7857 transfer
    │   │       ├── ens/claim/       Sepolia subname registration
    │   │       └── council/         orchestrator → AXL mesh
    │   ├── components/
    │   │   ├── kiln-avatar.tsx      procedural constellation per iNFT
    │   │   ├── intelligence-panel.tsx   on-chain persona proof
    │   │   ├── session-timer.tsx    30-min countdown w/ auto-settle
    │   │   ├── ens-name.tsx         reverse-lookup wrapper
    │   │   ├── transfer-modal.tsx
    │   │   ├── list-modal.tsx
    │   │   ├── chat-stream.tsx      SSE parser + inline chessboard
    │   │   └── site-chrome.tsx      nav + footer
    │   └── lib/
    │       ├── storage/             pluggable backend (0G + local fallback)
    │       ├── compute.ts           ledger + TEE inference broker
    │       ├── persona.ts           dataDescriptions[0] ↔ JSON
    │       ├── use-persona.ts       client hook + batch reader
    │       ├── ens.ts               reverse-lookup helpers
    │       ├── encryption.ts        AES-256-GCM helpers
    │       ├── contracts.ts         ABIs + addresses by chain
    │       └── chains.ts            Galileo + Aristotle + Sepolia
    └── scripts/
        ├── seed-mint.ts             mint sample coaches
        ├── smoke-storage.ts         verify Storage round-trip
        └── smoke-compute.ts         verify Compute round-trip
```
