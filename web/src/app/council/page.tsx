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
import { SiteNav, SiteFooter } from '@/components/site-chrome'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
}

type Synthesis = {
  text: string
  provider: string
  model: string
}

type CouncilResponse = {
  queryId: string
  replies: CoachReply[]
  synthesis: Synthesis
}

const MIN_PICK = 2
const MAX_PICK = 4

export default function CouncilPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CouncilResponse | null>(null)
  const [phase, setPhase] = useState<'idle' | 'inference' | 'mesh' | 'synthesis' | 'done'>('idle')

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
      setResult(json as CouncilResponse)
      setPhase('done')
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
                    <div className="kiln-stamp">iNFT · {l.tokenId.padStart(3, '0')}</div>
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
                {result.replies.map((r) => (
                  <div key={r.tokenId} className="kiln-card kiln-card-hot p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <KilnAvatar
                        tokenId={r.tokenId}
                        name={r.name}
                        category={r.category}
                        reputation={0}
                        size={40}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="kiln-stamp">iNFT · {r.tokenId.padStart(3, '0')} · {r.category}</div>
                        <div className="kiln-display text-lg truncate">{r.name}</div>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--kiln-fg-1)] leading-relaxed whitespace-pre-wrap">
                      {r.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="kiln-label mb-3">Council verdict · synthesized via AXL</div>
              <div className="kiln-card kiln-ticked p-7">
                <p className="text-base text-[var(--kiln-fg-0)] leading-relaxed whitespace-pre-wrap">
                  {result.synthesis.text}
                </p>
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
                Want a private 1-on-1 with one of these coaches?{' '}
                <Link href="/market" className="text-[var(--kiln-ember-hot)] hover:underline">
                  Open the marketplace →
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
