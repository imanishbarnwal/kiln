'use client'

import { useEffect, useState } from 'react'
import { resolveAddress, shortAddress } from '@/lib/ens'

type Props = {
  address: string | null | undefined
  /** When true, renders the resolved name as a link to the ENS app. */
  link?: boolean
  /** Style variant. `compact` shows ens-or-short on one line. `dual` shows
   *  ens with the short address muted underneath. */
  variant?: 'compact' | 'dual'
  /** Optional tooltip override. */
  title?: string
  className?: string
}

/// Resolves an EVM address to an ENS primary name and renders it.
/// Falls back to the short form (`0x…1234`) while loading or when the
/// address has no ENS record. Network-light · cached aggressively.
export function EnsName({ address, link, variant = 'compact', title, className = '' }: Props) {
  const short = shortAddress(address)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setName(null)
    if (!address) return
    resolveAddress(address).then((n) => {
      if (!cancelled) setName(n)
    })
    return () => { cancelled = true }
  }, [address])

  if (!address) return null

  const displayed = name ?? short
  const tooltip = title ?? (name ? `${name} · ${address}` : address)

  if (variant === 'dual' && name) {
    return (
      <span className={`inline-flex flex-col leading-tight ${className}`} title={tooltip}>
        <span className="font-mono">{name}</span>
        <span className="font-mono text-[var(--kiln-fg-3)] text-[0.625rem]">{short}</span>
      </span>
    )
  }

  if (link && name) {
    return (
      <a
        href={`https://app.ens.domains/${name}`}
        target="_blank"
        rel="noreferrer"
        className={`font-mono ${className}`}
        title={tooltip}
      >
        {displayed}
      </a>
    )
  }

  return (
    <span className={`font-mono ${className}`} title={tooltip}>
      {displayed}
    </span>
  )
}
