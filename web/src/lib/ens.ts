/// ENS reverse-lookup helper.
///
/// ENS reverse records live on Ethereum mainnet, so this hits a public
/// mainnet RPC regardless of which 0G chain the rest of the app is on.
///
/// Caching strategy:
///   - In-memory map for the lifetime of the page
///   - sessionStorage write-through so a page refresh keeps the names
///   - 24h TTL since ENS names rarely change
///
/// Forward resolution (name → address) is also exposed for input hints
/// (e.g., the Transfer modal) but not cached as aggressively because
/// users may type many candidates.

import { ethers } from 'ethers'

const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const CACHE_KEY_PREFIX = 'kiln.ens.'

let _provider: ethers.JsonRpcProvider | null = null
function provider(): ethers.JsonRpcProvider {
  if (_provider) return _provider
  // Prefer llamarpc; fall back to cloudflare via FallbackProvider would be nice
  // but the simple JsonRpcProvider is enough for ENS reverse lookups.
  _provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com')
  return _provider
}

type CacheEntry = { name: string | null; at: number }

const memCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<string | null>>()

function lower(addr: string): string {
  return addr.toLowerCase()
}

function readSessionCache(addr: string): CacheEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY_PREFIX + lower(addr))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    if (Date.now() - parsed.at > TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeSessionCache(addr: string, entry: CacheEntry) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(CACHE_KEY_PREFIX + lower(addr), JSON.stringify(entry))
  } catch {}
}

/// Resolve an EVM address to its ENS name. Returns `null` when the
/// address has no primary ENS record (the common case).
export async function resolveAddress(address: string | null | undefined): Promise<string | null> {
  if (!address || !ethers.isAddress(address)) return null
  const key = lower(address)

  // mem cache
  const memHit = memCache.get(key)
  if (memHit && Date.now() - memHit.at < TTL_MS) return memHit.name

  // session cache
  const sessHit = readSessionCache(address)
  if (sessHit) {
    memCache.set(key, sessHit)
    return sessHit.name
  }

  // dedupe inflight requests for the same address
  const pending = inflight.get(key)
  if (pending) return pending

  const p = (async () => {
    try {
      const name = await provider().lookupAddress(address)
      const entry: CacheEntry = { name: name ?? null, at: Date.now() }
      memCache.set(key, entry)
      writeSessionCache(address, entry)
      return entry.name
    } catch {
      // Cache the miss for a much shorter window so we don't spam mainnet RPC
      // when it's flaking, but also don't lock in "no ENS" forever.
      const entry: CacheEntry = { name: null, at: Date.now() - (TTL_MS - 60_000) }
      memCache.set(key, entry)
      return null
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, p)
  return p
}

/// Resolve an ENS name (e.g. "vitalik.eth") to an address. Used by the
/// Transfer modal to autocomplete recipient addresses. Not cached here
/// since users typically type many candidates while testing.
export async function resolveName(name: string | null | undefined): Promise<string | null> {
  if (!name) return null
  const trimmed = name.trim().toLowerCase()
  if (!trimmed.includes('.')) return null
  try {
    const addr = await provider().resolveName(trimmed)
    return addr ?? null
  } catch {
    return null
  }
}

/// Compact display: "vitalik.eth" if resolvable, otherwise "0x9FBB…2303".
export function shortAddress(address: string | null | undefined): string {
  if (!address || !ethers.isAddress(address)) return ''
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
