'use client'

import { useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { readReputationFor, type Reputation } from './reputation'

export function useReputationBatch(tokenIds: (string | bigint | number)[]) {
  const [map, setMap] = useState<Record<string, Reputation>>({})
  const [loading, setLoading] = useState(false)

  const provider = useMemo(
    () => new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai'),
    [],
  )

  // Stable cache key; avoid re-running on identical arrays
  const ids = useMemo(() => tokenIds.map(String), [tokenIds])
  const key = useMemo(() => ids.join(','), [ids])

  useEffect(() => {
    if (ids.length === 0) {
      setMap({})
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const r = await readReputationFor(provider, ids)
        if (!cancelled) setMap(r)
      } catch {
        // silent · UI shows 0 sessions gracefully
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, provider])

  return { map, loading }
}

export function useReputation(tokenId: string | bigint | number | null | undefined) {
  const ids = useMemo(
    () => (tokenId === null || tokenId === undefined ? [] : [String(tokenId)]),
    [tokenId],
  )
  const { map, loading } = useReputationBatch(ids)
  const rep = tokenId !== null && tokenId !== undefined ? map[String(tokenId)] : undefined
  return { rep, loading }
}

export type { Reputation } from './reputation'
