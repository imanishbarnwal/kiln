'use client'

import { useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { ABIS, ADDRESSES } from './contracts'
import { READ_RPC_URL } from './chains'
import { resolvePersona, type Persona } from './persona'

const CACHE = new Map<string, Persona>()

/// Drop a cached persona so the next read fetches from chain.
/// Call this after a successful refine() so the new persona text propagates
/// across pages without a full reload.
export function invalidatePersonaCache(tokenId: string | number | bigint) {
  CACHE.delete(String(tokenId))
}

export function usePersona(tokenId: string | number | bigint | null | undefined) {
  const key = tokenId === null || tokenId === undefined ? null : tokenId.toString()
  const [persona, setPersona] = useState<Persona | null>(
    key ? CACHE.get(key) ?? null : null,
  )
  const [loading, setLoading] = useState(false)

  const readProvider = useMemo(
    () => new ethers.JsonRpcProvider(READ_RPC_URL),
    [],
  )

  useEffect(() => {
    if (!key) return
    const cached = CACHE.get(key)
    if (cached) { setPersona(cached); return }

    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const nft = new ethers.Contract(
          ADDRESSES.KilnAgentNFT,
          ABIS.KilnAgentNFT as any,
          readProvider,
        )
        const descriptions: string[] = await nft.dataDescriptionsOf(BigInt(key))
        const p = resolvePersona(key, descriptions)
        if (!cancelled) {
          CACHE.set(key, p)
          setPersona(p)
        }
      } catch {
        if (!cancelled) setPersona(resolvePersona(key, []))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [key, readProvider])

  return { persona, loading }
}

/// Batch-read personas for many tokenIds. Used by the marketplace list.
export async function readPersonasBatch(
  tokenIds: (string | bigint)[],
): Promise<Record<string, Persona>> {
  const readProvider = new ethers.JsonRpcProvider(READ_RPC_URL)
  const nft = new ethers.Contract(
    ADDRESSES.KilnAgentNFT,
    ABIS.KilnAgentNFT as any,
    readProvider,
  )
  const out: Record<string, Persona> = {}
  for (const id of tokenIds) {
    const key = id.toString()
    const cached = CACHE.get(key)
    if (cached) { out[key] = cached; continue }
    try {
      const descriptions: string[] = await nft.dataDescriptionsOf(BigInt(key))
      const p = resolvePersona(key, descriptions)
      CACHE.set(key, p)
      out[key] = p
    } catch {
      const p = resolvePersona(key, [])
      out[key] = p
    }
  }
  return out
}
