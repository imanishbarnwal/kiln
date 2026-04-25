'use client'

import type { Reputation } from '@/lib/reputation'

/// Compact reputation marker shown alongside a coach's name.
///
/// Zero state: renders nothing so fresh iNFTs do not advertise emptiness.
/// Session count + optional average rating shown in mono.

export function RepBadge({ rep, className = '' }: { rep: Reputation | undefined; className?: string }) {
  if (!rep || rep.sessions === 0) return null

  const avg = rep.avgRating
  const showAvg = avg !== null && rep.ratingSamples >= 2

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[0.6875rem] text-[var(--kiln-fg-2)] ${className}`}>
      <span className="inline-flex items-center gap-1">
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-[var(--kiln-ember-hot)]" fill="currentColor" aria-hidden>
          <circle cx="5" cy="5" r="2.2" />
        </svg>
        <span className="text-[var(--kiln-fg-1)] tabular-nums">{rep.sessions}</span>
        <span>session{rep.sessions === 1 ? '' : 's'}</span>
      </span>
      {showAvg && (
        <span className="inline-flex items-center gap-1 pl-1 ml-1 border-l border-[var(--kiln-border-soft)]">
          <span className="text-[var(--kiln-gold)]">★</span>
          <span className="text-[var(--kiln-fg-1)] tabular-nums">{avg.toFixed(1)}</span>
        </span>
      )}
    </span>
  )
}
