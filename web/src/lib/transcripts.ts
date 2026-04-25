/// Chat transcript persistence in browser localStorage.
///
/// Layer 1 of the transcript story · students keep a copy of every chat
/// they paid for, scoped to their wallet address. Survives reloads but
/// not browser/device changes. Layer 2 (encrypted backup to 0G Storage
/// keyed by a wallet signature) is on the roadmap.

export type TranscriptMsg = {
  role: 'user' | 'assistant'
  content: string
}

export type Transcript = {
  sessionId: string
  tokenId: string
  coachName: string
  category?: string
  startedAt: number       // ms epoch when session opened
  updatedAt: number       // ms epoch of last write
  endedAt?: number        // ms epoch when settled (or expired)
  messages: TranscriptMsg[]
  /** Original payment tx hash, if known. Lets us link back to chainscan. */
  payTx?: string
  /** Settlement tx hash, if known. */
  settleTx?: string
}

const KEY_PREFIX = 'kiln.transcript.'

function key(wallet: string, sessionId: string): string {
  return `${KEY_PREFIX}${wallet.toLowerCase()}.${sessionId}`
}

function isOurKey(k: string): boolean {
  return k.startsWith(KEY_PREFIX)
}

function parseKey(k: string): { wallet: string; sessionId: string } | null {
  if (!isOurKey(k)) return null
  const rest = k.slice(KEY_PREFIX.length)
  const dot = rest.indexOf('.')
  if (dot < 0) return null
  return { wallet: rest.slice(0, dot), sessionId: rest.slice(dot + 1) }
}

export function saveTranscript(
  wallet: string | null | undefined,
  sessionId: string,
  patch: Partial<Transcript> & Pick<Transcript, 'tokenId' | 'coachName'>,
) {
  if (!wallet) return
  if (typeof window === 'undefined') return
  const k = key(wallet, sessionId)
  const now = Date.now()
  let prev: Transcript | null = null
  try {
    const raw = window.localStorage.getItem(k)
    if (raw) prev = JSON.parse(raw) as Transcript
  } catch {}
  const next: Transcript = {
    sessionId,
    tokenId: patch.tokenId ?? prev?.tokenId ?? '',
    coachName: patch.coachName ?? prev?.coachName ?? '',
    category: patch.category ?? prev?.category,
    startedAt: prev?.startedAt ?? patch.startedAt ?? now,
    updatedAt: now,
    endedAt: patch.endedAt ?? prev?.endedAt,
    messages: patch.messages ?? prev?.messages ?? [],
    payTx: patch.payTx ?? prev?.payTx,
    settleTx: patch.settleTx ?? prev?.settleTx,
  }
  try {
    window.localStorage.setItem(k, JSON.stringify(next))
  } catch {
    // quota exceeded · fail silently, the chat still works in-session
  }
}

export function loadTranscript(
  wallet: string | null | undefined,
  sessionId: string,
): Transcript | null {
  if (!wallet) return null
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key(wallet, sessionId))
    return raw ? (JSON.parse(raw) as Transcript) : null
  } catch {
    return null
  }
}

export function listTranscripts(wallet: string | null | undefined): Transcript[] {
  if (!wallet) return []
  if (typeof window === 'undefined') return []
  const target = wallet.toLowerCase()
  const out: Transcript[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (!k) continue
    const meta = parseKey(k)
    if (!meta || meta.wallet !== target) continue
    try {
      const raw = window.localStorage.getItem(k)
      if (!raw) continue
      out.push(JSON.parse(raw) as Transcript)
    } catch {}
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function deleteTranscript(
  wallet: string | null | undefined,
  sessionId: string,
) {
  if (!wallet) return
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key(wallet, sessionId))
  } catch {}
}

/// Render a transcript as a markdown document the student can keep.
export function transcriptToMarkdown(t: Transcript): string {
  const date = new Date(t.startedAt)
  const dateStr = date.toISOString().split('T')[0]
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const durationMin =
    t.endedAt && t.startedAt
      ? Math.max(1, Math.round((t.endedAt - t.startedAt) / 60_000))
      : null

  const lines: string[] = []
  lines.push(`# Session with ${t.coachName}`)
  lines.push('')
  lines.push(`*Kiln · sovereign AI for experts*`)
  lines.push('')
  lines.push(`- **Session id:** ${t.sessionId}`)
  lines.push(`- **iNFT:** #${t.tokenId}`)
  if (t.category) lines.push(`- **Category:** ${t.category}`)
  lines.push(`- **Started:** ${dateStr} ${timeStr}`)
  if (durationMin) lines.push(`- **Duration:** ~${durationMin} min`)
  if (t.payTx) {
    lines.push(`- **Payment tx:** [\`${t.payTx}\`](https://chainscan-galileo.0g.ai/tx/${t.payTx})`)
  }
  if (t.settleTx) {
    lines.push(`- **Settlement tx:** [\`${t.settleTx}\`](https://chainscan-galileo.0g.ai/tx/${t.settleTx})`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const m of t.messages) {
    if (m.role === 'user') {
      lines.push(`### You`)
      lines.push('')
      lines.push(m.content.split('\n').map((l) => l).join('\n'))
    } else {
      lines.push(`### ${t.coachName}`)
      lines.push('')
      // strip [fen ...] tags for clean markdown
      const clean = m.content.replace(/\[fen\s+[^\]]+\]/g, '').trim()
      lines.push(clean)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push(`Generated from Kiln. Verify on chain at https://chainscan-galileo.0g.ai`)
  return lines.join('\n')
}

export function downloadTranscriptMd(t: Transcript) {
  if (typeof window === 'undefined') return
  const md = transcriptToMarkdown(t)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const safeName = t.coachName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const a = document.createElement('a')
  a.href = url
  a.download = `kiln-session-${t.sessionId}-${safeName}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
