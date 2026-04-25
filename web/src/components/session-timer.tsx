'use client'

/// Countdown timer for a rent session. Auto-settles the session on chain
/// when it reaches zero so the coach actually gets paid even if the
/// student walks away.
///
/// Persistence: the timer's start timestamp is written to sessionStorage
/// keyed by sessionId, so a page refresh does not reset the clock. If a
/// previously-opened session is still within its window when the chat
/// page mounts, the caller can rehydrate via `loadPersistedStart(id)`.

import { useEffect, useState } from 'react'

export const DEFAULT_SESSION_SECONDS = 30 * 60 // 30 minutes

export function sessionStorageKey(sessionId: string) {
  return `kiln.session.start.${sessionId}`
}

export function persistSessionStart(sessionId: string, startMs: number) {
  try {
    sessionStorage.setItem(sessionStorageKey(sessionId), String(startMs))
  } catch {}
}

export function loadPersistedStart(sessionId: string): number | null {
  try {
    const v = sessionStorage.getItem(sessionStorageKey(sessionId))
    return v ? Number(v) : null
  } catch {
    return null
  }
}

export function clearPersistedStart(sessionId: string) {
  try {
    sessionStorage.removeItem(sessionStorageKey(sessionId))
  } catch {}
}

type Props = {
  sessionId: string
  startMs: number
  totalSeconds?: number
  onExpired?: () => void
}

export function SessionTimer({
  sessionId,
  startMs,
  totalSeconds = DEFAULT_SESSION_SECONDS,
  onExpired,
}: Props) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = Math.max(0, Math.floor((now - startMs) / 1000))
  const remaining = Math.max(0, totalSeconds - elapsed)
  const expired = remaining === 0

  useEffect(() => {
    if (expired) onExpired?.()
    // intentionally once on transition: the parent owns the settle call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired])

  const mm = Math.floor(remaining / 60).toString().padStart(2, '0')
  const ss = (remaining % 60).toString().padStart(2, '0')
  const pct = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 0

  // Color tilts from ember-hot (plenty of time) toward ember-deep (running low).
  const warn = remaining <= 60
  const tone = warn ? 'text-[var(--kiln-danger)]' : 'text-[var(--kiln-ember-hot)]'

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="relative w-2 h-2 rounded-full bg-[var(--kiln-ember)] shrink-0">
          {!expired && (
            <span className="absolute inset-0 rounded-full bg-[var(--kiln-ember)] animate-ping opacity-60" />
          )}
        </div>
        <span className={`font-mono text-sm tabular-nums ${tone}`}>
          {expired ? 'time up' : `${mm}:${ss}`}
        </span>
      </div>
      <div className="hidden md:block w-24 h-1 rounded-full bg-[var(--kiln-bg-2)] overflow-hidden">
        <div
          className="h-full bg-[var(--kiln-ember)] transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="sr-only" aria-live="polite">
        Session {sessionId}: {remaining} seconds remaining
      </span>
    </div>
  )
}
