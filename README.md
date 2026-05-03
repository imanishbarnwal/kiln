<div align="center">

<img src="assets/kiln-wordmark.svg" alt="Kiln" width="480" />

### *Fire your model. Own your model.*

**A sovereign atelier for AI experts. Mint your AI coach as an iNFT you own forever. Rent it by the session. Sell it like any other asset.**

[![Built on 0G](https://img.shields.io/badge/Built_on-0G-A78BFA?style=for-the-badge&labelColor=0B0604)](https://0g.ai)
[![ENS](https://img.shields.io/badge/ENS-kiln.eth-5298FF?style=for-the-badge&labelColor=0B0604)](https://app.ens.domains/kiln.eth)
[![Network](https://img.shields.io/badge/Network-Galileo_16602-E8BB5A?style=for-the-badge&labelColor=2A1710)](https://chainscan-galileo.0g.ai)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

[Live demo](https://kiln-virid-rho.vercel.app) &nbsp;·&nbsp; [Architecture](docs/ARCHITECTURE.md) &nbsp;·&nbsp; [Trust model](docs/TRUST-MODEL.md) &nbsp;·&nbsp; [Council](docs/COUNCIL.md)

</div>

---

Kiln is a sovereign atelier for AI experts. A chess grandmaster, a yoga teacher, a startup mentor · anyone with hard-won knowledge · can upload what they know, encrypt it, mint it as an **ERC-7857 intelligent NFT** they fully own, and rent it by the session or license it by the day. Students chat with the coach's AI through a **TEE-protected** inference path so buyers can use the model without ever seeing the weights. The coach sleeps. The iNFT does not.

Built end-to-end on the **0G** stack: Storage for encrypted artifacts, Compute for verifiable inference, Chain for the iNFT and marketplace contracts.

---

## Live deployments

**Demo URL ·** [`kiln-virid-rho.vercel.app`](https://kiln-virid-rho.vercel.app) (frontend on Vercel · connect a wallet on Galileo to mint, rent, transfer)

> Council mode (`/council`) requires the AXL mesh running locally. See [docs/COUNCIL.md](docs/COUNCIL.md) for the local run-order. The other flows (mint, marketplace, chat with RAG, ENS claim, transfer) work end-to-end on the demo URL.

All three Kiln contracts are live on the **0G Galileo testnet** (chain id `16602`, RPC `https://evmrpc-testnet.0g.ai`).

| Contract | Address | Explorer |
|---|---|---|
| `KilnAgentNFT` (ERC-7857) | `0x613c3c4a75953c95affda3b181d0a0198bc7d811` | [view](https://chainscan-galileo.0g.ai/address/0x613c3c4a75953c95affda3b181d0a0198bc7d811) |
| `KilnMarket` | `0x37fe0b75dae90ee8d844125373b1a2127ff7c67d` | [view](https://chainscan-galileo.0g.ai/address/0x37fe0b75dae90ee8d844125373b1a2127ff7c67d) |
| `KilnMockVerifier` (demo) | `0x2fc379c08632792bf701a4d46309004cc103c123` | [view](https://chainscan-galileo.0g.ai/address/0x2fc379c08632792bf701a4d46309004cc103c123) |

A fourth contract lives on the **Sepolia ENS registry** (chain id `11155111`) so each iNFT can claim a permanent `<label>.kiln.eth` subname:

| Contract | Address | Explorer |
|---|---|---|
| `KilnSubnameRegistrar` | `0xbd55D3bB25Ac799d3E463b6945C570045aC1a90a` | [view](https://sepolia.etherscan.io/address/0xbd55D3bB25Ac799d3E463b6945C570045aC1a90a) |

The marketplace is seeded with coaches across Chess, Wellness, Startup, Languages, and Math. Every listed token's persona is queryable on chain via `KilnAgentNFT.dataDescriptionsOf(tokenId)`. Coaches who claim an ENS subname get a route slug for free: `/chat/mira` and `/chat/mira.kiln.eth` both resolve to the same iNFT.

---

## How it works

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

For the layer-by-layer expansion · the three on-chain flows (mint, rent, transfer), the "how does the chat know who it is?" walkthrough, ENS subnames, the contracts reference, and the repo layout · read [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md).

<p align="center">
  <a href="https://0g.ai" target="_blank">
    <img src="assets/0g-wordmark-purple.svg" alt="0G" width="120" />
  </a>
</p>
<p align="center"><sub>Powered by <a href="https://0g.ai">0G</a> · Storage, Compute, Chain, and the ERC-7857 standard.</sub></p>

---

## Documentation

| Doc | What it answers |
|---|---|
| [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md) | How is Kiln built? What does each layer do? How do mint, rent, and transfer work on chain? How does the chat know who it is? What's in the contracts? |
| [**docs/TRUST-MODEL.md**](docs/TRUST-MODEL.md) | What's real versus simplified for the demo? Where are the stand-ins (verifier, executor, fine-tuning)? What does v2 look like? |
| [**docs/COUNCIL.md**](docs/COUNCIL.md) | Why two AXL nodes? How do you set up the local mesh? What does each phase of a Convene click look like? |

---

## Quickstart · run it locally

```bash
git clone https://github.com/imanishbarnwal/kiln && cd kiln
pnpm install
cp web/.env.example web/.env.local      # fill in PRIVY_APP_ID, KILN_OPS_PK
cp contracts/.env.example contracts/.env # only if you want to redeploy

# verify Storage and Compute round-trip from your wallet
cd web
pnpm dlx tsx scripts/smoke-storage.ts
pnpm dlx tsx scripts/smoke-compute.ts

# start the app
pnpm dev      # open http://localhost:3000

# (optional) seed 5 sample coaches
pnpm dlx tsx scripts/seed-mint.ts

# (optional) Council mode requires the local AXL mesh
# see docs/COUNCIL.md for the three-terminal run order
```

Prerequisites: Node 20+, pnpm 9+, [Foundry](https://book.getfoundry.sh/getting-started/installation), a wallet funded with Galileo testnet OG from [the faucet](https://faucet.0g.ai). Contract addresses default to our live Galileo deployment so you don't need to redeploy unless you want to.

---

## Trust model · the short version

Three things a careful reader should know up front. The full disclosures live in [**docs/TRUST-MODEL.md**](docs/TRUST-MODEL.md).

1. **The model is not yet fine-tuned on coach uploads.** Files are encrypted on chain as tamper-evident provenance. Inference uses Qwen 2.5 7B with the persona's system prompt plus BM25 retrieval over the coach's notes manifest. Honest framing: we're closer to "extremely well-prompted RAG" than to "the coach's personality has been baked into the weights." Fine-tuning ships when 0G Compute exposes a training API.
2. **The verifier is a demo stand-in.** `KilnMockVerifier` accepts any correctly-formatted proof. Migrating to 0G's production TeeML verifier is a one-line admin call.
3. **The executor is a single server-side wallet.** Authorized via `authorizeUsage`, wiped on transfer · which is what makes "seller provably loses access" real. Decentralizing across the 0G Compute provider mesh is the v2 path.

---

## Roadmap

### Shipped today
ERC-7857 mint, transfer, refine · marketplace with per-session and per-day pricing · 30-minute session timer with auto-settle · per-iNFT persona on chain (`dataDescriptions[0]`) · BM25 retrieval over uploaded notes · ENS subnames on Sepolia (`<label>.kiln.eth`) · Council mode over a two-node Gensyn AXL mesh · alchemical-constellation avatars hashed from each token id · intelligence-embedded proof panel that decodes on-chain state live.

### Next, ordered by impact

1. **Real fine-tuning.** Kick off a LoRA job on 0G Compute at mint time and store the adapter's root hash in `dataHashes`. BM25 stays as the fallback retrieval layer for non-fine-tuned coaches.
2. **Reputation on chain.** Index `SessionEnded` events per token and feed session count + average rating into `KilnAvatar.reputation`. The avatar component already reads the parameter · it is pinned at 0 today.
3. **Production TEE verifier.** Swap `KilnMockVerifier` for 0G TeeML's production verifier. No application changes required · the interface is already correct.
4. **Mainnet.** Deploy the three contracts on Aristotle (chain id `16661`) and list on the AIverse iNFT marketplace.
5. **Embedding-based retrieval.** Upgrade BM25 to dense embeddings once 0G Compute exposes an embedding endpoint. Better recall on conceptual queries; BM25 stays the deterministic fallback.

### Later
Encrypted chat-transcript backup to 0G Storage · contract-level session expiry with anyone-can-sweep settle · dispute resolution for sessions a student claims went badly · payout splits for collaborative coaches.

---

## License

MIT. See [`LICENSE`](LICENSE).

Built with patience. Fired on 0G.
