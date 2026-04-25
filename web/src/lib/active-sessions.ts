'use client'

/// Find unsettled sessions for a set of tokenIds by scanning
/// `SessionStarted` events from the KilnMarket contract. Returns the
/// session id, token id, and start-timestamp (ms) derived from the block
/// the event was mined into.
///
/// Cheap enough on testnet for the demo. For production we would index
/// events server-side or add a `tokenIdToActiveSession` mapping to the
/// contract.

import { ethers } from 'ethers'
import { ABIS, ADDRESSES } from './contracts'

export type ActiveSession = {
  sessionId: bigint
  tokenId: bigint
  student: string
  startMs: number
  amount: bigint
}

export async function readActiveSessionsFor(
  provider: ethers.JsonRpcProvider,
  tokenIds: bigint[],
): Promise<Record<string, ActiveSession>> {
  if (tokenIds.length === 0) return {}
  const wanted = new Set(tokenIds.map((t) => t.toString()))

  const market = new ethers.Contract(ADDRESSES.KilnMarket, ABIS.KilnMarket as any, provider)
  const filter = market.filters.SessionStarted()
  const events = await market.queryFilter(filter, 0, 'latest')

  // Most recent first so if the same token somehow had multiple unsettled
  // sessions (shouldn't happen in the current flow, but defensive) we take
  // the newest.
  events.sort((a, b) => b.blockNumber - a.blockNumber)

  const out: Record<string, ActiveSession> = {}
  for (const ev of events) {
    const eventLog = ev as ethers.EventLog
    const args = eventLog.args
    if (!args) continue
    const tokenId = args.tokenId as bigint
    const key = tokenId.toString()
    if (!wanted.has(key)) continue
    if (out[key]) continue // already got a newer one for this token

    const sessionId = args.sessionId as bigint
    const student = args.student as string
    const amount = args.amount as bigint

    const sess: any = await market.sessions(sessionId)
    const settled = Boolean(sess.settled ?? sess[3])
    if (settled) continue

    const block = await provider.getBlock(eventLog.blockNumber)
    const startMs = block ? Number(block.timestamp) * 1000 : Date.now()

    out[key] = { sessionId, tokenId, student, startMs, amount }
  }
  return out
}
