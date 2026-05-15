// Seed-mint ONE marquee Kiln iNFT on Aristotle mainnet so the marketplace
// isn't empty for judges/visitors. Single coach to keep OG burn low.
//
// Run AFTER `forge script DeployMainnet.s.sol --broadcast` and after
// recording the deployed addresses in .env.local (or via env at run time).
//
// Run once:
//   cd web && pnpm dlx tsx scripts/seed-mint-mainnet.ts
//
// Required env:
//   ZG_RPC_URL                          (default: https://evmrpc.0g.ai)
//   KILN_OPS_PK                         (ops wallet private key — pays gas + signs envelope)
//   NEXT_PUBLIC_AGENT_NFT_ADDRESS       (Aristotle KilnAgentNFT address)
//   NEXT_PUBLIC_KILN_MARKET_ADDRESS     (Aristotle KilnMarket address)
//   KILN_OPS_ADDRESS                    (address authorized for sessions; usually = ops wallet)

import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') })

import { ethers } from 'ethers'
import ABIS from '../src/lib/abis'
import { serializePersona, type Persona } from '../src/lib/persona'
import { buildPreimageProof, randomNonce } from '../src/lib/attestation'

/// One carefully-chosen marquee coach for the mainnet launch. Pick a
/// persona that demos well in a single screenshot — clear voice, narrow
/// expertise, recognizable shape.
const MARQUEE: Persona & { pricePerSession: string; licensePricePerDay: string } = {
  name: 'GM Alina Volkov',
  category: 'Chess',
  avatar: '',
  blurb: 'Russian-school grandmaster. Positional play and Capablanca endgames.',
  systemPrompt: [
    'You are GM Alina Volkov, a Russian-school chess grandmaster rated 2620.',
    'Teach with patience. Emphasize positional play, prophylaxis, and Capablanca-style endgames.',
    'Short paragraphs. Ask one clarifying question per reply when the position is ambiguous.',
    'Reference classical games (Kasparov vs Karpov 1985 Game 16, Capablanca vs Marshall 1918, Fischer vs Spassky Game 6).',
    'Never just give the move. Teach the reason.',
    'When discussing a position, include exactly one [fen <FEN-STRING>] tag in your reply so the UI can render it.',
  ].join(' '),
  pricePerSession: '0.001',
  licensePricePerDay: '0.01',
}

const GAS = { gasPrice: 5_000_000_000n }

async function main() {
  const rpc = process.env.ZG_RPC_URL ?? 'https://evmrpc.0g.ai'
  const pk = process.env.KILN_OPS_PK
  const nftAddr = process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS
  const marketAddr = process.env.NEXT_PUBLIC_KILN_MARKET_ADDRESS
  const executor = process.env.KILN_OPS_ADDRESS ?? process.env.NEXT_PUBLIC_KILN_OPS_ADDRESS
  if (!pk || !nftAddr || !marketAddr || !executor) {
    throw new Error(
      'missing env: KILN_OPS_PK / NEXT_PUBLIC_AGENT_NFT_ADDRESS / NEXT_PUBLIC_KILN_MARKET_ADDRESS / KILN_OPS_ADDRESS',
    )
  }
  const provider = new ethers.JsonRpcProvider(rpc)
  const wallet = new ethers.Wallet(pk, provider)

  const chainId = (await provider.getNetwork()).chainId
  if (chainId !== 16661n) {
    console.warn(
      `\n⚠️  Connected chain id is ${chainId}, not 16661 (Aristotle mainnet).\n` +
      `   If you meant to seed testnet, run scripts/seed-mint.ts instead.\n` +
      `   Continuing anyway — control-C now if this is wrong.\n`,
    )
  }

  const nft = new ethers.Contract(nftAddr, ABIS.KilnAgentNFT as any, wallet)
  const market = new ethers.Contract(marketAddr, ABIS.KilnMarket as any, wallet)
  const iface = new ethers.Interface(ABIS.KilnAgentNFT as any)

  const startBalance = await provider.getBalance(wallet.address)
  console.log(`ops wallet ${wallet.address}`)
  console.log(`chain id   ${chainId}`)
  console.log(`start balance: ${ethers.formatEther(startBalance)} OG\n`)

  // 1. Build envelope-shaped proof — the new oracle expects
  //    abi.encode(bytes32 dataHash, uint256 nonce, uint256 expiry, bytes signature)
  console.log(`[1/3] ${MARQUEE.name} (${MARQUEE.category})`)
  const personaJson = serializePersona(MARQUEE)
  const descriptions = [personaJson]
  const dataHash = ethers.keccak256(new TextEncoder().encode(personaJson))
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 5 * 60)
  const proof = buildPreimageProof(wallet, {
    dataHash,
    nonce: randomNonce(),
    expiry,
  })
  const proofs = [proof]

  const mintTx = await nft.mint(proofs, descriptions, wallet.address, GAS)
  const mintReceipt = await mintTx.wait()

  let tokenId: bigint | null = null
  for (const log of mintReceipt?.logs ?? []) {
    try {
      const parsed = iface.parseLog(log)
      if (parsed?.name === 'Minted') {
        tokenId = parsed.args._tokenId as bigint
        break
      }
    } catch {}
  }
  if (!tokenId) throw new Error('Minted event not found')
  console.log(`  minted iNFT #${tokenId} · tx ${mintTx.hash.slice(0, 12)}…`)

  // 2. Authorize the ops executor so chat sessions can be served.
  console.log(`[2/3] authorizing executor`)
  const authTx = await nft.authorizeUsage(tokenId, executor, GAS)
  await authTx.wait()
  console.log(`  authorized ${executor.slice(0, 8)}…${executor.slice(-4)}`)

  // 3. List on the market with the configured prices.
  console.log(`[3/3] listing on market`)
  const listTx = await market.list(
    tokenId,
    ethers.parseEther(MARQUEE.pricePerSession),
    ethers.parseEther(MARQUEE.licensePricePerDay),
    `kiln://persona/${tokenId}`,
    GAS,
  )
  await listTx.wait()
  console.log(`  listed · ${MARQUEE.pricePerSession} OG/session · ${MARQUEE.licensePricePerDay} OG/day\n`)

  const endBalance = await provider.getBalance(wallet.address)
  console.log(`end balance:   ${ethers.formatEther(endBalance)} OG`)
  console.log(`gas consumed:  ${ethers.formatEther(startBalance - endBalance)} OG`)
  console.log(`\nmainnet seed complete. iNFT #${tokenId} is live at /chat/${tokenId} once Vercel picks up the new env vars.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
