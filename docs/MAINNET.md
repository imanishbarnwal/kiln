# Kiln on Aristotle — operations playbook

## Live addresses

After `DeployMainnet.s.sol` runs, addresses are recorded in `contracts/deployments/aristotle.json` (the canonical record), mirrored in `README.md`, and set in Vercel env vars (`NEXT_PUBLIC_AGENT_NFT_ADDRESS`, `NEXT_PUBLIC_KILN_MARKET_ADDRESS`, `NEXT_PUBLIC_VERIFIER_ADDRESS`).

## First-time deploy

The deploy script reads four env vars:

| Env var | What it is |
|---|---|
| `DEPLOYER_PK` | Private key of the wallet broadcasting the txs. Must hold ≥ 2 OG on Aristotle. |
| `OPS_SIGNER_ADDRESS` | Address registered as the initial trusted signer on the oracle. Typically the same address whose key lives in `KILN_OPS_PK` on Vercel. |
| `TREASURY` | Address that receives the 8% Kiln fee on session payouts. Can be the deployer or a separate cold wallet. |
| `EXECUTOR` | Address authorized to call `KilnMarket.endSession`. Typically the same as `OPS_SIGNER_ADDRESS` (the backend already runs as that wallet). |

Then:

```bash
cd contracts && \
  DEPLOYER_PK=0x... \
  OPS_SIGNER_ADDRESS=0x... \
  TREASURY=0x... \
  EXECUTOR=0x... \
  forge script script/DeployMainnet.s.sol \
    --rpc-url aristotle --broadcast --verify
```

Three console2 lines print the deployed addresses. Record them in `contracts/deployments/aristotle.json` and Vercel env vars. Then run `lockMainnetMode()` (see below).

## Wallets

- **Deployer wallet** — created the three contracts. After deploy, it has admin rights on `KilnAgentNFT.admin` and `KilnAttestationOracle.admin`. Rotate via the two-step `transferAdmin` → `acceptAdmin` flow.
- **Ops wallet (signer)** — registered as the initial trusted signer on the oracle, and as the executor that calls `authorizeUsage` on the NFT. Same key in `KILN_OPS_PK` env. Keep funded with at least 0.5 OG.

## Funding the ops wallet

```bash
cast send $OPS_ADDRESS --value 1ether --rpc-url aristotle \
  --private-key $TREASURY_KEY
```

## Locking out mockMode after deploy

After successful deploy, the admin should run once:

```bash
cast send $ORACLE_ADDRESS "lockMainnetMode()" \
  --rpc-url aristotle --private-key $ADMIN_KEY
```

This permanently disables `setMockMode(true)` on the oracle. The function reverts forever after. Verify:

```bash
cast call $ORACLE_ADDRESS "mainnetLocked()(bool)" --rpc-url aristotle
# Expected: true
```

## Incident: signer key compromise

1. From the admin wallet, remove the compromised signer:

```bash
cast send $ORACLE_ADDRESS "removeTrustedSigner(address)" $COMPROMISED_SIGNER \
  --rpc-url aristotle --private-key $ADMIN_KEY
```

2. Generate a new signer key, fund the new address, register it:

```bash
cast send $ORACLE_ADDRESS "addTrustedSigner(address)" $NEW_SIGNER \
  --rpc-url aristotle --private-key $ADMIN_KEY
```

3. Rotate `KILN_OPS_PK` in Vercel. Redeploy.
4. No outstanding attestations from the compromised key are valid for any future call (each is single-use; the contract enforces nonce stamping per signer).

## Incident: oracle bug — swap to a different verifier

`KilnAgentNFT.setVerifier(address)` is admin-only and can point the NFT at a new oracle implementation without redeploying the NFT itself. Use this if the oracle ever needs replacement (e.g. when 0G publishes a production TeeML verifier).

## Verification on chainscan

If `forge script --verify` failed at deploy time:

```bash
forge verify-contract <ADDRESS> \
  contracts/src/KilnAttestationOracle.sol:KilnAttestationOracle \
  --chain-id 16661 \
  --verifier blockscout \
  --verifier-url https://chainscan.0g.ai/api
```

If chainscan doesn't accept the request, publish source on GitHub with the commit SHA and bytecode hash, and reference it from `README.md`.

## Daily operations

- Watch ops wallet balance — top up if below 0.2 OG.
- `chainscan.0g.ai/address/$ORACLE_ADDRESS` shows `PreimageVerified` / `TransferVerified` events; spike in `MockAttestationAccepted` while `mainnetLocked` is true is impossible — if it happens, alert.

## What's NOT in v1

- Decentralized signer set (the ops wallet is a single point of trust)
- Real on-chain verification of the TEE attestation blob (`teePayload` is logged in the envelope but oracle does not parse it)
- Separate keys for session-authorization vs proof-signing (same ops wallet does both)
