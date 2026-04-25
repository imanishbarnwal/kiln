'use client'

/// Council mode · ask multiple Kiln coaches the same question and watch
/// a synthesizer running on a separate node combine their answers.
///
/// What's happening behind the scenes when you click Convene:
///
///   1. The browser POSTs { tokenIds, question } to /api/council.
///   2. The route reads each coach's persona from chain and runs
///      inference per coach against 0G Compute (in parallel).
///   3. The route hands the bundle to the local AXL node, which
///      ships it over the encrypted P2P mesh to the synth AXL node.
///   4. A standalone synth worker (pnpm council:synth) picks the
///      envelope off /recv, runs a synthesis prompt against 0G
///      Compute, and ships the answer back through the same mesh.
///   5. The orchestrator returns the per-coach replies AND the
///      council synthesis to the browser.
///
/// The synth hop is what makes this an AXL submission · everything
/// else is plain Kiln plumbing.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ethers } from 'ethers'
import { toast } from 'sonner'
import { useWallets } from '@privy-io/react-auth'
import { SiteNav, SiteFooter } from '@/components/site-chrome'
import { Button } from '@/components/ui/button'
import { KilnAvatar } from '@/components/kiln-avatar'
import { ABIS, ADDRESSES } from '@/lib/contracts'
import { readPersonasBatch } from '@/lib/use-persona'
import type { Persona } from '@/lib/persona'

type Listing = {
  tokenId: string
  persona: Persona
}

type CoachReply = {
  tokenId: string
  name: string
  category: string
  text: string
  offline: boolean
  pricePerSessionWei: string
  listingActive: boolean
}

type Synthesis = {
  text: string
  bestFitTokenId: string | null
  provider: string
  model: string
}

type CouncilResponse = {
  queryId: string
  replies: CoachReply[]
  synthesis: Synthesis
}

/// localStorage key for tracking which coaches a wallet has previewed via
/// Council. We use this to render a subtle '✓ Previewed' chip on cards
/// the user already evaluated · pure UX hint, no payment gating yet.
const PREVIEWED_KEY = (wallet: string) => `kiln.council.previewed.${wallet.toLowerCase()}`

function loadPreviewed(wallet: string | undefined): Set<string> {
  if (!wallet || typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(PREVIEWED_KEY(wallet))
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function savePreviewed(wallet: string | undefined, set: Set<string>) {
  if (!wallet || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREVIEWED_KEY(wallet), JSON.stringify(Array.from(set)))
  } catch {}
}

const MIN_PICK = 2
const MAX_PICK = 3

export default function CouncilPage() {
  const { wallets } = useWallets()
  const wallet = wallets[0]

  const [listings, setListings] = useState<Listing[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CouncilResponse | null>(null)
  const [phase, setPhase] = useState<'idle' | 'inference' | 'mesh' | 'synthesis' | 'done'>('idle')
  const [previewed, setPreviewed] = useState<Set<string>>(new Set())

  useEffect(() => {
    setPreviewed(loadPreviewed(wallet?.address))
  }, [wallet?.address])

  const readProvider = useMemo(
    () => new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai'),
    [],
  )

  // Pull the listed coaches so the user has a roster to pick from. We
  // intentionally surface ALL existing iNFTs (not only those listed for
  // rent) so the council can include experimental coaches too.
  useEffect(() => {
    (async () => {
      try {
        const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, readProvider)
        const nextId: bigint = await nft.nextTokenId()
        const ids: bigint[] = []
        for (let i = 1n; i < nextId; i++) ids.push(i)
        const personaMap = await readPersonasBatch(ids)
        const out: Listing[] = ids.map((id) => ({
          tokenId: id.toString(),
          persona: personaMap[id.toString()] ?? {
            name: `iNFT #${id}`,
            category: 'General',
            avatar: '',
            blurb: '',
            systemPrompt: '',
          },
        }))
        setListings(out)
      } catch (err: unknown) {
        toast.error(`couldn't load coaches: ${(err as Error).message}`)
      }
    })()
  }, [readProvider])

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= MAX_PICK) return next
        next.add(id)
      }
      return next
    })
  }

  async function convene() {
    if (picked.size < MIN_PICK) return toast.error(`Pick at least ${MIN_PICK} coaches`)
    if (!question.trim()) return toast.error('Type a question')

    setBusy(true)
    setResult(null)
    setPhase('inference')
    try {
      // The orchestrator handles the AXL hop server-side. The page just
      // walks through phases for the loading affordance · we don't have
      // server-side progress events, so the phases are time-driven.
      const phaseTimers = [
        setTimeout(() => setPhase('mesh'), 4_000),
        setTimeout(() => setPhase('synthesis'), 8_000),
      ]
      const res = await fetch('/api/council', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenIds: Array.from(picked),
          question: question.trim(),
        }),
      })
      phaseTimers.forEach(clearTimeout)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'council failed')
      const response = json as CouncilResponse
      setResult(response)
      setPhase('done')
      // Mark every coach in this convene as previewed for this wallet.
      const next = new Set(previewed)
      for (const r of response.replies) next.add(r.tokenId)
      setPreviewed(next)
      savePreviewed(wallet?.address, next)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'council failed')
      setPhase('idle')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-dvh">
      <SiteNav />

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-12 gap-8 items-end mb-10">
          <div className="col-span-12 md:col-span-8">
            <div className="kiln-label">Council · Decentralized inference mesh</div>
            <h1 className="mt-2 kiln-display text-5xl md:text-6xl leading-[0.95]">
              Ask <span className="kiln-display-italic text-[var(--kiln-ember-hot)]">two</span> coaches.
              Get <span className="kiln-display-italic text-[var(--kiln-ember-hot)]">one</span> verdict.
            </h1>
            <p className="mt-4 text-[var(--kiln-fg-1)] max-w-2xl">
              Each coach answers from their own on-chain persona. A separate
              synthesizer node behind the Gensyn AXL P2P mesh combines the
              replies into a single actionable verdict and returns it through
              the same encrypted channel.
            </p>
          </div>
          <div className="col-span-12 md:col-span-4 space-y-2">
            <div className="kiln-stamp">Powered by Gensyn AXL</div>
            <div className="text-xs font-mono text-[var(--kiln-fg-2)] leading-relaxed">
              Two AXL nodes, ed25519 peer ids, message routed over Yggdrasil + gVisor TCP. The synthesis hop is provably off-process.
            </div>
          </div>
        </div>

        <div className="kiln-rule mb-10" />

        {/* Step 1 · pick coaches */}
        <div className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <div className="kiln-label">Step 1 · Convene the council ({picked.size}/{MAX_PICK})</div>
            <div className="kiln-stamp">{listings.length.toString().padStart(2, '0')} coaches available</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {listings.map((l) => {
              const selected = picked.has(l.tokenId)
              const seen = previewed.has(l.tokenId)
              return (
                <button
                  key={l.tokenId}
                  onClick={() => togglePick(l.tokenId)}
                  className={`kiln-card text-left p-4 transition-all flex items-center gap-3 ${
                    selected ? 'ring-1 ring-[var(--kiln-ember-hot)]' : 'hover:bg-[var(--kiln-bg-2)]'
                  }`}
                >
                  <KilnAvatar
                    tokenId={l.tokenId}
                    name={l.persona.name}
                    category={l.persona.category}
                    reputation={0}
                    size={44}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="kiln-stamp flex items-center gap-2">
                      <span>iNFT · {l.tokenId.padStart(3, '0')}</span>
                      {seen && (
                        <span className="text-[var(--kiln-fg-3)] normal-case tracking-normal text-[0.6875rem]">
                          ✓ previewed
                        </span>
                      )}
                    </div>
                    <div className="kiln-display text-base truncate">{l.persona.name}</div>
                    <div className="text-xs text-[var(--kiln-fg-2)]">{l.persona.category}</div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${selected ? 'bg-[var(--kiln-ember-hot)]' : 'bg-[var(--kiln-bg-3)]'}`} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2 · ask */}
        <div className="mb-8">
          <div className="kiln-label mb-3">Step 2 · Pose the question</div>
          <div className="kiln-card p-6 space-y-4">
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. I'm 1300 elo. Should I learn the King's Indian or the Caro-Kann first?"
              className="kiln-input w-full px-4 py-3 resize-y leading-relaxed"
              disabled={busy}
            />
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono text-[var(--kiln-fg-2)]">
                {phase === 'inference' && 'Coaches drafting their replies on 0G Compute…'}
                {phase === 'mesh' && 'Bundle handed to AXL · routing to synth node over P2P mesh…'}
                {phase === 'synthesis' && 'Synth node combining replies on a different process…'}
                {phase === 'done' && 'Council convened.'}
                {phase === 'idle' && 'Ready.'}
              </div>
              <Button
                onClick={convene}
                disabled={busy || picked.size < MIN_PICK || !question.trim()}
                className="kiln-btn-ember h-11 px-7 rounded-sm font-mono text-xs tracking-widest uppercase"
              >
                {busy ? 'Convening…' : 'Convene council'}
              </Button>
            </div>
          </div>
        </div>

        {/* Step 3 · results */}
        {result && (
          <div className="space-y-8">
            <div>
              <div className="kiln-label mb-3">Per-coach replies</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.replies.map((r) => {
                  const isBestFit = !r.offline && result.synthesis.bestFitTokenId === r.tokenId
                  const priceWei = BigInt(r.pricePerSessionWei)
                  return (
                    <div
                      key={r.tokenId}
                      className={`kiln-card p-5 ${
                        r.offline
                          ? 'opacity-60'
                          : isBestFit
                          ? 'kiln-card-hot ring-1 ring-[var(--kiln-ember-hot)]'
                          : 'kiln-card-hot'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <KilnAvatar
                          tokenId={r.tokenId}
                          name={r.name}
                          category={r.category}
                          reputation={0}
                          size={40}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="kiln-stamp flex items-center gap-2 flex-wrap">
                            <span>iNFT · {r.tokenId.padStart(3, '0')} · {r.category}</span>
                            {isBestFit && (
                              <span className="font-mono normal-case tracking-normal text-[var(--kiln-ember-hot)]">
                                · best fit
                              </span>
                            )}
                            {r.offline && (
                              <span className="font-mono normal-case tracking-normal text-[var(--kiln-fg-3)]">
                                · couldn't reach
                              </span>
                            )}
                          </div>
                          <div className="kiln-display text-lg truncate">{r.name}</div>
                        </div>
                      </div>
                      {r.offline ? (
                        <p className="text-sm text-[var(--kiln-fg-2)] italic">
                          The 0G Compute upstream rejected this coach's request. Click <span className="text-[var(--kiln-ember-hot)]">Convene</span> again to retry, or remove this coach from the picker.
                        </p>
                      ) : (
                        <p className="text-sm text-[var(--kiln-fg-1)] leading-relaxed whitespace-pre-wrap">
                          {r.text}
                        </p>
                      )}
                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--kiln-border-soft)] pt-4">
                        <div className="text-xs font-mono text-[var(--kiln-fg-2)]">
                          {r.listingActive && priceWei > 0n ? (
                            <>
                              <span className="kiln-label normal-case tracking-[0.18em] text-[var(--kiln-fg-3)] mr-2">per session</span>
                              <span className="text-[var(--kiln-ember-hot)]">{ethers.formatEther(priceWei)} OG</span>
                            </>
                          ) : (
                            <span className="text-[var(--kiln-fg-3)]">Not listed for rent yet</span>
                          )}
                        </div>
                        {r.listingActive && priceWei > 0n && (
                          <Link href={`/chat/${r.tokenId}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 rounded-sm border-[var(--kiln-border)] bg-transparent hover:bg-[var(--kiln-bg-2)] text-[var(--kiln-fg-1)] hover:text-[var(--kiln-fg-0)] font-mono text-[0.6875rem] tracking-widest uppercase"
                            >
                              Book session →
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="kiln-label mb-3">Council verdict · synthesized via AXL</div>
              <div className="kiln-card kiln-ticked p-7">
                <p className="text-base text-[var(--kiln-fg-0)] leading-relaxed whitespace-pre-wrap">
                  {result.synthesis.text}
                </p>

                {/* Best-fit conversion CTA · the synth has already named the
                    iNFT whose reply was the strongest fit. We surface it
                    prominently with a one-click "Book a private session"
                    so Council acts as the discovery layer that funnels
                    into a paid 1-on-1. */}
                {(() => {
                  const bestFit = result.synthesis.bestFitTokenId
                    ? result.replies.find((r) => r.tokenId === result.synthesis.bestFitTokenId)
                    : null
                  if (!bestFit || !bestFit.listingActive || BigInt(bestFit.pricePerSessionWei) === 0n) return null
                  return (
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--kiln-border-soft)] pt-4 flex-wrap">
                      <div className="text-sm">
                        <span className="kiln-label normal-case tracking-[0.18em] text-[var(--kiln-fg-3)] mr-2">best fit</span>
                        <span className="kiln-display-italic text-[var(--kiln-ember-hot)]">{bestFit.name}</span>
                        <span className="text-[var(--kiln-fg-3)] font-mono text-xs ml-3">
                          {ethers.formatEther(BigInt(bestFit.pricePerSessionWei))} OG / session
                        </span>
                      </div>
                      <Link href={`/chat/${bestFit.tokenId}`}>
                        <Button className="kiln-btn-ember h-10 px-5 rounded-sm font-mono text-xs tracking-widest uppercase">
                          Book session with {bestFit.name.split(/\s+/).slice(-1)[0]} →
                        </Button>
                      </Link>
                    </div>
                  )
                })()}

                {(result.synthesis.provider || result.synthesis.model) && (
                  <div className="mt-5 flex items-center gap-3 flex-wrap text-xs font-mono text-[var(--kiln-fg-2)] border-t border-[var(--kiln-border-soft)] pt-4">
                    <span className="kiln-label normal-case tracking-[0.18em] text-[var(--kiln-fg-3)]">synth</span>
                    {result.synthesis.model && <span className="text-[var(--kiln-ember-hot)]">{result.synthesis.model}</span>}
                    {result.synthesis.provider && (
                      <span className="text-[var(--kiln-fg-3)]">via {result.synthesis.provider.slice(0, 8)}…{result.synthesis.provider.slice(-4)}</span>
                    )}
                    <span className="text-[var(--kiln-fg-3)]">queryId {result.queryId}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 text-xs font-mono text-[var(--kiln-fg-2)]">
                Want a different voice?{' '}
                <Link href="/market" className="text-[var(--kiln-ember-hot)] hover:underline">
                  Browse the full marketplace →
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
