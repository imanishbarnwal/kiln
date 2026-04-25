import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ethers } from 'ethers'
import { ABIS, ADDRESSES } from '@/lib/contracts'
import { resolvePersona } from '@/lib/persona'
import {
  ensureLedger,
  listInferenceServices,
  prepareProvider,
  inferenceHandles,
} from '@/lib/compute'

export const runtime = 'nodejs'
export const maxDuration = 300

const Body = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })).min(1),
  stream: z.boolean().optional().default(true),
})

type Session = {
  tokenId: bigint
  student: string
  amount: bigint
  settled: boolean
}

async function readSession(sessionIdStr: string): Promise<Session> {
  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!)
  const market = new ethers.Contract(ADDRESSES.KilnMarket, ABIS.KilnMarket as any, provider)
  const s: any = await market.sessions(BigInt(sessionIdStr))
  return {
    tokenId: s.tokenId ?? s[0],
    student: s.student ?? s[1],
    amount:  s.amount  ?? s[2],
    settled: s.settled ?? s[3],
  }
}

/// Confirm the backend executor is still authorized to serve this tokenId.
/// Transfer wipes authorizedUsers, so this check is what makes the
/// "seller provably loses access after transfer" demo work.
async function executorStillAuthorized(tokenId: bigint): Promise<boolean> {
  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!)
  const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, provider)
  const executor = (process.env.NEXT_PUBLIC_KILN_OPS_ADDRESS
    ?? process.env.KILN_OPS_ADDRESS) as string
  return (await nft.isAuthorized(tokenId, executor)) as boolean
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: sessionIdStr } = await ctx.params

  let args: z.infer<typeof Body>
  try {
    args = Body.parse(await req.json())
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 400 })
  }

  // 1) Verify the session exists and is not already settled.
  let session: Session
  try {
    session = await readSession(sessionIdStr)
  } catch (err: unknown) {
    return Response.json({ error: `session lookup failed: ${(err as Error).message}` }, { status: 500 })
  }
  if (session.settled) {
    return Response.json({ error: 'session already settled' }, { status: 400 })
  }
  if (session.tokenId === 0n) {
    return Response.json({ error: 'session not found' }, { status: 404 })
  }

  // Gate: after ownership transfer, authorizations are wiped. This check is
  // what turns "seller sold the iNFT" into "seller's executor cannot serve".
  const authorized = await executorStillAuthorized(session.tokenId)
  if (!authorized) {
    return Response.json({
      error: 'executor no longer authorized for this iNFT (ownership changed)',
    }, { status: 403 })
  }

  // 2) Resolve persona from on-chain metadata (falls back to seed personas).
  const nft = new ethers.Contract(
    ADDRESSES.KilnAgentNFT,
    ABIS.KilnAgentNFT as any,
    new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!),
  )
  let descriptions: string[] = []
  try {
    descriptions = await nft.dataDescriptionsOf(session.tokenId)
  } catch {}
  const persona = resolvePersona(session.tokenId.toString(), descriptions)
  const systemPrompt = persona.systemPrompt

  // 3) Pick ALL chat-capable providers and try them in order with one retry
  //    each. 0G Compute's upstream models (Qwen, GPT-OSS) occasionally 5xx;
  //    we should not give up after a single shot.
  await ensureLedger(3)
  const services: any[] = (await listInferenceServices()) as any
  const chatCapable = services.filter((s) => {
    const m = (s.model ?? s.name ?? '').toLowerCase()
    return m && !m.includes('image') && !m.includes('whisper') && !m.includes('flux')
  })
  if (chatCapable.length === 0) {
    return Response.json({ error: 'no chat-capable inference provider available' }, { status: 503 })
  }

  const finalMessages = [
    { role: 'system', content: systemPrompt },
    ...args.messages,
  ]
  const lastUserMessage = [...args.messages].reverse().find((m) => m.role === 'user')?.content

  type Attempt = { provider: string; status?: number; note: string }
  const attempts: Attempt[] = []

  for (const svc of chatCapable) {
    const providerAddress = svc.provider ?? svc.providerAddress
    try {
      await prepareProvider(providerAddress, 0.5)
    } catch {
      // ignore · may already be prepared
    }

    // Two attempts per provider with a small backoff between them
    for (let i = 0; i < 2; i++) {
      let handles: Awaited<ReturnType<typeof inferenceHandles>>
      try {
        handles = await inferenceHandles(providerAddress, lastUserMessage)
      } catch (err: unknown) {
        attempts.push({ provider: providerAddress, note: `handles: ${(err as Error).message}` })
        break
      }
      const { endpoint, model, headers } = handles

      let upstream: Response
      try {
        upstream = await fetch(`${endpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(headers as unknown as Record<string, string>),
          },
          body: JSON.stringify({
            model,
            messages: finalMessages,
            stream: args.stream,
          }),
        })
      } catch (err: unknown) {
        attempts.push({ provider: providerAddress, note: `fetch: ${(err as Error).message}` })
        await sleep(400 + i * 600)
        continue
      }

      if (upstream.ok) {
        if (!args.stream || !upstream.body) {
          const json = await upstream.json()
          return Response.json(json)
        }
        return new Response(upstream.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        })
      }

      // Non-2xx · record and retry or try next provider
      attempts.push({ provider: providerAddress, status: upstream.status, note: `model=${svc.model}` })
      // For 4xx we stop retrying this provider (bad request) but try the next one
      if (upstream.status >= 400 && upstream.status < 500) break
      await sleep(500 + i * 700)
    }
  }

  // Exhausted every provider · return a clean client-parseable error
  return Response.json(
    {
      error: 'All inference providers returned errors. Try again in a moment.',
      retriable: true,
      attempts,
    },
    { status: 502 },
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
