// Seed-mint 5 diverse Kiln iNFTs so the marketplace has substance.
//
// Run once:
//   cd web && pnpm dlx tsx scripts/seed-mint.ts
//
// All seed iNFTs are owned by the ops wallet (KILN_OPS_PK). To rent them
// in the demo, connect from any other wallet. The coach wallet you set up
// earlier (0x9FBB...) is the natural second wallet for demo purposes.

import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') })

import { ethers } from 'ethers'
import ABIS from '../src/lib/abis'
import { serializePersona, type Persona } from '../src/lib/persona'

type Seed = Persona & {
  pricePerSession: string
  licensePricePerDay: string
}

const SEEDS: Seed[] = [
  {
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
  },
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
  const rpc = process.env.ZG_RPC_URL
  const pk = process.env.KILN_OPS_PK
  const nftAddr = process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS
  const marketAddr = process.env.NEXT_PUBLIC_KILN_MARKET_ADDRESS
  const executor = process.env.KILN_OPS_ADDRESS ?? process.env.NEXT_PUBLIC_KILN_OPS_ADDRESS
  if (!rpc || !pk || !nftAddr || !marketAddr || !executor) {
    throw new Error('missing env: ZG_RPC_URL / KILN_OPS_PK / NEXT_PUBLIC_AGENT_NFT_ADDRESS / NEXT_PUBLIC_KILN_MARKET_ADDRESS / KILN_OPS_ADDRESS')
  }
  const provider = new ethers.JsonRpcProvider(rpc)
  const wallet = new ethers.Wallet(pk, provider)
  const nft = new ethers.Contract(nftAddr, ABIS.KilnAgentNFT as any, wallet)
  const market = new ethers.Contract(marketAddr, ABIS.KilnMarket as any, wallet)
  const iface = new ethers.Interface(ABIS.KilnAgentNFT as any)

  const startBalance = await provider.getBalance(wallet.address)
  console.log(`ops wallet ${wallet.address}`)
  console.log(`start balance: ${ethers.formatEther(startBalance)} OG\n`)

  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i]
    console.log(`[${i + 1}/${SEEDS.length}] ${seed.name} (${seed.category})`)

    // 1. mint with persona JSON in dataDescriptions[0]
    const personaJson = serializePersona(seed)
    const descriptions = [personaJson]
    const dataHashBytes = ethers.keccak256(new TextEncoder().encode(personaJson))
    const proofs = [dataHashBytes]

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

    // 2. authorize our executor so sessions can be served
    const authTx = await nft.authorizeUsage(tokenId, executor, GAS)
    await authTx.wait()
    console.log(`  authorized executor ${executor.slice(0, 8)}…${executor.slice(-4)}`)

    // 3. list on market
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
  console.log(`\nseed complete. refresh /market to see the 5 new coaches.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
