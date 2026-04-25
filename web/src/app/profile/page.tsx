'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ethers } from 'ethers'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Button } from '@/components/ui/button'
import { SiteNav, SiteFooter } from '@/components/site-chrome'
import { KilnAvatar } from '@/components/kiln-avatar'
import { TransferModal } from '@/components/transfer-modal'
import { ListModal } from '@/components/list-modal'
import { RefineModal } from '@/components/refine-modal'
import { SessionTimer, DEFAULT_SESSION_SECONDS } from '@/components/session-timer'
import { RepBadge } from '@/components/rep-badge'
import { ABIS, ADDRESSES } from '@/lib/contracts'
import { readPersonasBatch } from '@/lib/use-persona'
import { readActiveSessionsFor, type ActiveSession } from '@/lib/active-sessions'
import { useReputationBatch } from '@/lib/use-reputation'
import type { Persona } from '@/lib/persona'

type Token = {
  id: bigint
  owner: string
  pricePerSession: bigint
  licensePricePerDay: bigint
  listed: boolean
}

export default function ProfilePage() {
  const { authenticated } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets[0]

  const [tokens, setTokens] = useState<Token[]>([])
  const [personas, setPersonas] = useState<Record<string, Persona>>({})
  const [activeSessions, setActiveSessions] = useState<Record<string, ActiveSession>>({})
  const [settledIds, setSettledIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const [transferTokenId, setTransferTokenId] = useState<bigint | null>(null)
  const [listingToken, setListingToken] = useState<Token | null>(null)
  const [refineTokenId, setRefineTokenId] = useState<bigint | null>(null)

  const readProvider = useMemo(
    () => new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai'),
    [],
  )

  async function refresh() {
    if (!wallet) return
    setLoading(true)
    try {
      const owner = wallet.address
      const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, readProvider)
      const market = new ethers.Contract(ADDRESSES.KilnMarket, ABIS.KilnMarket as any, readProvider)

      const nextId: bigint = await nft.nextTokenId()
      const ids: bigint[] = []
      for (let i = 1n; i < nextId; i++) ids.push(i)

      const owned: Token[] = []
      for (const id of ids) {
        try {
          const o: string = await nft.ownerOf(id)
          if (o.toLowerCase() !== owner.toLowerCase()) continue
          const listing: any = await market.listings(id)
          owned.push({
            id,
            owner: o,
            pricePerSession: (listing.pricePerSession ?? listing[1]) as bigint,
            licensePricePerDay: (listing.licensePricePerDay ?? listing[2]) as bigint,
            listed: Boolean(listing.active ?? listing[4]),
          })
        } catch {}
      }
      setTokens(owned)

      if (owned.length > 0) {
        const [p, act] = await Promise.all([
          readPersonasBatch(owned.map((t) => t.id)),
          readActiveSessionsFor(readProvider, owned.map((t) => t.id)),
        ])
        setPersonas(p)
        setActiveSessions(act)
        setSettledIds(new Set())
      } else {
        setActiveSessions({})
      }
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [wallet?.address])

  // Reputation derived from on-chain SessionEnded events
  const { map: repMap } = useReputationBatch(tokens.map((t) => t.id.toString()))

  async function autoSettle(sessionId: bigint) {
    const key = sessionId.toString()
    if (settledIds.has(key)) return
    setSettledIds((s) => new Set(s).add(key))
    try {
      await fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: key, rating: 5 }),
      })
      toast.message(`Session #${key} timed out and was settled on chain`)
      // remove from UI state
      setActiveSessions((prev) => {
        const next = { ...prev }
        for (const tId of Object.keys(next)) {
          if (next[tId].sessionId.toString() === key) delete next[tId]
        }
        return next
      })
    } catch (err: unknown) {
      toast.error(`auto-settle failed: ${(err as Error).message}`)
    }
  }

  return (
    <div className="relative min-h-dvh">
      <SiteNav />

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-14">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="kiln-label">Studio · Private ledger</div>
            <h1 className="mt-2 kiln-display text-5xl md:text-6xl leading-[0.95]">
              Your <span className="kiln-display-italic text-[var(--kiln-ember-hot)]">kiln</span>.
            </h1>
            <p className="mt-4 text-[var(--kiln-fg-1)] max-w-xl">
              Everything you have fired. Price them, transfer them, or retire
              them. The ERC-7857 tokens are yours until you choose otherwise.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              variant="outline"
              onClick={refresh}
              disabled={loading}
              className="h-10 px-5 rounded-sm border-[var(--kiln-border)] bg-transparent hover:bg-[var(--kiln-bg-2)] text-[var(--kiln-fg-1)] font-mono text-xs tracking-widest uppercase"
            >
              {loading ? 'Reading chain…' : 'Refresh'}
            </Button>
            <span className="kiln-stamp">
              {tokens.length.toString().padStart(2, '0')} iNFT{tokens.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="kiln-rule mb-10" />

        {!authenticated && (
          <div className="kiln-card kiln-ticked p-12 text-center">
            <div className="kiln-stamp mb-4">Not connected</div>
            <div className="kiln-display text-3xl">Connect a wallet to open the studio.</div>
          </div>
        )}

        {authenticated && tokens.length === 0 && !loading && (
          <div className="kiln-card kiln-ticked p-12 text-center">
            <div className="kiln-stamp mb-4">Empty studio</div>
            <div className="kiln-display text-3xl mb-6">
              Nothing fired yet in this wallet.
            </div>
            <Link href="/onboard" className="inline-block">
              <Button className="kiln-btn-ember h-11 px-7 rounded-sm font-mono text-xs tracking-widest uppercase">
                Fire your first model
              </Button>
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {tokens.map((t) => {
            const p = personas[t.id.toString()]
            const active = activeSessions[t.id.toString()]
            const rep = repMap[t.id.toString()]
            return (
              <div
                key={t.id.toString()}
                className="kiln-card kiln-card-hot p-6"
              >
                <div className="grid grid-cols-12 gap-6 items-center">
                  <div className="col-span-12 md:col-span-7 flex items-center gap-5">
                    <KilnAvatar
                      tokenId={t.id.toString()}
                      name={p?.name ?? `iNFT ${t.id}`}
                      category={p?.category ?? 'General'}
                      reputation={rep?.sessions ?? 0}
                      size={56}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="kiln-stamp">iNFT · {t.id.toString().padStart(3, '0')}</div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <div className="kiln-display text-2xl truncate">
                          {p?.name ?? `iNFT #${t.id.toString()}`}
                        </div>
                        <RepBadge rep={rep} />
                      </div>
                      <div className="text-xs text-[var(--kiln-fg-2)] mt-1">
                        {p?.category ?? 'General'}
                        {t.listed ? (
                          <>
                            {t.pricePerSession > 0n && (
                              <> · <span className="font-mono text-[var(--kiln-ember-hot)]">{ethers.formatEther(t.pricePerSession)} OG</span><span className="text-[var(--kiln-fg-3)]">/session</span></>
                            )}
                            {t.licensePricePerDay > 0n && (
                              <> · <span className="font-mono text-[var(--kiln-fg-1)]">{ethers.formatEther(t.licensePricePerDay)} OG</span><span className="text-[var(--kiln-fg-3)]">/day</span></>
                            )}
                          </>
                        ) : (
                          <span className="ml-2 text-[var(--kiln-fg-3)]">· Not listed</span>
                        )}
                      </div>

                      {active && (
                        <div className="mt-3 flex items-center gap-3 flex-wrap">
                          <span className="kiln-stamp text-[var(--kiln-ember-hot)]">
                            Live · Session #{active.sessionId.toString()}
                          </span>
                          <span className="text-[0.6875rem] font-mono text-[var(--kiln-fg-3)]">
                            student {active.student.slice(0, 6)}···{active.student.slice(-4)}
                          </span>
                          <SessionTimer
                            sessionId={active.sessionId.toString()}
                            startMs={active.startMs}
                            totalSeconds={DEFAULT_SESSION_SECONDS}
                            onExpired={() => autoSettle(active.sessionId)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-5 flex flex-wrap gap-2 md:justify-end">
                    <Button
                      onClick={() => setListingToken(t)}
                      className="kiln-btn-ember h-10 px-5 rounded-sm font-mono text-xs tracking-widest uppercase"
                    >
                      {t.listed ? 'Update price' : 'List for rent'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRefineTokenId(t.id)}
                      className="h-10 px-4 rounded-sm border-[var(--kiln-border)] bg-transparent hover:bg-[var(--kiln-bg-2)] text-[var(--kiln-fg-1)] hover:text-[var(--kiln-fg-0)] font-mono text-xs tracking-widest uppercase"
                    >
                      Refine
                    </Button>
                    <Link href={`/chat/${t.id}`}>
                      <Button
                        variant="outline"
                        className="h-10 px-4 rounded-sm border-[var(--kiln-border)] bg-transparent hover:bg-[var(--kiln-bg-2)] text-[var(--kiln-fg-1)] font-mono text-xs tracking-widest uppercase"
                      >
                        Preview
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => setTransferTokenId(t.id)}
                      className="h-10 px-4 rounded-sm border-[var(--kiln-border)] bg-transparent hover:bg-[color:rgba(224,51,38,0.08)] hover:border-[var(--kiln-danger)] text-[var(--kiln-fg-1)] hover:text-[var(--kiln-danger)] font-mono text-xs tracking-widest uppercase"
                    >
                      Transfer
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <SiteFooter />

      {transferTokenId !== null && (
        <TransferModal
          tokenId={transferTokenId}
          open
          onClose={() => setTransferTokenId(null)}
          onTransferred={() => { setTransferTokenId(null); refresh() }}
        />
      )}
      {listingToken !== null && (
        <ListModal
          tokenId={listingToken.id}
          open
          mode={listingToken.listed ? 'update' : 'create'}
          initialPerSession={listingToken.pricePerSession}
          initialPerDay={listingToken.licensePricePerDay}
          onClose={() => setListingToken(null)}
          onListed={() => { setListingToken(null); refresh() }}
        />
      )}
      {refineTokenId !== null && (
        <RefineModal
          tokenId={refineTokenId}
          open
          onClose={() => setRefineTokenId(null)}
          onRefined={() => { setRefineTokenId(null); refresh() }}
        />
      )}
    </div>
  )
}
