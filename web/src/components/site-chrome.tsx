'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WalletButton } from '@/components/wallet-button'
import { LogoStampFlame } from '@/components/logo-concepts'

export function SiteNav() {
  const pathname = usePathname()

  const links: Array<{ href: string; label: string }> = [
    { href: '/market', label: 'Marketplace' },
    { href: '/council', label: 'Council' },
    { href: '/onboard', label: 'Fire a model' },
    { href: '/profile', label: 'My iNFTs' },
    { href: '/profile/sessions', label: 'Past sessions' },
  ]

  /// Pick the *longest* href that matches the current path. Without this,
  /// /profile/sessions lights up both "My iNFTs" (/profile prefix) and
  /// "Past sessions" (exact). The longest-prefix winner is unambiguous.
  const activeHref = (() => {
    if (pathname === '/') return '/'
    const matches = links
      .map((l) => l.href)
      .filter((href) => pathname === href || pathname?.startsWith(href + '/') || pathname?.startsWith(href))
      .sort((a, b) => b.length - a.length)
    return matches[0] ?? null
  })()
  const isActive = (href: string) => href === activeHref

  return (
    <header className="relative z-10 border-b border-[var(--kiln-border-soft)]/60">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <Link href="/" className="group flex items-center gap-3">
          <LogoStampFlame size={32} />
          <span className="kiln-display text-2xl leading-none group-hover:text-[color:var(--kiln-ember-hot)] transition-colors">
            Kiln
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => {
            const active = isActive(l.href)
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative kiln-display text-[1.0625rem] leading-none transition-colors ${
                  active
                    ? 'text-[var(--kiln-fg-0)]'
                    : 'text-[var(--kiln-fg-2)] hover:text-[var(--kiln-fg-0)]'
                }`}
                style={{ fontVariationSettings: '"opsz" 18, "SOFT" 60' }}
              >
                {l.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-1 h-1 rounded-full bg-[var(--kiln-ember)]"
                    style={{ boxShadow: '0 0 6px 1px rgba(255, 90, 31, 0.7)' }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        <WalletButton />
      </div>
    </header>
  )
}

export function SiteFooter() {
  // Repo URL is env-driven so the deploy can swap it without code edits.
  const repoUrl =
    process.env.NEXT_PUBLIC_GITHUB_URL?.trim() ||
    'https://github.com/imanishbarnwal/kiln'
  const repoLabel = repoUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return (
    <footer className="relative z-10 border-t border-[var(--kiln-border-soft)]/60 mt-24">
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <LogoStampFlame size={24} />
            <span className="kiln-display text-xl leading-none">Kiln</span>
          </div>
          <p className="text-[var(--kiln-fg-2)] max-w-[28ch]">
            A furnace for expertise. Fire your model. Own your model.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://0g.ai"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 px-3.5 py-2 border border-[var(--kiln-border-soft)] rounded-sm hover:border-[var(--kiln-gold)] hover:bg-[var(--kiln-bg-2)]/60 transition-colors group"
              aria-label="Powered by 0G"
            >
              <span className="kiln-label normal-case tracking-[0.2em] text-[var(--kiln-fg-2)] group-hover:text-[var(--kiln-fg-1)]">
                Powered by
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/0g-purple.svg"
                alt="0G"
                width={42}
                height={20}
                className="h-5 w-auto"
              />
            </a>
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-[var(--kiln-border-soft)] rounded-sm hover:border-[var(--kiln-ember)] hover:bg-[var(--kiln-bg-2)]/60 transition-colors group"
              aria-label="View source on GitHub"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden className="text-[var(--kiln-fg-1)] group-hover:text-[var(--kiln-fg-0)]">
                <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.34c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.74.54 1.49v2.21c0 .21.15.46.55.38A8 8 0 0 0 8 0z"/>
              </svg>
              <span className="kiln-label normal-case tracking-[0.18em] text-[var(--kiln-fg-1)] group-hover:text-[var(--kiln-fg-0)]">
                Source
              </span>
            </a>
          </div>
        </div>
        <div className="space-y-2">
          <div className="kiln-label">Built on</div>
          <ul className="text-[var(--kiln-fg-1)] space-y-2">
            <li className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/0g-purple.svg" alt="0G" className="h-4 w-auto" />
              <span>Storage · Compute · Chain</span>
            </li>
            <li className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/ens-mark.svg" alt="ENS" className="h-4 w-auto" />
              <span>ENS · sovereign identity</span>
            </li>
            <li className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/gensyn-mark.svg" alt="Gensyn" className="h-4 w-auto" />
              <span>Gensyn AXL · council mesh</span>
            </li>
            <li className="text-[var(--kiln-fg-2)] pt-1">ERC-7857 iNFT · sovereign ownership</li>
          </ul>
        </div>
        <div className="space-y-2 md:text-right">
          <div className="kiln-label">Workshop</div>
          <ul className="text-[var(--kiln-fg-1)] space-y-1 font-mono text-xs">
            <li>Galileo · chainId 16602</li>
            <li>
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--kiln-ember-hot)] transition-colors"
              >
                {repoLabel}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 pb-8 flex items-center justify-between">
        <span className="kiln-stamp">Kiln · Ember &amp; Bone</span>
        <a
          href={repoUrl}
          target="_blank"
          rel="noreferrer"
          className="kiln-stamp hidden md:inline-flex items-center gap-2 hover:text-[var(--kiln-ember-hot)] transition-colors"
          aria-label="GitHub repository"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.34c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.74.54 1.49v2.21c0 .21.15.46.55.38A8 8 0 0 0 8 0z"/>
          </svg>
          GitHub
        </a>
      </div>
    </footer>
  )
}
