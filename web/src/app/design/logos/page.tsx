'use client'

/// Design preview · pick a Kiln logo before committing to code.
/// Not linked in the nav. Visit /design/logos directly.

import { SiteNav, SiteFooter } from '@/components/site-chrome'
import {
  LogoEmber,
  LogoSeal,
  LogoArch,
  LogoMonogram,
  LogoStampFlame,
  KilnWordmark,
} from '@/components/logo-concepts'
import { KilnAvatar } from '@/components/kiln-avatar'

const CONCEPTS = [
  {
    key: 'A',
    title: 'Ember Drop',
    name: 'Concept A',
    Logo: LogoEmber,
    pitch:
      'A single upward ember with a warm radial gradient. Quiet, iconic, reads at favicon size. The safest classy choice.',
    vibe: 'Calm · iconic · favicon-friendly',
  },
  {
    key: 'B',
    title: 'Fired Seal',
    name: 'Concept B',
    Logo: LogoSeal,
    pitch:
      'A circular wax-seal mark with an inner flame glyph. Feels like a potter\u2019s maker\u2019s stamp. Most distinctive at small sizes.',
    vibe: 'Craft · seal · distinctive',
  },
  {
    key: 'C',
    title: 'Kiln Arch',
    name: 'Concept C',
    Logo: LogoArch,
    pitch:
      'Architectural silhouette of a furnace mouth with a hot glow inside. Minimal, editorial, quiet.',
    vibe: 'Minimal · architectural · quiet',
  },
  {
    key: 'D',
    title: 'K Monogram',
    name: 'Concept D',
    Logo: LogoMonogram,
    pitch:
      'Custom K letterform with a flame embedded in its counter. The most \u201cbrand-system\u201d option  ·  pairs with Fraunces italic.',
    vibe: 'Brand-system · letterform',
  },
  {
    key: 'E',
    title: 'Stamp & Flame',
    name: 'Concept E',
    Logo: LogoStampFlame,
    pitch:
      'A fired bone-ceramic disc with a deep-carved ember flame. Richest at hero size  ·  most atmospheric of the five.',
    vibe: 'Atmospheric · ceramic · premium',
  },
]

export default function LogosPage() {
  return (
    <div className="relative min-h-dvh">
      <SiteNav />

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-14 space-y-16">
        <div>
          <div className="kiln-label">Design studio · Logos, not yet committed</div>
          <h1 className="mt-2 kiln-display text-5xl md:text-6xl leading-[0.95]">
            Five marks for <span className="kiln-display-italic text-[var(--kiln-ember-hot)]">Kiln</span>.
          </h1>
          <p className="mt-4 text-[var(--kiln-fg-1)] max-w-2xl">
            Reply with the letter (A, B, C, D, or E) and I will wire it into the
            header, the favicon, and the browser tab. Each mark below renders
            at hero scale, nav scale, and 32&thinsp;px favicon scale so you can
            judge it at every size it will ever appear.
          </p>
          <div className="kiln-rule mt-8" />
        </div>

        {CONCEPTS.map((c) => (
          <section key={c.key} className="grid grid-cols-12 gap-8 items-start">
            <div className="col-span-12 md:col-span-3 space-y-3">
              <span className="kiln-numeral">{c.key}</span>
              <div className="kiln-display text-2xl">{c.title}</div>
              <div className="kiln-stamp">{c.vibe}</div>
              <p className="text-sm text-[var(--kiln-fg-1)] leading-relaxed max-w-[30ch]">
                {c.pitch}
              </p>
            </div>

            <div className="col-span-12 md:col-span-9 space-y-8">
              {/* Hero scale */}
              <div className="kiln-card kiln-ticked p-10 flex items-center justify-center">
                <KilnWordmark Logo={c.Logo} size={96} />
              </div>

              {/* Scale studies */}
              <div className="grid grid-cols-3 gap-4">
                <div className="kiln-card p-6 flex flex-col items-center justify-center gap-3">
                  <c.Logo size={56} />
                  <span className="kiln-stamp">Hero · 56 px</span>
                </div>
                <div className="kiln-card p-6 flex flex-col items-center justify-center gap-3">
                  <KilnWordmark Logo={c.Logo} size={28} />
                  <span className="kiln-stamp">Header · 28 px</span>
                </div>
                <div className="kiln-card p-6 flex flex-col items-center justify-center gap-3">
                  <div className="flex items-center gap-2">
                    <c.Logo size={32} />
                    <c.Logo size={16} />
                  </div>
                  <span className="kiln-stamp">Favicon · 32 / 16 px</span>
                </div>
              </div>

              {/* On a card like marketplace */}
              <div className="kiln-card kiln-card-hot p-6">
                <div className="flex items-start justify-between">
                  <div className="kiln-stamp">Entry · 042</div>
                  <div className="kiln-stamp text-[var(--kiln-ember-hot)]">Chess</div>
                </div>
                <div className="mt-5 flex items-start gap-4">
                  <c.Logo size={56} />
                  <div>
                    <div className="kiln-display text-2xl">GM Mira Volkov</div>
                    <p className="mt-2 text-sm text-[var(--kiln-fg-1)] leading-relaxed">
                      Sample card with Concept {c.key} as the mark.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}

        <div className="kiln-rule" />

        <section className="space-y-6">
          <div className="kiln-label">Bonus · the procedural iNFT avatar</div>
          <h2 className="kiln-display text-3xl">
            Every minted iNFT gets a unique seal, seeded from its on-chain identity.
          </h2>
          <p className="text-[var(--kiln-fg-1)] max-w-2xl">
            Not the brand logo  ·  these are per-coach marks. Deterministic
            per tokenId, hue rotates by category, a reputation tick appears for
            every ten sessions the coach has finished. Today reputation is
            pinned at zero; later it grows with on-chain activity.
          </p>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-4">
            {[
              { n: 'Mira Volkov', c: 'Chess', r: 0 },
              { n: 'Coach Vidya', c: 'Wellness', r: 0 },
              { n: 'Mentor Sam', c: 'Startup', r: 0 },
              { n: 'Teacher Aiko', c: 'Languages', r: 0 },
              { n: 'Coach Mira', c: 'Chess', r: 42 },
              { n: 'Anya P.', c: 'Art', r: 8 },
              { n: 'Deep Math', c: 'Math', r: 37 },
              { n: 'Ezra Voss', c: 'Writing', r: 110 },
              { n: 'Kira', c: 'Music', r: 21 },
              { n: 'Rex', c: 'Coding', r: 65 },
            ].map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <KilnAvatar tokenId={i + 1} name={p.n} category={p.c} reputation={p.r} size={72} />
                <div className="kiln-stamp text-center leading-tight">
                  {p.c}
                  <br />
                  rep {p.r}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
