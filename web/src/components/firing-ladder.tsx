'use client'

/// Firing-sequence ladder for the onboard flow.
///
/// Replaces the previous "single phase label on a button" affordance
/// with a vertical ladder of all phases, an active-row pulse, and a
/// horizontal heat bar that fills as the kiln "warms up". Pure
/// presentation · the parent owns the phase state and the mint logic.
///
/// Why a ladder instead of a generic spinner:
///   - users see what's coming next, not just what's happening now
///   - on flake we can call out which phase failed without re-thinking
///     the whole component
///   - matches the editorial register of the rest of the site (kiln-card
///     + kiln-stamp + kiln-rule) without adding any new visual vocabulary

import type { ComponentProps } from 'react'

export type FiringPhase =
  | 'idle'
  | 'switching'
  | 'encrypting'
  | 'uploading'
  | 'indexing'
  | 'minting'
  | 'done'

const PHASES: { key: Exclude<FiringPhase, 'idle' | 'done'>; label: string; sub?: string }[] = [
  { key: 'switching', label: 'Switch network', sub: 'Galileo · chainId 16602' },
  { key: 'encrypting', label: 'Seal artifact', sub: 'AES-256-GCM in your browser' },
  { key: 'uploading', label: 'Load into the chamber', sub: '0G Storage · encrypted blob' },
  { key: 'indexing', label: 'Index notes for retrieval', sub: 'BM25 manifest · plaintext chunks' },
  { key: 'minting', label: 'Fire on-chain', sub: 'KilnAgentNFT.mint() · ERC-7857' },
]

const ORDER: Record<FiringPhase, number> = {
  idle: -1,
  switching: 0,
  encrypting: 1,
  uploading: 2,
  indexing: 3,
  minting: 4,
  done: 5,
}

type Status = 'queued' | 'active' | 'done'

function statusOf(rowIdx: number, phase: FiringPhase): Status {
  const cur = ORDER[phase]
  if (cur > rowIdx) return 'done'
  if (cur === rowIdx) return 'active'
  return 'queued'
}

function progressPercent(phase: FiringPhase): number {
  if (phase === 'idle') return 0
  if (phase === 'done') return 100
  const idx = ORDER[phase]
  // Halfway through the active step · gives the bar a smooth march even
  // if a phase finishes faster than the user can perceive.
  return Math.min(100, Math.round(((idx + 0.5) / PHASES.length) * 100))
}

export function FiringLadder({ phase, ragChunkCount }: { phase: FiringPhase; ragChunkCount?: number | null }) {
  if (phase === 'idle') return null
  const pct = progressPercent(phase)

  return (
    <div className="kiln-card kiln-ticked p-5 md:p-6 mt-6 max-w-xl kiln-rise" aria-live="polite">
      <div className="flex items-center justify-between mb-4">
        <span className="kiln-label">Firing sequence</span>
        <span className="kiln-stamp text-[var(--kiln-fg-2)]">
          {phase === 'done' ? 'Complete' : `${pct}%`}
        </span>
      </div>

      <ol className="space-y-2.5">
        {PHASES.map((p, i) => {
          const s = statusOf(i, phase)
          return (
            <li
              key={p.key}
              className={`flex items-center gap-3 transition-opacity duration-300 ${
                s === 'queued' ? 'opacity-45' : 'opacity-100'
              }`}
            >
              <Indicator status={s} />
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-mono ${
                    s === 'active'
                      ? 'text-[var(--kiln-ember-hot)]'
                      : s === 'done'
                      ? 'text-[var(--kiln-fg-1)]'
                      : 'text-[var(--kiln-fg-2)]'
                  }`}
                >
                  {p.label}
                  {p.key === 'indexing' && s === 'done' && typeof ragChunkCount === 'number' && (
                    <span className="ml-2 text-[var(--kiln-fg-3)] text-xs">
                      · {ragChunkCount} chunk{ragChunkCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                {p.sub && (
                  <div className="text-[0.6875rem] text-[var(--kiln-fg-3)] font-mono normal-case tracking-normal mt-0.5">
                    {p.sub}
                  </div>
                )}
              </div>
              {s === 'active' && <DotsTrail />}
              {s === 'done' && (
                <span className="text-[0.6875rem] kiln-stamp text-[var(--kiln-fg-3)]">done</span>
              )}
            </li>
          )
        })}
      </ol>

      {/* Heat bar · tracks overall progress through the kiln */}
      <div className="mt-5 pt-4 border-t border-[var(--kiln-border-soft)]">
        <div
          className="relative h-1 rounded-full bg-[var(--kiln-bg-3)] overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
            style={{
              width: `${pct}%`,
              background:
                'linear-gradient(90deg, rgba(255,126,63,0.35) 0%, rgba(255,90,31,0.85) 60%, rgba(255,174,90,0.95) 100%)',
              boxShadow: '0 0 12px -2px rgba(255,90,31,0.5)',
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[0.6875rem] font-mono text-[var(--kiln-fg-3)]">
          <span>cold</span>
          <span>fired</span>
        </div>
      </div>
    </div>
  )
}

/* ----------------------- internal indicators ----------------------- */

function Indicator({ status }: { status: Status }) {
  if (status === 'done') {
    return (
      <span
        aria-hidden
        className="w-4 h-4 rounded-full flex items-center justify-center bg-[var(--kiln-ember)]/20 text-[var(--kiln-ember-hot)] flex-shrink-0"
      >
        <CheckGlyph />
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span
        aria-hidden
        className="w-4 h-4 rounded-full flex-shrink-0 kiln-dot-live"
        style={{
          background: 'radial-gradient(circle, var(--kiln-ember-hot) 0%, var(--kiln-ember) 60%, transparent 90%)',
        }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className="w-4 h-4 rounded-full border border-[var(--kiln-border)] flex-shrink-0"
    />
  )
}

function CheckGlyph(props: ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.5 6.5L5 9l4.5-5.5" />
    </svg>
  )
}

/// Three ember dots pulsing in sequence · classic loading shimmer at
/// the right edge of the active row. Pure CSS, no JS animation loop.
function DotsTrail() {
  return (
    <span aria-hidden className="inline-flex items-center gap-[3px] flex-shrink-0">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-[var(--kiln-ember-hot)] kiln-dot-live"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  )
}
