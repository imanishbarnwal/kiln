// Seed-mint Kiln iNFTs on Aristotle mainnet.
//
// Default seed set: the four remaining personas from the testnet roster
// (Alina was minted as iNFT #1 in the first mainnet deploy). Edit MARQUEES
// below to mint a different set, or pass ONLY_NAMES=Name1,Name2 to filter.
//
// Run:
//   cd web && pnpm dlx tsx scripts/seed-mint-mainnet.ts
//
// Required env (from .env.local):
//   ZG_RPC_URL                       (default: https://evmrpc.0g.ai)
//   KILN_OPS_PK                      (ops wallet private key — pays gas + signs envelope)
//   NEXT_PUBLIC_AGENT_NFT_ADDRESS    (Aristotle KilnAgentNFT)
//   NEXT_PUBLIC_KILN_MARKET_ADDRESS  (Aristotle KilnMarket)
//   KILN_OPS_ADDRESS                 (address authorized for sessions; usually = ops wallet)

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

type Seed = Persona & { pricePerSession: string; licensePricePerDay: string }

/// Mainnet seed roster. Mirrors web/scripts/seed-mint.ts (testnet) minus
/// Alina, who was minted as iNFT #1 in the first mainnet deploy.
const MARQUEES: Seed[] = [
  {
    name: 'Coach Vidya Nair',
    category: 'Wellness',
    avatar: '',
    blurb: 'Twenty years teaching Ashtanga yoga in Mysore. Injury-aware sequencing.',
    systemPrompt: [
      'You are Vidya, a 20-year Ashtanga teacher trained in Mysore.',
      'Sequence asanas with attention to breath and body alignment.',
      'Always ask about injuries or pain before prescribing a sequence.',
      'Use Sanskrit names with short English glosses.',
      'Be practical, grounded, and calm.',
    ].join(' '),
    pricePerSession: '0.0008',
    licensePricePerDay: '0.008',
  },
  {
    name: 'Mentor Aarav',
    category: 'Startup',
    avatar: '',
    blurb: 'YC W19 founder turned mentor. Blunt questions, numbers over vibes.',
    systemPrompt: [
      'You are Aarav, a YC W19 founder turned mentor.',
      'You are blunt. Ask brutal one-line follow-ups. Hate vague metrics.',
      'Always pin the founder to specific numbers (MAUs, retention cohort, burn, runway).',
      'Quote Paul Graham or Patrick Collison when relevant.',
      'Keep replies under 120 words.',
    ].join(' '),
    pricePerSession: '0.002',
    licensePricePerDay: '0.02',
  },
  {
    name: 'Teacher Yuki',
    category: 'Languages',
    avatar: '',
    blurb: 'Tokyo-based JLPT N1 instructor. Patient, methodical corrections.',
    systemPrompt: [
      'You are Yuki, a Tokyo-based JLPT N1 instructor.',
      'Correct mistakes gently. Write everything in romaji + kana + kanji.',
      'When explaining a grammar point, give two example sentences before stating the rule.',
      'Explain particles like a patient grandparent.',
    ].join(' '),
    pricePerSession: '0.0005',
    licensePricePerDay: '0.005',
  },
  {
    name: 'Prof. Mira Malik',
    category: 'Math',
    avatar: '',
    blurb: 'Olympiad coach and research mathematician. Turns problems into first principles.',
    systemPrompt: [
      'You are Professor Mira Malik, a research mathematician and olympiad coach.',
      'Turn every problem into first principles.',
      'Prefer small concrete examples over big statements.',
      'When a student is stuck, ask a leading Socratic question instead of giving the answer.',
      'Reply in clean steps, numbered when useful.',
    ].join(' '),
    pricePerSession: '0.0015',
    licensePricePerDay: '0.015',
  },
]

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

  /// Optional filter: ONLY_NAMES="Coach Vidya Nair,Teacher Yuki"
  const onlyNames = (process.env.ONLY_NAMES ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const seeds = onlyNames.length
    ? MARQUEES.filter((m) => onlyNames.includes(m.name))
    : MARQUEES

  if (!seeds.length) {
    console.log('no seeds selected (check ONLY_NAMES filter)')
    return
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
  console.log(`seeds:     ${seeds.length} (${seeds.map((s) => s.name).join(', ')})`)
  console.log(`start balance: ${ethers.formatEther(startBalance)} OG\n`)

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i]
    console.log(`[${i + 1}/${seeds.length}] ${seed.name} (${seed.category})`)

    // Build envelope-shaped proof — KilnAttestationOracle expects:
    //   abi.encode(bytes32 dataHash, uint256 nonce, uint256 expiry, bytes signature)
    const personaJson = serializePersona(seed)
    const descriptions = [personaJson]
    const dataHash = ethers.keccak256(new TextEncoder().encode(personaJson))
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 5 * 60)
    const proof = buildPreimageProof(wallet, {
      dataHash,
      nonce: randomNonce(),
      expiry,
    })

    const mintTx = await nft.mint([proof], descriptions, wallet.address, GAS)
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

    // Authorize the ops executor so chat sessions can be served.
    const authTx = await nft.authorizeUsage(tokenId, executor, GAS)
    await authTx.wait()
    console.log(`  authorized ${executor.slice(0, 8)}…${executor.slice(-4)}`)

    // List on the market with the configured prices.
    const listTx = await market.list(
      tokenId,
      ethers.parseEther(seed.pricePerSession),
      ethers.parseEther(seed.licensePricePerDay),
      `kiln://persona/${tokenId}`,
      GAS,
    )
    await listTx.wait()
    console.log(`  listed · ${seed.pricePerSession} OG/session · ${seed.licensePricePerDay} OG/day\n`)
  }

  const endBalance = await provider.getBalance(wallet.address)
  console.log(`end balance:   ${ethers.formatEther(endBalance)} OG`)
  console.log(`gas consumed:  ${ethers.formatEther(startBalance - endBalance)} OG`)
  console.log(`\nmainnet seed complete. refresh /market to see the new coaches.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
