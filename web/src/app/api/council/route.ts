import type { NextRequest } from 'next/server'
import { ethers } from 'ethers'
import { z } from 'zod'
import { ABIS, ADDRESSES } from '@/lib/contracts'
import { resolvePersona } from '@/lib/persona'
import { runOneShot, type ChatMessage } from '@/lib/inference-server'
import {
  COACH_NODE,
  SYNTH_PEER_ID,
  axlSend,
  axlWaitFor,
} from '@/lib/axl'

export const runtime = 'nodejs'
export const maxDuration = 300

const Body = z.object({
  tokenIds: z.array(z.union([z.string(), z.number()])).min(2).max(5),
  question: z.string().min(3).max(2000),
})

type CoachReply = {
  tokenId: string
  name: string
  category: string
  text: string
  /// Wei-denominated per-session price from the on-chain marketplace listing.
  /// '0' if the iNFT is not listed; the UI hides the Book CTA in that case.
  pricePerSessionWei: string
  listingActive: boolean
}

type SynthesisRequest = {
  query: string
  replies: Array<{ tokenId: string; name: string; category: string; text: string }>
}

type SynthesisResult = {
  text: string
  bestFitTokenId: string | null
  provider: string
  model: string
}

/// Orchestrator for the Council flow.
///
/// 1. Fan out the user's question to N coaches in parallel · each one
///    runs against its own on-chain persona (`dataDescriptions[0]`).
/// 2. Bundle the per-coach replies into an envelope and ship it to the
///    synthesizer node over the AXL P2P transport.
/// 3. Wait for the synth node to reply over the same transport, then
///    return both the individual coach answers AND the synthesized
///    council answer to the client.
///
/// The synthesis hop is the part that proves AXL is actually doing
/// work · everything before the AXL send happens locally, but the
/// synthesis runs on a different node behind the encrypted P2P mesh
/// and the result comes back through the same channel. On the demo
/// box both nodes are 127.0.0.1, but the architecture is the same
/// when they're on different machines.
export async function POST(req: NextRequest) {
  try {
    const { tokenIds, question } = Body.parse(await req.json())
    const queryId = newQueryId()

    // 1) Read every coach's persona AND market listing from chain in parallel.
    //    The listing tells us the per-session price so the UI can render
    //    a "Book session · X OG" CTA on each reply card without a second
    //    round-trip.
    const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!)
    const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, provider)
    const market = new ethers.Contract(ADDRESSES.KilnMarket, ABIS.KilnMarket as any, provider)
    const enriched = await Promise.all(
      tokenIds.map(async (id) => {
        const tokenId = BigInt(id)
        const [descs, listing] = await Promise.all([
          nft.dataDescriptionsOf(tokenId).catch(() => [] as string[]),
          market.listings(tokenId).catch(() => null),
        ])
        const persona = resolvePersona(tokenId.toString(), descs as string[])
        const pricePerSessionWei: bigint = listing ? ((listing as any).pricePerSession ?? (listing as any)[1] ?? 0n) : 0n
        const listingActive: boolean = listing ? Boolean((listing as any).active ?? (listing as any)[4]) : false
        return { tokenId: tokenId.toString(), persona, pricePerSessionWei, listingActive }
      }),
    )

    // 2) Run inference for every coach in parallel.
    const replies: CoachReply[] = await Promise.all(
      enriched.map(async ({ tokenId, persona, pricePerSessionWei, listingActive }) => {
        const messages: ChatMessage[] = [
          { role: 'system', content: persona.systemPrompt },
          { role: 'user', content: question },
        ]
        const base = {
          tokenId,
          name: persona.name,
          category: persona.category,
          pricePerSessionWei: pricePerSessionWei.toString(),
          listingActive,
        }
        try {
          const r = await runOneShot(messages)
          return { ...base, text: r.text }
        } catch (err: unknown) {
          return { ...base, text: `_(${persona.name} is offline · ${(err as Error).message})_` }
        }
      }),
    )

    // 3) Send the synthesis envelope to the synth node over AXL.
    //    Strip the price/listing fields out · the synth only needs name +
    //    category + text to do its job, no point bloating the envelope.
    const synthReplies = replies.map((r) => ({
      tokenId: r.tokenId,
      name: r.name,
      category: r.category,
      text: r.text,
    }))
    await axlSend(COACH_NODE, SYNTH_PEER_ID, {
      kind: 'council/synthesize',
      queryId,
      payload: { query: question, replies: synthReplies } as SynthesisRequest,
    })

    // 4) Block until the synth node sends back a result.
    let synthesis: SynthesisResult
    try {
      const env = await axlWaitFor<SynthesisResult>(
        COACH_NODE,
        { kind: 'council/result', queryId },
        { timeoutMs: 90_000, intervalMs: 250 },
      )
      synthesis = env.payload
    } catch (err: unknown) {
      synthesis = {
        text: `_(synthesizer node did not respond · ${(err as Error).message})_`,
        bestFitTokenId: null,
        provider: '',
        model: '',
      }
    }

    return Response.json({ queryId, replies, synthesis })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'council failed'
    console.error('council error', err)
    return Response.json({ error: msg }, { status: 500 })
  }
}

function newQueryId(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
