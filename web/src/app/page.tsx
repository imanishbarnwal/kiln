import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SiteNav, SiteFooter } from '@/components/site-chrome'

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* atmospheric ember orbs */}
      <div
        aria-hidden
        className="kiln-ember-orb kiln-ember-orb-animated"
        style={{ width: 720, height: 720, top: -260, right: -220 }}
      />
      <div
        aria-hidden
        className="kiln-ember-orb"
        style={{
          width: 520, height: 520, bottom: -200, left: -180,
          background: 'radial-gradient(circle at 50% 50%, rgba(232,187,90,0.45) 0%, rgba(185,58,13,0.15) 50%, transparent 75%)',
          opacity: 0.35,
        }}
      />

      <SiteNav />

      {/* HERO */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-28">
        <div className="grid grid-cols-12 gap-8 items-end">
          <div className="col-span-12 md:col-span-9 space-y-6 kiln-rise">
            <div className="flex items-center gap-3">
              <span className="kiln-label">Chapter I · The Furnace</span>
              <span className="h-px w-16 bg-[var(--kiln-rule)]" />
            </div>

            <h1 className="kiln-display text-[clamp(3.25rem,9vw,7.5rem)] leading-[0.92]">
              Fire your model.
              <br />
              <span className="kiln-display-italic text-[var(--kiln-ember-hot)]">
                Own
              </span>
              <span> your model.</span>
            </h1>

            <p className="max-w-2xl text-lg md:text-xl text-[var(--kiln-fg-1)] leading-relaxed">
              Kiln is the first sovereign atelier for AI experts.
              Upload what you know, encrypt it, mint it as an iNFT you own
              forever, and let the world rent it by the session while you
              sleep.
            </p>
          </div>

          <div className="col-span-12 md:col-span-3 space-y-3 text-right md:text-left">
            <div className="kiln-stamp">No. 001</div>
            <div className="text-xs font-mono text-[var(--kiln-fg-2)] leading-relaxed max-w-[22ch] md:ml-0 ml-auto">
              A workshop for the age of autonomous intelligence.
              Built on 0G Storage, 0G Compute, and ERC-7857.
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-4 kiln-rise" style={{ animationDelay: '120ms' }}>
          <Link href="/onboard">
            <Button className="kiln-btn-ember h-12 px-7 text-sm tracking-widest uppercase font-mono rounded-sm">
              Begin firing
            </Button>
          </Link>
          <Link href="/market">
            <Button
              variant="outline"
              className="h-12 px-7 text-sm tracking-widest uppercase font-mono rounded-sm border-[var(--kiln-border)] bg-transparent hover:bg-[var(--kiln-bg-2)] text-[var(--kiln-fg-0)]"
            >
              Browse the atelier
            </Button>
          </Link>
          <span className="kiln-stamp ml-4 hidden md:inline">
            Testnet live · Galileo 16602
          </span>
        </div>

        {/* Trust bar — infrastructure credits */}
        <div
          className="mt-20 pt-8 border-t border-[var(--kiln-border-soft)]/60 kiln-rise"
          style={{ animationDelay: '240ms' }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <span className="kiln-label">Built on</span>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <a
                href="https://0g.ai"
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-2.5 opacity-80 hover:opacity-100 transition-opacity"
                aria-label="0G · Storage, Compute, Chain"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/0g-purple.svg" alt="0G" className="h-6 w-auto" />
                <span className="kiln-label text-[var(--kiln-fg-1)] group-hover:text-[var(--kiln-fg-0)]">
                  Storage · Compute · Chain
                </span>
              </a>
              <span className="kiln-label text-[var(--kiln-fg-3)] self-center">·</span>
              <a
                href="https://ens.domains"
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-2.5 opacity-80 hover:opacity-100 transition-opacity"
                aria-label="ENS · iNFT subnames"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/ens-mark.svg" alt="ENS" className="h-6 w-auto" />
                <span className="kiln-label text-[var(--kiln-fg-1)] group-hover:text-[var(--kiln-fg-0)]">
                  ENS · Sovereign identity
                </span>
              </a>
              <span className="kiln-label text-[var(--kiln-fg-3)] self-center">·</span>
              <a
                href="https://gensyn.ai"
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-2.5 opacity-80 hover:opacity-100 transition-opacity"
                aria-label="Gensyn AXL · decentralized inference mesh"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/gensyn-mark.svg" alt="Gensyn" className="h-6 w-auto" />
                <span className="kiln-label text-[var(--kiln-fg-1)] group-hover:text-[var(--kiln-fg-0)]">
                  Gensyn AXL · Council mesh
                </span>
              </a>
              <span className="kiln-label text-[var(--kiln-fg-3)] self-center">·</span>
              <span className="kiln-label text-[var(--kiln-fg-1)]">
                ERC-7857 iNFT
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS · three chambers */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="kiln-label">Chapter II · The Process</div>
            <h2 className="mt-3 kiln-display text-4xl md:text-5xl">Three chambers, one firing.</h2>
          </div>
          <div className="kiln-stamp hidden md:block">§ 02</div>
        </div>
        <div className="kiln-rule mb-10" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--kiln-border-soft)]">
          {[
            {
              numeral: 'I',
              title: 'Upload',
              body:
                'Drop your notes, transcripts, PDFs. Kiln encrypts them in the browser with AES-256-GCM and stores the ciphertext on 0G Storage. No one else sees the raw material.',
              tag: 'Encrypted',
            },
            {
              numeral: 'II',
              title: 'Fire',
              body:
                'Kiln fine-tunes your model on decentralized GPUs, computes a Merkle root of the artifact, and mints an ERC-7857 iNFT bound to that root. The token is yours, signed from your wallet.',
              tag: 'Forged on-chain',
            },
            {
              numeral: 'III',
              title: 'Earn',
              body:
                'List your iNFT at any price. Students pay per session, teams license by the day. Inference runs inside a 0G Compute TEE. Buyers use the model but never see the weights.',
              tag: '90 / 8 / 2 split',
            },
          ].map((c) => (
            <div
              key={c.title}
              className="relative bg-[var(--kiln-bg-0)] p-8 md:p-10 transition-colors hover:bg-[var(--kiln-bg-1)] group"
            >
              <div className="flex items-baseline justify-between mb-6">
                <span className="kiln-numeral group-hover:[color:var(--kiln-ember)] transition-colors"
                  style={{ fontSize: '4.5rem' }}>
                  {c.numeral}
                </span>
                <span className="kiln-stamp">{c.tag}</span>
              </div>
              <h3 className="kiln-display text-2xl mb-3">{c.title}</h3>
              <p className="text-[var(--kiln-fg-1)] leading-relaxed text-[0.95rem]">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ETHOS pull-quote */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-2">
            <div className="kiln-label">Chapter III</div>
            <div className="kiln-stamp mt-2">Ethos</div>
          </div>
          <blockquote className="col-span-12 md:col-span-10 kiln-display text-3xl md:text-5xl leading-tight text-[var(--kiln-fg-0)]">
            &ldquo;The best teachers used to retire, and the knowledge
            retired with them. Kiln lets the teacher keep teaching after the
            teacher stops teaching.
            <span className="kiln-display-italic text-[var(--kiln-ember-hot)]"> The coach sleeps. The iNFT does not.</span>&rdquo;
          </blockquote>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
