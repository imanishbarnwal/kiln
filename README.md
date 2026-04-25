<div align="center">

<img src="assets/kiln-wordmark.svg" alt="Kiln" width="480" />

### *Fire your model. Own your model.*

**A sovereign atelier for AI experts. Mint your fine-tuned AI as an iNFT you own forever. Rent it by the session. Sell it like any other asset.**

[![Status](https://img.shields.io/badge/Status-LIVE-brightgreen?style=for-the-badge)](#live-deployments)
[![Built on 0G](https://img.shields.io/badge/Built_on-0G-FF5A1F?style=for-the-badge&labelColor=0B0604)](https://0g.ai)
[![Network](https://img.shields.io/badge/Network-Galileo_16602-E8BB5A?style=for-the-badge&labelColor=2A1710)](https://chainscan-galileo.0g.ai)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

[Contracts](#live-deployments) &nbsp;·&nbsp; [How it works](#how-it-works-in-one-diagram) &nbsp;·&nbsp; [Quickstart](#quickstart--run-it-locally) &nbsp;·&nbsp; [Trust model](#trust-model--honest-disclosures)

</div>

---

Kiln is a sovereign atelier for AI experts. A chess grandmaster, a yoga teacher, a startup mentor · anyone with hard-won knowledge · can upload what they know, encrypt it, mint it as an **ERC-7857 intelligent NFT** they fully own, and rent it by the session or license it by the day. Students chat with the coach's AI through a **TEE-protected** inference path so buyers can use the model without ever seeing the weights. The coach sleeps. The iNFT does not.

Built end-to-end on the **0G** stack: Storage for encrypted artifacts, Compute for verifiable inference, Chain for the iNFT and marketplace contracts.

## Table of contents

- [Live deployments](#live-deployments)
- [How it works in one diagram](#how-it-works-in-one-diagram)
- [Three on-chain flows](#three-on-chain-flows)
  - [Mint](#mint)
  - [Rent](#rent)
  - [Transfer](#transfer)
- [The single question that matters](#the-single-question-that-matters-how-does-the-chat-know-who-it-is)
- [Tech stack](#tech-stack)
- [Repo layout](#repo-layout)
- [Smart contracts](#smart-contracts)
- [Quickstart · run it locally](#quickstart--run-it-locally)
- [Trust model · honest disclosures](#trust-model--honest-disclosures)
- [Roadmap](#roadmap)
- [License](#license)

---

## Live deployments

All three Kiln contracts are live on the **0G Galileo testnet** (chain id `16602`, RPC `https://evmrpc-testnet.0g.ai`).

| Contract | Address | Explorer |
|---|---|---|
| `KilnAgentNFT` (ERC-7857) | `0x613c3c4a75953c95affda3b181d0a0198bc7d811` | [view](https://chainscan-galileo.0g.ai/address/0x613c3c4a75953c95affda3b181d0a0198bc7d811) |
| `KilnMarket` | `0x37fe0b75dae90ee8d844125373b1a2127ff7c67d` | [view](https://chainscan-galileo.0g.ai/address/0x37fe0b75dae90ee8d844125373b1a2127ff7c67d) |
| `KilnMockVerifier` (demo) | `0x2fc379c08632792bf701a4d46309004cc103c123` | [view](https://chainscan-galileo.0g.ai/address/0x2fc379c08632792bf701a4d46309004cc103c123) |

The marketplace is seeded with coaches across Chess, Wellness, Startup, Languages, and Math. Every listed token is queryable with `KilnAgentNFT.dataDescriptionsOf(tokenId)` · the persona (name, category, blurb, system prompt) is committed on chain, not in a database.

## How it works in one diagram

```
                         ┌──────────────────────────────────────┐
                         │          KILN FRONTEND               │
                         │   Next.js 16 · React 19 · Privy      │
                         └──────────────────────────────────────┘
                              │              │            │
       ┌──────────────────────┘              │            └────────────────────┐
       │                                     │                                 │
       ▼                                     ▼                                 ▼
 ┌─────────────┐                     ┌───────────────┐                 ┌─────────────────┐
 │ 0G STORAGE  │                     │  0G COMPUTE   │                 │   0G CHAIN      │
 │             │                     │               │                 │   (EVM · 16602) │
 │ encrypted   │                     │ Qwen 2.5 7B   │                 │                 │
 │ artifacts   │                     │ in TEE        │                 │ KilnAgentNFT    │
 │ AES-256-GCM │                     │ OpenAI-compat │                 │ KilnMarket      │
 │ Merkle root │                     │ billing via   │                 │ KilnMockVerifier│
 │ on chain    │                     │ broker ledger │                 │                 │
 └─────────────┘                     └───────────────┘                 └─────────────────┘
```

**Every piece is load-bearing.** Storage holds the encrypted training material and gets a Merkle root committed to the iNFT so no one can tamper silently. Compute runs the inference inside a TEE so buyers cannot exfiltrate weights. Chain holds the iNFT, the listing, the session, the payout split. Remove any one and the sovereignty story breaks.

<p align="center">
  <a href="https://0g.ai" target="_blank">
    <img src="assets/0g-wordmark-purple.svg" alt="0G" width="120" />
  </a>
</p>
<p align="center"><sub>Powered by <a href="https://0g.ai">0G</a> · Storage, Compute, Chain, and the ERC-7857 standard.</sub></p>

## Three on-chain flows

### Mint

A coach fills out their name, category, blurb, and system prompt on `/onboard`, drops their training files, and clicks **Fire Model**.

1. The browser generates a 256-bit AES-GCM key, encrypts the files client-side, and uploads the ciphertext to 0G Storage via `@0gfoundation/0g-ts-sdk`. A Merkle root comes back.
2. The browser computes `sha256(ciphertext)` and serializes the persona as JSON.
3. The coach's wallet signs `KilnAgentNFT.mint(proofs, dataDescriptions, to)` where:
   - `proofs[0]` = the sha256 hash (accepted by our mock verifier as the preimage)
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

## The single question that matters · how does the chat know who it is?

When you chat with **GM Alina Volkov** (iNFT #3), the model is not fine-tuned on chess. The model is Qwen 2.5 7B · a general-purpose instruction-following model. What makes it reply like Alina instead of like Aarav is the **system prompt committed to the iNFT**.

Alina's iNFT stores this JSON in `dataDescriptions[0]` on Galileo:

```json
{
  "name": "GM Alina Volkov",
  "category": "Chess",
  "blurb": "Russian-school grandmaster. Positional play and Capablanca endgames.",
  "systemPrompt": "You are GM Alina Volkov, a Russian-school chess grandmaster rated 2620. Teach with patience. Emphasize positional play, prophylaxis, and Capablanca-style endgames. Short paragraphs. Ask one clarifying question per reply when the position is ambiguous. Reference classical games (Kasparov vs Karpov 1985 Game 16, Capablanca vs Marshall 1918, Fischer vs Spassky Game 6). Never just give the move. Teach the reason. When discussing a position, include exactly one [fen <FEN-STRING>] tag in your reply so the UI can render it."
}
```

The server reads that blob fresh from chain on every chat request, prepends the `systemPrompt` as a `role: "system"` message, and sends the conversation to 0G Compute. Every character of the coach's voice is on chain, queryable by anyone who can hit a JSON-RPC endpoint. On `/chat/[id]` there is an **"Intelligence · embedded on 0G Chain"** panel that decodes the blob live from the contract so you can verify this with your own eyes.

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

## Repo layout

```
kiln/
├── contracts/                       Foundry project
│   ├── src/
│   │   ├── KilnAgentNFT.sol        non-upgradeable IERC7857 implementation
│   │   ├── KilnMarket.sol          listing + sessions + licenses + split
│   │   └── KilnMockVerifier.sol    IERC7857DataVerifier stand-in for demo
│   ├── test/
│   │   ├── KilnAgentNFT.t.sol      7 tests, mint/transfer/authorizeUsage/clone
│   │   └── KilnMarket.t.sol        13 tests, pricing/split/licenses/admin
│   └── script/DeployTestnet.s.sol
│
└── web/                             Next.js 16 app
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx             landing
    │   │   ├── onboard/             upload + mint
    │   │   ├── market/              catalog
    │   │   ├── profile/             coach studio with live-session timers
    │   │   ├── chat/[tokenId]/      pay + stream + transfer
    │   │   └── api/
    │   │       ├── storage/upload/  @0gfoundation/0g-ts-sdk round-trip
    │   │       ├── inference/session/[id]/  streaming proxy w/ auth gate
    │   │       ├── session/end/     executor-signed settlement
    │   │       └── transfer/proof/  TEE proof-builder for ERC-7857 transfer
    │   ├── components/
    │   │   ├── kiln-avatar.tsx      procedural constellation per iNFT
    │   │   ├── intelligence-panel.tsx   on-chain persona proof
    │   │   ├── session-timer.tsx    30-min countdown w/ auto-settle
    │   │   ├── logo-concepts.tsx    brand mark (Concept E Stamp & Flame)
    │   │   ├── transfer-modal.tsx
    │   │   ├── list-modal.tsx
    │   │   ├── chat-stream.tsx      SSE parser + inline chessboard
    │   │   ├── upload-guide.tsx     what-to-upload examples
    │   │   └── site-chrome.tsx      nav + footer
    │   └── lib/
    │       ├── storage/             pluggable backend (0G + local fallback)
    │       ├── compute.ts           ledger + TEE inference broker
    │       ├── persona.ts           dataDescriptions[0] ↔ JSON
    │       ├── use-persona.ts       client hook + batch reader
    │       ├── active-sessions.ts   SessionStarted event scanner
    │       ├── encryption.ts        AES-256-GCM helpers
    │       ├── contracts.ts         ABIs + addresses by chain
    │       └── chains.ts            Galileo + Aristotle definitions
    └── scripts/
        ├── seed-mint.ts             mint 5 sample coaches
        ├── smoke-storage.ts         verify Storage round-trip
        └── smoke-compute.ts         verify Compute round-trip
```

## Smart contracts

### KilnAgentNFT

A non-upgradeable ERC-7857 implementation. Chose not to fork the upgradeable reference because a proxy rollout is unnecessary for a hackathon deployment and adds friction to the demo.

Key functions:

```solidity
function mint(bytes[] proofs, string[] dataDescriptions, address to)
    returns (uint256 tokenId);

function transfer(address to, uint256 tokenId, bytes[] proofs);

function clone(address to, uint256 tokenId, bytes[] proofs)
    returns (uint256 newTokenId);

function authorizeUsage(uint256 tokenId, address user);

function dataDescriptionsOf(uint256 tokenId) view returns (string[]);
function dataHashesOf(uint256 tokenId) view returns (bytes32[]);
function ownerOf(uint256 tokenId) view returns (address);
function authorizedUsersOf(uint256 tokenId) view returns (address[]);
function isAuthorized(uint256 tokenId, address user) view returns (bool);
```

A transfer wipes `authorizedUsers` for the token, which is what makes "seller provably loses access" real rather than aspirational.

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

### KilnMockVerifier

Accepts any 32-byte preimage proof and any correctly-encoded transfer proof as `isValid = true`. Documented in the source file as the hackathon stand-in for 0G's TeeML verifier. Replacing with the real verifier on mainnet is a one-line change.

## Quickstart · run it locally

### Prerequisites

- Node.js 20 or later (24 LTS recommended)
- pnpm 9 or later
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- A wallet with some Galileo testnet OG (get from `https://faucet.0g.ai`)

### Install

```bash
git clone <this-repo> kiln && cd kiln
pnpm install

# Foundry deps
cd contracts && forge install && cd ..
```

### Configure

```bash
# Frontend secrets
cp web/.env.example web/.env.local
# Fill in:
#   NEXT_PUBLIC_PRIVY_APP_ID        — from https://dashboard.privy.io
#   KILN_OPS_PK                     — private key of a funded Galileo wallet
#   KILN_OPS_ADDRESS                — the address of that wallet
#   NEXT_PUBLIC_KILN_OPS_ADDRESS    — same address, exposed to client
#
# Contract addresses default to our live Galileo deployment.

# Contract secrets (only needed if you want to redeploy)
cp contracts/.env.example contracts/.env
# Fill in DEPLOYER_PK, TREASURY, EXECUTOR
```

### Run

```bash
# run contract tests (20 pass)
cd contracts && forge test -vv

# deploy to Galileo (optional, uses our addresses by default)
set -a && source .env && set +a
forge script script/DeployTestnet.s.sol --rpc-url galileo --broadcast \
  --priority-gas-price 2000000000 --with-gas-price 5000000000 -vv

# start the frontend
cd ../web && pnpm dev
# open http://localhost:3000
```

### Smoke tests

Confirm Storage and Compute round-trip from your wallet before doing anything with the UI.

```bash
cd web
pnpm dlx tsx scripts/smoke-storage.ts     # uploads 1 KB, reads it back
pnpm dlx tsx scripts/smoke-compute.ts     # one Qwen 2.5 7B chat round-trip
```

If either errors, the rest will not work. Check your `.env.local` and wallet balance first.

### Seed the marketplace

```bash
cd web && pnpm dlx tsx scripts/seed-mint.ts
```

Mints five sample coaches (Chess, Wellness, Startup, Languages, Math) owned by the ops wallet and lists them on the market. Uses ~0.05 OG of gas.

## Trust model · honest disclosures

We prefer accuracy over marketing. Four things we want a careful reader to know.

**1. The training files are not yet used by inference.**
Files a coach uploads are encrypted in the browser with AES-256-GCM, pinned to 0G Storage, and committed on chain as `dataHashes[0]`. The coach's voice today is driven entirely by the `systemPrompt` they write in the onboard form. The uploaded corpus is **tamper-evident commitment**, not a training signal. Path to v2: run a fine-tune job via 0G Compute's fine-tuning API (testnet beta), store the resulting LoRA adapter's root on `dataHashes`, load at inference. Simpler interim path: chunk + embed + RAG at inference time.

**2. The verifier is a demo stand-in.**
`KilnMockVerifier` accepts any correctly-formatted proof. In production you would deploy `TeeVerifier.sol` from the 0G reference and register it as the `verifier()` of `KilnAgentNFT`. That is a one-function admin call. The rest of the contract does not change.

**3. The executor is a single server-side wallet.**
Rent-session inference and endSession settlement both sign from the `KILN_OPS_PK` wallet because it is the address the owner authorized via `authorizeUsage`. For production you would either (a) have the coach run their own inference provider, (b) decentralize the executor role via 0G Compute's provider network, or (c) use a TEE attestation chain so the executor is a pool of attested enclaves.

**4. Sessions are 30 minutes, time-limited client-side.**
`DEFAULT_SESSION_SECONDS = 30 * 60`. The countdown runs in the browser; when it hits zero the frontend fires `/api/session/end` which settles on chain. If every browser tab for a session is closed, the payment stays escrowed until the coach manually settles from `/profile`. For production we would add either a contract-level `expiresAt` on each session with an anyone-can-sweep `forceSettle()`, or a server cron that reaps abandoned sessions. Keep listed here so nothing is smuggled past a careful reader.

## Roadmap

- **v1 (shipped)** · Mint, rent, transfer, 30-min timer, coach-set pricing, per-iNFT persona on chain, alchemical constellation avatars, intelligence-embedded proof panel.
- **v2 · real training.** Kick off a fine-tune job on 0G Compute at mint time; store the LoRA adapter root on the iNFT; load it at inference. Or interim: chunk + embed + RAG.
- **v2 · real TEE verifier.** Swap `KilnMockVerifier` for 0G TeeML's production verifier. No application changes required.
- **v2 · reputation.** Index `SessionEnded` events per token, feed the session count + average rating into `KilnAvatar.reputation`. The avatar already reads the parameter; it is pinned at 0 today.
- **v2 · mainnet.** Deploy the three contracts on Aristotle (chain id `16661`) and list on the AIverse iNFT marketplace.
- **v2 · contract-level session expiry.** Add `expiresAt` to the session struct and a public `forceSettle` for anyone-can-sweep after expiry.

## License

MIT. See [`LICENSE`](LICENSE).

Built with patience. Fired on 0G.
