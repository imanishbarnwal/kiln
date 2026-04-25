/// One-shot inference helper · server only.
///
/// The streaming session route at `/api/inference/session/[id]` already
/// has the full multi-provider fallback machinery for the chat flow.
/// Council mode and the synth worker need a simpler primitive: take a
/// system prompt + a single user message, get back a string. Streaming
/// is unnecessary because each coach reply renders as a unit and the
/// synthesizer treats the whole thing as input anyway.
///
/// We re-use the same provider list, `prepareProvider` warm-up, and
/// retry pattern, but collapse the response handling to a single
/// non-streamed completion read.

import {
  ensureLedger,
  inferenceHandles,
  listInferenceServices,
  prepareProvider,
} from './compute'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type RunOneShotResult = {
  text: string
  provider: string
  model: string
  attempts: Array<{ provider: string; status?: number; note: string }>
}

export async function runOneShot(messages: ChatMessage[]): Promise<RunOneShotResult> {
  if (!messages.length) throw new Error('runOneShot: messages must not be empty')

  await ensureLedger(3)
  const services: any[] = (await listInferenceServices()) as any
  const chatCapable = services.filter((s) => {
    const m = (s.model ?? s.name ?? '').toLowerCase()
    return m && !m.includes('image') && !m.includes('whisper') && !m.includes('flux')
  })
  if (!chatCapable.length) {
    throw new Error('no chat-capable inference provider available')
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content
  const attempts: RunOneShotResult['attempts'] = []

  for (const svc of chatCapable) {
    const providerAddress: string = svc.provider ?? svc.providerAddress
    try { await prepareProvider(providerAddress, 0.5) } catch {}

    for (let i = 0; i < 2; i++) {
      let handles: Awaited<ReturnType<typeof inferenceHandles>>
      try {
        handles = await inferenceHandles(providerAddress, lastUser)
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
          body: JSON.stringify({ model, messages, stream: false }),
        })
      } catch (err: unknown) {
        attempts.push({ provider: providerAddress, note: `fetch: ${(err as Error).message}` })
        await sleep(400 + i * 600)
        continue
      }

      if (upstream.ok) {
        const json = (await upstream.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const text = json.choices?.[0]?.message?.content ?? ''
        return { text, provider: providerAddress, model: String(model), attempts }
      }

      attempts.push({ provider: providerAddress, status: upstream.status, note: `model=${svc.model}` })
      if (upstream.status >= 400 && upstream.status < 500) break
      await sleep(500 + i * 700)
    }
  }

  throw Object.assign(
    new Error('All inference providers returned errors'),
    { attempts, retriable: true },
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
