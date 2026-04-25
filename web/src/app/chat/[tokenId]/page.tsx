'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ethers } from 'ethers'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Button } from '@/components/ui/button'
import { SiteNav, SiteFooter } from '@/components/site-chrome'
import { KilnAvatar } from '@/components/kiln-avatar'
import { ChatStream, type ChatStreamMsg } from '@/components/chat-stream'
import { IntelligencePanel } from '@/components/intelligence-panel'
import { RepBadge } from '@/components/rep-badge'
import { saveTranscript, downloadTranscriptMd, loadTranscript } from '@/lib/transcripts'
import {
  SessionTimer,
  DEFAULT_SESSION_SECONDS,
  persistSessionStart,
  loadPersistedStart,
  clearPersistedStart,
} from '@/components/session-timer'
import { useReputation } from '@/lib/use-reputation'
import { ABIS, ADDRESSES } from '@/lib/contracts'
import { galileo } from '@/lib/chains'
import { usePersona } from '@/lib/use-persona'

type Listing = {
  owner: string
  pricePerSession: bigint
  licensePricePerDay: bigint
  active: boolean
}

export default function ChatPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = use(params)
  const { authenticated } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets[0]

  const readProvider = useMemo(
    () => new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai'),
    [],
  )
  const { persona } = usePersona(tokenId)
  const { rep } = useReputation(tokenId)

  const [owner, setOwner] = useState<string | null>(null)
  const [listing, setListing] = useState<Listing | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionStart, setSessionStart] = useState<number | null>(null)
  const [paying, setPaying] = useState(false)
  const [licensing, setLicensing] = useState(false)
  const [ending, setEnding] = useState(false)
  const [payTx, setPayTx] = useState<`0x${string}` | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, readProvider)
        const market = new ethers.Contract(ADDRESSES.KilnMarket, ABIS.KilnMarket as any, readProvider)
        const [o, l] = await Promise.all([
          nft.ownerOf(BigInt(tokenId)).catch(() => null),
          market.listings(BigInt(tokenId)),
        ])
        setOwner(o)
        setListing({
          owner: (l.owner ?? l[0]) as string,
          pricePerSession: (l.pricePerSession ?? l[1]) as bigint,
          licensePricePerDay: (l.licensePricePerDay ?? l[2]) as bigint,
          active: Boolean(l.active ?? l[4]),
        })
      } catch (err: unknown) {
        toast.error(`couldn't load listing: ${(err as Error).message}`)
      }
    })()
  }, [tokenId, readProvider])

  const iAmOwner =
    !!owner &&
    !!wallet?.address &&
    owner.toLowerCase() === wallet.address.toLowerCase()

  async function ensureGalileo() {
    if (!wallet) throw new Error('No wallet')
    if (Number(wallet.chainId.split(':').pop()) !== galileo.id) {
      await wallet.switchChain(galileo.id)
    }
  }

  async function walletMarket() {
    await ensureGalileo()
    const eip = await wallet!.getEthereumProvider()
    const bp = new ethers.BrowserProvider(eip as any)
    const signer = await bp.getSigner()
    return new ethers.Contract(ADDRESSES.KilnMarket, ABIS.KilnMarket as any, signer)
  }

  async function payAndStart() {
    if (!authenticated) return toast.error('Connect first')
    if (!listing) return toast.error('Listing not loaded')
    if (!listing.active) return toast.error('This iNFT is not listed')
    if (listing.pricePerSession === 0n) return toast.error('Per-session not offered')
    if (iAmOwner) return toast.error('You own this iNFT. Switch wallets to rent.')

    setPaying(true)
    try {
      const market = await walletMarket()
      const tx = await market.startSession(BigInt(tokenId), {
        value: listing.pricePerSession,
        gasPrice: 5_000_000_000n,
      })
      setPayTx(tx.hash as `0x${string}`)
      const receipt = await tx.wait()

      const iface = new ethers.Interface(ABIS.KilnMarket as any)
      let sid: bigint | null = null
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = iface.parseLog(log)
          if (parsed?.name === 'SessionStarted') {
            sid = parsed.args.sessionId as bigint
            break
          }
        } catch {}
      }
      if (!sid) throw new Error('SessionStarted event not found')
      const sessionIdStr = sid.toString()
      const now = Date.now()
      persistSessionStart(sessionIdStr, now)
      setSessionStart(now)
      setSessionId(sessionIdStr)
      // Seed an empty transcript so the past-sessions page can list it
      // even before the user types anything.
      if (wallet?.address) {
        saveTranscript(wallet.address, sessionIdStr, {
          tokenId,
          coachName: persona?.name ?? `iNFT #${tokenId}`,
          category: persona?.category,
          startedAt: now,
          messages: [],
          payTx: tx.hash as `0x${string}`,
        })
      }
      toast.success(`Session #${sid} opened`)
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setPaying(false)
    }
  }

  async function startLicense(days: number, seats: number) {
    if (!listing || listing.licensePricePerDay === 0n) {
      return toast.error('License is not offered on this iNFT')
    }
    if (iAmOwner) return toast.error('You own this iNFT.')
    setLicensing(true)
    try {
      const market = await walletMarket()
      const fee = listing.licensePricePerDay * BigInt(days)
      const tx = await market.startLicense(BigInt(tokenId), BigInt(days), BigInt(seats), {
        value: fee,
        gasPrice: 5_000_000_000n,
      })
      await tx.wait()
      toast.success(`Licensed for ${days} days · ${seats} seats`)
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setLicensing(false)
    }
  }

  async function endSession(opts?: { auto?: boolean }) {
    if (!sessionId) return
    setEnding(true)
    try {
      const res = await fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, rating: 5 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'endSession failed')
      if (opts?.auto) {
        toast.message('Session timed out · settled on chain')
      } else {
        toast.success(json.already ? 'Already settled' : 'Session settled on chain')
      }
      // Mark transcript as settled for the past-sessions list
      if (wallet?.address) {
        saveTranscript(wallet.address, sessionId, {
          tokenId,
          coachName: persona?.name ?? `iNFT #${tokenId}`,
          endedAt: Date.now(),
          settleTx: json.txHash,
        })
      }
      clearPersistedStart(sessionId)
      setSessionId(null)
      setSessionStart(null)
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setEnding(false)
    }
  }

  return (
    <div className="relative min-h-dvh">
      <SiteNav />

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Persona header · magazine masthead */}
        <div className="kiln-card kiln-ticked p-8 md:p-10">
          <div className="flex items-start gap-6">
            <KilnAvatar
              tokenId={tokenId}
              name={persona?.name ?? `iNFT ${tokenId}`}
              category={persona?.category ?? 'General'}
              reputation={rep?.sessions ?? 0}
              size={96}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="kiln-stamp">
                  Entry · {tokenId.toString().padStart(3, '0')} · {persona?.category ?? 'General'}
                </div>
                {iAmOwner && (
                  <span className="kiln-stamp text-[var(--kiln-success)]">
                    § owned by you
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-4 flex-wrap">
                <h1 className="kiln-display text-4xl md:text-5xl leading-[0.95]">
                  {persona?.name ?? `iNFT #${tokenId}`}
                </h1>
                <RepBadge rep={rep} />
              </div>
              {persona?.blurb && (
                <p className="mt-3 text-[var(--kiln-fg-1)] leading-relaxed max-w-2xl">
                  {persona.blurb}
                </p>
              )}
            </div>
          </div>

          <IntelligencePanel tokenId={tokenId} persona={persona} />
        </div>

        {/* Rent or own state */}
        {!sessionId && (
          <div className="mt-8">
            {iAmOwner ? (
              <div className="kiln-card p-8 text-center">
                <div className="kiln-stamp mb-3">You own this iNFT</div>
                <div className="kiln-display text-2xl mb-6">
                  Renting from yourself is blocked by design.
                </div>
                <Link href="/profile">
                  <Button className="kiln-btn-ember h-11 px-7 rounded-sm font-mono text-xs tracking-widest uppercase">
                    Manage in Studio
                  </Button>
                </Link>
              </div>
            ) : listing?.active ? (
              <div className="kiln-card p-6 md:p-8 space-y-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="kiln-label">Rent this coach</div>
                    <div className="kiln-display text-2xl mt-1">Pay, chat, settle on chain.</div>
                  </div>
                  <div className="kiln-stamp">
                    Inference inside 0G Compute TEE · encrypted, verifiable
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {listing.pricePerSession > 0n && (
                    <button
                      onClick={payAndStart}
                      disabled={paying}
                      className="kiln-btn-ember h-20 rounded-sm text-left px-6 flex flex-col justify-center disabled:opacity-50"
                    >
                      <span className="font-mono text-[0.625rem] tracking-[0.22em] uppercase opacity-80">
                        {paying ? 'Opening chamber…' : 'Per session'}
                      </span>
                      <span className="kiln-display text-2xl leading-none mt-1">
                        {ethers.formatEther(listing.pricePerSession)} OG
                      </span>
                    </button>
                  )}
                  {listing.licensePricePerDay > 0n && (
                    <button
                      onClick={() => startLicense(30, 50)}
                      disabled={licensing}
                      className="h-20 rounded-sm text-left px-6 flex flex-col justify-center border border-[var(--kiln-border)] bg-[var(--kiln-bg-2)]/50 hover:bg-[var(--kiln-bg-2)] hover:border-[var(--kiln-gold)] transition-all disabled:opacity-50"
                    >
                      <span className="kiln-label">
                        {licensing ? 'Licensing…' : '30-day license · 50 seats'}
                      </span>
                      <span className="kiln-display text-2xl leading-none mt-1 text-[var(--kiln-fg-0)]">
                        {ethers.formatEther(listing.licensePricePerDay * 30n)} OG
                      </span>
                    </button>
                  )}
                </div>

                {payTx && (
                  <div className="text-xs font-mono text-[var(--kiln-fg-2)] truncate">
                    <span className="kiln-label mr-2">Payment</span>
                    <a
                      href={`https://chainscan-galileo.0g.ai/tx/${payTx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--kiln-ember-hot)] hover:underline underline-offset-2 break-all"
                    >
                      {payTx}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="kiln-card kiln-ticked p-10 text-center">
                <div className="kiln-stamp mb-3">Not listed</div>
                <div className="kiln-display text-2xl">
                  This coach hasn&apos;t opened their atelier yet.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat room */}
        {sessionId && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="flex items-center gap-4 font-mono text-xs uppercase tracking-widest text-[var(--kiln-fg-2)]">
                <span className="flex items-center gap-2">
                  <span className="kiln-dot kiln-dot-live" aria-hidden />
                  Session #{sessionId}
                </span>
                <span className="hidden sm:inline">streaming via 0G Compute TEE</span>
              </span>
              <div className="flex items-center gap-4">
                {sessionStart !== null && (
                  <SessionTimer
                    sessionId={sessionId}
                    startMs={sessionStart}
                    totalSeconds={DEFAULT_SESSION_SECONDS}
                    onExpired={() => {
                      if (!ending) endSession({ auto: true })
                    }}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!wallet?.address) return
                    const t = loadTranscript(wallet.address, sessionId)
                    if (t) downloadTranscriptMd(t)
                    else toast.message('Nothing to download yet')
                  }}
                  className="text-[var(--kiln-fg-2)] hover:text-[var(--kiln-fg-0)] hover:bg-transparent font-mono text-xs tracking-widest uppercase"
                  title="Download transcript as markdown"
                >
                  Download .md
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => endSession()}
                  disabled={ending}
                  className="text-[var(--kiln-fg-2)] hover:text-[var(--kiln-ember-hot)] hover:bg-transparent font-mono text-xs tracking-widest uppercase"
                >
                  {ending ? 'Settling…' : 'End session'}
                </Button>
              </div>
            </div>
            <ChatStream
              sessionId={sessionId}
              onMessagesChange={(msgs) => {
                if (!wallet?.address) return
                // Persist only confirmed messages (skip the in-flight error placeholders)
                const clean = msgs
                  .filter((m) => !m.kind || m.kind === 'ok')
                  .map((m) => ({ role: m.role, content: m.content }))
                saveTranscript(wallet.address, sessionId, {
                  tokenId,
                  coachName: persona?.name ?? `iNFT #${tokenId}`,
                  category: persona?.category,
                  messages: clean,
                })
              }}
            />
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
