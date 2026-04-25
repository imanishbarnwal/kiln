/// Council Synthesizer · standalone worker that runs alongside `pnpm dev`.
///
/// Polls the synth-side AXL node for incoming `council/synthesize`
/// envelopes, runs a single 0G Compute call against a synthesizer
/// prompt that combines the per-coach replies, then ships the result
/// back over AXL to the coach node.
///
/// The whole point of this worker is to demonstrate that the
/// synthesis step lives on a different process than the orchestrator.
/// On the demo machine that means a different OS process with its own
/// AXL node binding; on real infra it would be a different VM.
///
/// Run from `web/`:
///   pnpm tsx src/server/council-synth-worker.ts
///
/// Env requirements (same as the rest of the app):
///   ZG_RPC_URL
///   KILN_OPS_PK   · pays for synthesis inference
///   AXL_SYNTH_API · default http://127.0.0.1:9112

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="node" />

import 'dotenv/config'
import { runOneShot, type ChatMessage } from '../lib/inference-server.js'
import {
  COACH_PEER_ID,
  SYNTH_NODE,
  axlPoll,
  axlSend,
  axlTopology,
} from '../lib/axl.js'

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

const SYSTEM_PROMPT = `You are the Council synthesizer for the Kiln marketplace.

Multiple expert coaches just answered the same student question. Your job:
1. Read all the replies.
2. Find genuine agreement, surface real disagreement.
3. Produce a single paragraph (max 6 sentences) that the student can act on.
4. End with a one-line verdict prefixed exactly with "Verdict: ".
5. After the verdict, on a new line, output exactly one line of the form
   "BestFit: <tokenId>" naming the iNFT whose reply was the strongest fit
   for the student's actual question. Pick from the iNFT IDs labelled in
   the input. If two are tied, pick the one with the most concrete advice.

Never repeat the question. Never restate the coaches' replies verbatim.
Never break character into "as an AI". Speak in the same direct register as
the coaches. If the coaches disagree, say so plainly · do not hedge.`

async function buildSynthesisMessages(req: SynthesisRequest): Promise<ChatMessage[]> {
  const labeled = req.replies
    .map((r, i) => `### Coach ${i + 1} · ${r.name} (${r.category}, iNFT #${r.tokenId})\n${r.text.trim()}`)
    .join('\n\n')

  const userBlock = `Student question:\n"""${req.query.trim()}"""\n\nCoach replies:\n${labeled}`

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userBlock },
  ]
}

/// Pull the BestFit tag out of the synth's reply and strip the tag from
/// the human-readable verdict. The synth is told to emit
///   Verdict: …
///   BestFit: <tokenId>
/// but a fragile model can drift · we accept any line that looks like
/// "best fit" + a number, and only keep tokenIds that were actually in
/// the request (so a hallucinated id never reaches the client).
function extractBestFit(raw: string, validIds: string[]): { text: string; bestFitTokenId: string | null } {
  const lines = raw.split(/\r?\n/)
  const idSet = new Set(validIds.map((s) => s.toString()))
  let bestFitTokenId: string | null = null
  const kept: string[] = []
  for (const line of lines) {
    const m = line.match(/best\s*fit\s*[:=]\s*#?(\d+)/i)
    if (m && idSet.has(m[1])) {
      bestFitTokenId = m[1]
      continue
    }
    kept.push(line)
  }
  return { text: kept.join('\n').trim(), bestFitTokenId }
}

async function handle(envelope: { kind: string; queryId: string; payload: SynthesisRequest }) {
  const t0 = Date.now()
  console.log(`[synth] ← ${envelope.kind} ${envelope.queryId} · ${envelope.payload.replies.length} replies`)
  let result
  try {
    const messages = await buildSynthesisMessages(envelope.payload)
    result = await runOneShot(messages)
  } catch (err: unknown) {
    console.error(`[synth] inference failed for ${envelope.queryId}:`, (err as Error).message)
    result = {
      text: `_(synthesizer offline · ${(err as Error).message})_`,
      provider: '',
      model: '',
      attempts: [] as { provider: string; status?: number; note: string }[],
    }
  }
  const validIds = envelope.payload.replies.map((r) => r.tokenId)
  const { text, bestFitTokenId } = extractBestFit(result.text, validIds)
  await axlSend(SYNTH_NODE, COACH_PEER_ID, {
    kind: 'council/result',
    queryId: envelope.queryId,
    payload: { text, bestFitTokenId, provider: result.provider, model: result.model },
  })
  console.log(`[synth] → council/result ${envelope.queryId} · ${Date.now() - t0}ms · bestFit=${bestFitTokenId ?? 'none'}`)
}

async function main() {
  // Sanity check: confirm the synth node is up and report its peer id.
  let topo
  try {
    topo = await axlTopology(SYNTH_NODE)
  } catch (err: unknown) {
    console.error(`[synth] cannot reach AXL node at ${SYNTH_NODE.apiUrl}:`, (err as Error).message)
    console.error(`[synth] start it first: cd axl && ./node -config synth-config.json`)
    process.exit(1)
  }
  console.log(`[synth] online · pubkey ${topo.our_public_key.slice(0, 16)}…`)
  console.log(`[synth] peers: ${topo.peers.map((p) => `${p.public_key.slice(0, 8)}…(${p.up ? 'up' : 'down'})`).join(', ') || '(none)'}`)
  console.log(`[synth] waiting for council/synthesize envelopes…`)

  // Long-poll loop · the AXL /recv endpoint returns 204 when the queue
  // is empty, so we sleep briefly between polls to avoid burning CPU.
  while (true) {
    let got
    try {
      got = await axlPoll(SYNTH_NODE)
    } catch (err: unknown) {
      console.error(`[synth] poll error:`, (err as Error).message)
      await sleep(2_000)
      continue
    }
    if (!got) {
      await sleep(250)
      continue
    }
    if (got.envelope.kind !== 'council/synthesize') {
      console.warn(`[synth] ignoring envelope of kind=${got.envelope.kind}`)
      continue
    }
    // Handle in the background so a slow inference doesn't stall the loop.
    handle(got.envelope as { kind: string; queryId: string; payload: SynthesisRequest }).catch((err) => {
      console.error(`[synth] unhandled error for ${got!.envelope.queryId}:`, err)
    })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

main().catch((err) => {
  console.error('[synth] fatal:', err)
  process.exit(1)
})
