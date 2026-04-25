'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { toast } from 'sonner'
import { SiteNav, SiteFooter } from '@/components/site-chrome'
import { KilnAvatar } from '@/components/kiln-avatar'
import { Button } from '@/components/ui/button'
import {
  listTranscripts,
  deleteTranscript,
  downloadTranscriptMd,
  type Transcript,
} from '@/lib/transcripts'

function formatRelative(ms: number) {
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60_000)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (day > 7) return new Date(ms).toLocaleDateString()
  if (day >= 1) return `${day}d ago`
  if (hr >= 1) return `${hr}h ago`
  if (min >= 1) return `${min}m ago`
  return 'just now'
}

function durationMin(t: Transcript): number | null {
  if (!t.endedAt) return null
  return Math.max(1, Math.round((t.endedAt - t.startedAt) / 60_000))
}

function preview(t: Transcript): string {
  const firstUser = t.messages.find((m) => m.role === 'user')?.content
  if (firstUser) return firstUser.length > 140 ? firstUser.slice(0, 137) + '…' : firstUser
  return 'No messages yet.'
}

export default function PastSessionsPage() {
  const { authenticated } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets[0]

  const [items, setItems] = useState<Transcript[]>([])
  const [openId, setOpenId] = useState<string | null>(null)

  function refresh() {
    if (!wallet?.address) {
      setItems([])
      return
    }
    setItems(listTranscripts(wallet.address))
  }

  useEffect(() => {
    refresh()
    // refresh on focus so a transcript saved in another tab shows up
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.address])

  function remove(t: Transcript) {
    if (!wallet?.address) return
    if (!confirm(`Delete transcript for session #${t.sessionId}?`)) return
    deleteTranscript(wallet.address, t.sessionId)
    refresh()
    toast.message('Transcript removed locally')
  }

  return (
    <div className="relative min-h-dvh">
      <SiteNav />

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-14">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="kiln-label">Studio · Past sessions</div>
            <h1 className="mt-2 kiln-display text-5xl md:text-6xl leading-[0.95]">
              What you <span className="kiln-display-italic text-[var(--kiln-ember-hot)]">paid</span> for.
            </h1>
            <p className="mt-4 text-[var(--kiln-fg-1)] max-w-xl">
              Every session you opened is yours to revisit. Saved locally to
              this browser. Encrypted backup to 0G Storage is on the roadmap.
            </p>
          </div>
          <Link href="/profile">
            <Button
              variant="outline"
              className="h-10 px-5 rounded-sm border-[var(--kiln-border)] bg-transparent hover:bg-[var(--kiln-bg-2)] text-[var(--kiln-fg-1)] font-mono text-xs tracking-widest uppercase"
            >
              Back to studio
            </Button>
          </Link>
        </div>
        <div className="kiln-rule mb-10" />

        {!authenticated && (
          <div className="kiln-card kiln-ticked p-12 text-center">
            <div className="kiln-stamp mb-4">Not connected</div>
            <div className="kiln-display text-3xl">Connect a wallet to see your sessions.</div>
          </div>
        )}

        {authenticated && items.length === 0 && (
          <div className="kiln-card kiln-ticked p-12 text-center">
            <div className="kiln-stamp mb-4">No sessions yet</div>
            <div className="kiln-display text-3xl mb-4">
              You haven&apos;t opened a session from this browser.
            </div>
            <Link href="/market">
              <Button className="kiln-btn-ember h-11 px-7 rounded-sm font-mono text-xs tracking-widest uppercase">
                Browse the atelier
              </Button>
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {items.map((t) => {
            const isOpen = openId === t.sessionId
            const dur = durationMin(t)
            return (
              <div key={t.sessionId} className="kiln-card kiln-card-hot">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : t.sessionId)}
                  className="w-full grid grid-cols-12 gap-6 items-center p-5 text-left"
                >
                  <div className="col-span-12 md:col-span-7 flex items-center gap-4">
                    <KilnAvatar
                      tokenId={t.tokenId || '0'}
                      name={t.coachName}
                      category={t.category}
                      size={48}
                    />
                    <div className="min-w-0">
                      <div className="kiln-stamp">
                        Session · {t.sessionId.padStart(3, '0')} · {formatRelative(t.startedAt)}
                        {dur !== null && ` · ${dur}m`}
                      </div>
                      <div className="kiln-display text-xl truncate mt-0.5">{t.coachName}</div>
                      <div className="text-xs text-[var(--kiln-fg-2)] truncate mt-0.5">
                        {preview(t)}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-5 flex md:justify-end items-center gap-2 text-xs font-mono tracking-widest uppercase text-[var(--kiln-fg-2)]">
                    <span>
                      {t.messages.length} msg{t.messages.length === 1 ? '' : 's'}
                    </span>
                    <span className="text-[var(--kiln-fg-3)]">·</span>
                    <span>{t.endedAt ? 'Settled' : 'Open'}</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      className={`transition-transform ml-2 ${isOpen ? 'rotate-180' : ''}`}
                      aria-hidden
                    >
                      <path d="M3 5l3 3 3-3" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--kiln-border-soft)] px-5 py-5 space-y-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadTranscriptMd(t)}
                        className="h-8 px-4 rounded-sm border-[var(--kiln-border)] bg-transparent hover:bg-[var(--kiln-bg-2)] text-[var(--kiln-fg-1)] font-mono text-xs tracking-widest uppercase"
                      >
                        Download .md
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(t)}
                        className="h-8 px-4 rounded-sm text-[var(--kiln-fg-3)] hover:text-[var(--kiln-danger)] hover:bg-transparent font-mono text-xs tracking-widest uppercase"
                      >
                        Delete
                      </Button>
                    </div>
                    {t.messages.length === 0 ? (
                      <div className="text-sm text-[var(--kiln-fg-2)] italic">
                        Empty session. No messages were sent.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {t.messages.map((m, i) => (
                          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex'}>
                            <div
                              className={`max-w-[82%] px-4 py-2.5 rounded-sm text-[0.95rem] leading-relaxed ${
                                m.role === 'user'
                                  ? 'bg-[color:var(--kiln-ember)] text-[#120703] font-medium'
                                  : 'bg-[var(--kiln-bg-2)] text-[var(--kiln-fg-0)] border border-[var(--kiln-border-soft)]'
                              }`}
                              style={
                                m.role === 'assistant'
                                  ? { boxShadow: 'inset 1px 0 0 rgba(255, 90, 31, 0.35)' }
                                  : undefined
                              }
                            >
                              <div className="whitespace-pre-wrap">
                                {m.content.replace(/\[fen\s+[^\]]+\]/g, '').trim()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[0.6875rem] text-[var(--kiln-fg-3)] uppercase tracking-[0.18em] pt-2 border-t border-[var(--kiln-border-soft)]">
                      <span>iNFT #{t.tokenId}</span>
                      <span>{new Date(t.startedAt).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
