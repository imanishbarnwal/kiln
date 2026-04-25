'use client'

/// Reputation derived from on-chain event history.
///
/// Right now the only signal is the count of settled sessions per iNFT.
/// The rating is recorded at endSession(rating), but since auto-settle
/// always passes a 5 we leave the average out of the UI for honesty · we
/// surface `sessions` and compute an optional average only when two or
/// more distinct rating values have been observed.
///
/// Cheap enough on testnet for a marketplace with <1000 tokens. For
/// production we would index these events server-side and cache; here
/// we scan per-page and debounce via the in-memory cache below.

import { ethers } from 'ethers'
import { ABIS, ADDRESSES } from './contracts'

export type Reputation = {
  sessions: number
  ratingSum: number        // sum of ratings across settled sessions
  ratingSamples: number    // how many sessions had a rating (same as `sessions` today)
  avgRating: number | null // null when not enough diversity to compute
}

const EMPTY: Reputation = { sessions: 0, ratingSum: 0, ratingSamples: 0, avgRating: null }

type Cache = Record<string, { at: number; value: Reputation }>
const CACHE: Cache = {}
const TTL_MS = 30_000

function cacheKey(tokenId: bigint | string | number): string {
  return String(tokenId)
}

function getCached(tokenId: bigint | string | number): Reputation | null {
  const hit = CACHE[cacheKey(tokenId)]
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) return null
  return hit.value
}

function setCached(tokenId: bigint | string | number, value: Reputation) {
  CACHE[cacheKey(tokenId)] = { at: Date.now(), value }
}

/// Read reputation for many tokens in one pass. Returns a keyed record
/// with `tokenId.toString()` keys. Any token with no settled sessions
/// maps to the zero value, never undefined.
export async function readReputationFor(
  provider: ethers.JsonRpcProvider,
  tokenIds: (bigint | string | number)[],
): Promise<Record<string, Reputation>> {
  const want = new Set(tokenIds.map((t) => String(t)))
  const out: Record<string, Reputation> = {}

  // seed with cached + empty
  for (const t of tokenIds) {
    const cached = getCached(t)
    out[String(t)] = cached ?? { ...EMPTY }
  }
  const missing = [...want].filter((k) => !getCached(k))
  if (missing.length === 0) return out

  const market = new ethers.Contract(ADDRESSES.KilnMarket, ABIS.KilnMarket as any, provider)

  // 1. Pull all SessionStarted events and index by tokenId. Cheap on testnet.
  const startedFilter = market.filters.SessionStarted()
  const startedEvents = await market.queryFilter(startedFilter, 0, 'latest')

  // sessionId -> tokenId
  const sessionToken: Record<string, string> = {}
  // tokenId -> sessionId[]
  const tokenSessions: Record<string, string[]> = {}
  for (const ev of startedEvents) {
    const args = (ev as ethers.EventLog).args
    if (!args) continue
    const sid = (args.sessionId as bigint).toString()
    const tid = (args.tokenId as bigint).toString()
    sessionToken[sid] = tid
    if (!tokenSessions[tid]) tokenSessions[tid] = []
    tokenSessions[tid].push(sid)
  }

  // 2. Pull all SessionEnded events, correlate via sessionToken map.
  const endedFilter = market.filters.SessionEnded()
  const endedEvents = await market.queryFilter(endedFilter, 0, 'latest')

  // seed each missing tokenId with zero
  const tally: Record<string, Reputation> = {}
  for (const t of missing) tally[t] = { ...EMPTY }

  for (const ev of endedEvents) {
    const args = (ev as ethers.EventLog).args
    if (!args) continue
    const sid = (args.sessionId as bigint).toString()
    const tid = sessionToken[sid]
    if (!tid || !want.has(tid)) continue
    const rating = Number(args.rating as number | bigint)
    const cur = tally[tid] ?? { ...EMPTY }
    cur.sessions += 1
    cur.ratingSum += rating
    cur.ratingSamples += 1
    tally[tid] = cur
  }

  // finalize avg rating only when there is observed variance (see comment above)
  for (const t of missing) {
    const r = tally[t] ?? { ...EMPTY }
    r.avgRating = r.ratingSamples > 0 ? r.ratingSum / r.ratingSamples : null
    out[t] = r
    setCached(t, r)
  }
  return out
}

export async function readReputation(
  provider: ethers.JsonRpcProvider,
  tokenId: bigint | string | number,
): Promise<Reputation> {
  const batch = await readReputationFor(provider, [tokenId])
  return batch[String(tokenId)] ?? { ...EMPTY }
}
