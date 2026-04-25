'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ethers } from 'ethers'
import { Input } from '@/components/ui/input'
import { SiteNav, SiteFooter } from '@/components/site-chrome'
import { KilnAvatar } from '@/components/kiln-avatar'
import { RepBadge } from '@/components/rep-badge'
import { ABIS, ADDRESSES } from '@/lib/contracts'
import { readPersonasBatch } from '@/lib/use-persona'
import { useReputationBatch } from '@/lib/use-reputation'
import type { Reputation } from '@/lib/reputation'

type Listing = {
  tokenId: string
  owner: string
  pricePerSession: string
  licensePricePerDay: string
  name: string
  category: string
  avatar: string
  blurb: string
}

export default function MarketPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const readProvider = useMemo(
    () => new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai'),
    [],
  )

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, readProvider)
        const market = new ethers.Contract(ADDRESSES.KilnMarket, ABIS.KilnMarket as any, readProvider)

        const nextId: bigint = await nft.nextTokenId()
        const raw: { tokenId: bigint; owner: string; pricePerSession: bigint; licensePricePerDay: bigint }[] = []
        for (let i = 1n; i < nextId; i++) {
          try {
            const l: any = await market.listings(i)
            const active = Boolean(l.active ?? l[4])
            if (!active) continue
            raw.push({
              tokenId: i,
              owner: l.owner ?? l[0],
              pricePerSession: (l.pricePerSession ?? l[1]) as bigint,
              licensePricePerDay: (l.licensePricePerDay ?? l[2]) as bigint,
            })
          } catch {}
        }

        const personaMap = await readPersonasBatch(raw.map((r) => r.tokenId))
        const out: Listing[] = raw.map((r) => {
          const p = personaMap[r.tokenId.toString()]
          return {
            tokenId: r.tokenId.toString(),
            owner: r.owner,
            pricePerSession: r.pricePerSession.toString(),
            licensePricePerDay: r.licensePricePerDay.toString(),
            name: p?.name ?? `iNFT #${r.tokenId}`,
            category: p?.category ?? 'General',
            avatar: p?.avatar ?? '',
            blurb: p?.blurb ?? 'Minted on Kiln.',
          }
        })
        setListings(out)
      } finally {
        setLoading(false)
      }
    })()
  }, [readProvider])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return listings
    return listings.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        l.blurb.toLowerCase().includes(q),
    )
  }, [query, listings])

  // Reputation for every listing · feeds the avatar ticks and the rep badge
  const { map: repMap } = useReputationBatch(listings.map((l) => l.tokenId))

  return (
    <div className="relative min-h-dvh">
      <SiteNav />

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-12 gap-8 items-end mb-10">
          <div className="col-span-12 md:col-span-7">
            <div className="kiln-label">Catalog · Vol. I</div>
            <h1 className="mt-2 kiln-display text-5xl md:text-6xl leading-[0.95]">
              The <span className="kiln-display-italic text-[var(--kiln-ember-hot)]">atelier</span>.
            </h1>
            <p className="mt-4 text-[var(--kiln-fg-1)] max-w-xl">
              Every iNFT is a coach whose knowledge was fired once and now
              teaches forever. Rent by the session or license by the day.
            </p>
          </div>
          <div className="col-span-12 md:col-span-5 space-y-3">
            <div className="kiln-label">Find by name, subject, or style</div>
            <Input
              placeholder="type to filter the catalog…"
              className="kiln-input h-12 font-mono text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex items-center justify-between kiln-stamp">
              <span>{listings.length.toString().padStart(3, '0')} entries on chain</span>
              <span>Testnet · Galileo</span>
            </div>
          </div>
        </div>

        <div className="kiln-rule mb-10" />

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="kiln-card p-6 h-56 animate-pulse">
                <div className="h-4 w-24 bg-[var(--kiln-bg-3)] rounded-sm mb-4" />
                <div className="h-8 w-44 bg-[var(--kiln-bg-3)] rounded-sm" />
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="kiln-card kiln-ticked p-16 text-center">
            <div className="kiln-stamp mb-4">Workshop empty</div>
            <div className="kiln-display text-3xl mb-2">
              {listings.length === 0 ? 'No models fired yet.' : 'Nothing matches your search.'}
            </div>
            {listings.length === 0 && (
              <p className="text-[var(--kiln-fg-2)] mt-2">
                Be the first to fire a model.
              </p>
            )}
            {listings.length === 0 && (
              <Link href="/onboard" className="inline-block mt-6">
                <button className="kiln-btn-ember h-11 px-7 rounded-sm font-mono text-xs tracking-widest uppercase">
                  Start firing
                </button>
              </Link>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((l, idx) => (
              <ListingCard
                key={l.tokenId}
                listing={l}
                rep={repMap[l.tokenId]}
                // Feature the first card only once the row is full · otherwise
                // a lonely spanning card looks accidental, not editorial.
                featured={filtered.length >= 4 && idx === 0}
              />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}

function ListingCard({
  listing,
  featured,
  rep,
}: {
  listing: Listing
  featured: boolean
  rep: Reputation | undefined
}) {
  const per = BigInt(listing.pricePerSession)
  const day = BigInt(listing.licensePricePerDay)

  return (
    <Link
      href={`/chat/${listing.tokenId}`}
      className={`kiln-card kiln-card-hot block p-6 transition-all ${
        featured ? 'md:col-span-2 lg:col-span-2' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="kiln-stamp">
          Entry · {String(parseInt(listing.tokenId, 10)).padStart(3, '0')}
        </div>
        <div className="kiln-stamp text-[var(--kiln-ember-hot)]">{listing.category}</div>
      </div>

      <div className="mt-6 flex items-start gap-4">
        <KilnAvatar
          tokenId={listing.tokenId}
          name={listing.name}
          category={listing.category}
          reputation={rep?.sessions ?? 0}
          size={featured ? 80 : 64}
        />
        <div className="min-w-0 flex-1">
          <div className={`kiln-display leading-tight truncate ${featured ? 'text-3xl' : 'text-2xl'}`}>
            {listing.name}
          </div>
          <RepBadge rep={rep} className="mt-1" />
          <p className={`mt-2 text-[var(--kiln-fg-1)] leading-relaxed ${featured ? 'text-base line-clamp-3' : 'text-sm line-clamp-2'}`}>
            {listing.blurb}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between border-t border-[var(--kiln-border-soft)] pt-4">
        <div>
          <div className="kiln-label">Per session</div>
          <div className="font-mono text-[var(--kiln-ember-hot)] mt-1 text-sm">
            {per > 0n ? `${ethers.formatEther(per)} OG` : 'disabled'}
          </div>
        </div>
        <div className="text-right">
          <div className="kiln-label">Per day</div>
          <div className="font-mono text-[var(--kiln-fg-1)] mt-1 text-sm">
            {day > 0n ? `${ethers.formatEther(day)} OG` : 'disabled'}
          </div>
        </div>
      </div>
    </Link>
  )
}
