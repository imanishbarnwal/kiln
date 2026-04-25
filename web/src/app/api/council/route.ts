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
}

type SynthesisRequest = {
  query: string
  replies: CoachReply[]
}

type SynthesisResult = {
  text: string
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

    // 1) Read every coach's persona from chain in parallel.
    const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!)
    const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, provider)
    const personas = await Promise.all(
      tokenIds.map(async (id) => {
        const tokenId = BigInt(id)
        const descs: string[] = await nft.dataDescriptionsOf(tokenId).catch(() => [] as string[])
        return { tokenId: tokenId.toString(), persona: resolvePersona(tokenId.toString(), descs) }
      }),
    )

    // 2) Run inference for every coach in parallel.
    const replies: CoachReply[] = await Promise.all(
      personas.map(async ({ tokenId, persona }) => {
        const messages: ChatMessage[] = [
          { role: 'system', content: persona.systemPrompt },
          { role: 'user', content: question },
        ]
        try {
          const r = await runOneShot(messages)
          return { tokenId, name: persona.name, category: persona.category, text: r.text }
        } catch (err: unknown) {
          return {
            tokenId,
            name: persona.name,
            category: persona.category,
            text: `_(${persona.name} is offline · ${(err as Error).message})_`,
          }
        }
      }),
    )

    // 3) Send the synthesis envelope to the synth node over AXL.
    await axlSend(COACH_NODE, SYNTH_PEER_ID, {
      kind: 'council/synthesize',
      queryId,
      payload: { query: question, replies } as SynthesisRequest,
    })

    // 4) Block until the synth node sends back a result.
    let synthesis: SynthesisResult | null = null
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
