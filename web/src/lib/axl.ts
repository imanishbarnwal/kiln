/// Tiny AXL HTTP client.
///
/// AXL is a Go binary running locally on each node that exposes an HTTP
/// bridge on `127.0.0.1:<api_port>` for application code to send and
/// receive messages over a peer-to-peer mesh (Yggdrasil + gVisor TCP).
///
/// Two endpoints we use:
///   POST /send   · fire-and-forget to a peer (header X-Destination-Peer-Id)
///   GET  /recv   · long-poll inbound queue · 204 when empty, 200 with body
///
/// We layer a JSON envelope on top so we can route multiple logical
/// streams (e.g. council synthesis vs unrelated future flows) through the
/// same single transport. The envelope is just `{kind, queryId, payload}`.

export type AxlEnvelope<P = unknown> = {
  kind: string
  queryId: string
  payload: P
}

export type AxlNodeRef = {
  /// Where the local AXL HTTP bridge is listening.
  apiUrl: string
  /// Optional friendly label for logs.
  label?: string
}

export const COACH_NODE: AxlNodeRef = {
  apiUrl: process.env.AXL_COACH_API ?? 'http://127.0.0.1:9102',
  label: 'coach',
}

export const SYNTH_NODE: AxlNodeRef = {
  apiUrl: process.env.AXL_SYNTH_API ?? 'http://127.0.0.1:9112',
  label: 'synth',
}

export const COACH_PEER_ID =
  process.env.AXL_COACH_PEER_ID ??
  '2173c08c43b1c3db30b818549b82388c698a3a5908d5cc21db0febe7d9508743'

export const SYNTH_PEER_ID =
  process.env.AXL_SYNTH_PEER_ID ??
  'd6736b287c65ce222fad051d20ad0551cbfde5393fbc2c548f787d49227e3d2b'

/// Send a JSON envelope from `node` to a remote peer. Resolves once the
/// local bridge accepts the message · delivery is async over the mesh.
export async function axlSend<P>(
  node: AxlNodeRef,
  destinationPeerId: string,
  envelope: AxlEnvelope<P>,
): Promise<void> {
  const body = new TextEncoder().encode(JSON.stringify(envelope))
  const res = await fetch(`${node.apiUrl}/send`, {
    method: 'POST',
    headers: {
      'X-Destination-Peer-Id': destinationPeerId,
      'Content-Type': 'application/octet-stream',
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`axl send failed (${node.label ?? node.apiUrl}): ${res.status} ${text}`)
  }
}

/// Single non-blocking poll. Returns null if the queue is empty.
export async function axlPoll(
  node: AxlNodeRef,
): Promise<{ from: string; envelope: AxlEnvelope } | null> {
  const res = await fetch(`${node.apiUrl}/recv`)
  if (res.status === 204) return null
  if (!res.ok) {
    throw new Error(`axl recv failed (${node.label ?? node.apiUrl}): ${res.status}`)
  }
  const from = res.headers.get('X-From-Peer-Id') ?? ''
  const buf = await res.arrayBuffer()
  const text = new TextDecoder().decode(new Uint8Array(buf))
  let envelope: AxlEnvelope
  try {
    envelope = JSON.parse(text)
  } catch {
    throw new Error(`axl recv: non-JSON payload (${text.slice(0, 60)}…)`)
  }
  return { from, envelope }
}

/// Block until a message with the matching kind+queryId arrives, or until
/// `timeoutMs` elapses. Polls every `intervalMs`. Useful for request /
/// response patterns layered on top of fire-and-forget /send.
export async function axlWaitFor<P = unknown>(
  node: AxlNodeRef,
  match: { kind: string; queryId: string },
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<AxlEnvelope<P>> {
  const timeoutMs = opts.timeoutMs ?? 60_000
  const intervalMs = opts.intervalMs ?? 250
  const start = Date.now()
  // Keep a side-buffer of envelopes that arrived but didn't match · we
  // re-deliver them by leaving them in the AXL recv queue. Practically
  // for v1 we just discard mismatched envelopes (council is the only
  // flow that uses /recv right now). Trade-off documented here so the
  // next person to add a flow knows to reach for a fan-out subscriber.
  while (Date.now() - start < timeoutMs) {
    const got = await axlPoll(node)
    if (got && got.envelope.kind === match.kind && got.envelope.queryId === match.queryId) {
      return got.envelope as AxlEnvelope<P>
    }
    if (!got) {
      await sleep(intervalMs)
    }
    // else · drop and continue (see comment above)
  }
  throw new Error(`axl waitFor timed out after ${timeoutMs}ms for ${match.kind}/${match.queryId}`)
}

export async function axlTopology(node: AxlNodeRef): Promise<{
  our_public_key: string
  peers: Array<{ public_key: string; up: boolean }>
}> {
  const res = await fetch(`${node.apiUrl}/topology`)
  if (!res.ok) throw new Error(`axl topology failed (${node.label ?? node.apiUrl}): ${res.status}`)
  return res.json()
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
