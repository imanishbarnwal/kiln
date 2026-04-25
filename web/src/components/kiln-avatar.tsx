/// Deterministic procedural avatar for Kiln iNFTs.
///
/// Each iNFT gets its own visual sigil: a hash-seeded constellation of
/// star-vertices connected by thin lines around a warm ember core, framed
/// by broken outer arc segments (esoteric-instrument look) and finished
/// with a corner serif stamp. Same (tokenId, name, category) always
/// produces the same visual.
///
/// Parameters that evolve with reputation (sessions served):
///   - outer tick glyphs around the perimeter  (1 per ~10 rep, cap 12)
///   - extra constellation lines at higher rep
///   - ember core intensity (brightness + alpha)
///
/// Today reputation is pinned to 0 at the call sites; later we hook it
/// to the on-chain SessionEnded event count per token.

'use client'

import { useMemo } from 'react'

/** Category hue mapping. Designed so the marketplace grid looks varied,
 *  not all orange. Chess, Startup, Writing stay warm; Math/Coding get cool
 *  accents; Art/Music get pink/magenta. */
const CATEGORY_HUE: Record<string, number> = {
  Chess: 14,
  Wellness: 38,
  Startup: 2,
  Languages: 28,
  Coding: 172,
  Finance: 46,
  Music: 332,
  Writing: 20,
  Math: 204,
  Art: 342,
  General: 18,
}

function hash32(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/** Split a seed into a deterministic stream of small integers, mod N. */
function splitSeed(seed: number, n: number): number[] {
  const out: number[] = []
  let s = seed
  for (let i = 0; i < 16; i++) {
    s = Math.imul(s ^ (s >>> 13), 1274126177) >>> 0
    out.push(s % n)
  }
  return out
}

export type KilnAvatarProps = {
  tokenId: string | number | bigint
  name: string
  category?: string
  /** Reputation proxy. Pinned to 0 today; later sourced from SessionEnded event count. */
  reputation?: number
  size?: number
  className?: string
}

type Vertex = { x: number; y: number; r: number }

export function KilnAvatar({
  tokenId,
  name,
  category = 'General',
  reputation = 0,
  size = 64,
  className = '',
}: KilnAvatarProps) {
  const data = useMemo(() => {
    const seed = hash32(`${tokenId}:${name}:${category}`)
    const baseHue = CATEGORY_HUE[category] ?? 18
    const hue = (baseHue + ((seed >> 7) % 14) - 7 + 360) % 360

    const rep01 = Math.min(1, reputation / 100)
    const extraVerts = Math.min(3, Math.floor(reputation / 25))
    const vCount = 4 + (seed % 3) + extraVerts // 4..9

    // Ring radii · slightly irregular so constellations feel organic.
    const streams = splitSeed(seed, 1000)
    const vertices: Vertex[] = []
    for (let i = 0; i < vCount; i++) {
      const angleJitter = ((streams[i] % 500) - 250) / 500 * (Math.PI / vCount)
      const angle = (i / vCount) * Math.PI * 2 + angleJitter - Math.PI / 2
      const radiusJitter = (streams[i + 8] % 10)
      const radius = 22 + radiusJitter
      const starSize = 1.4 + (streams[i] % 10) / 7
      vertices.push({
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
        r: starSize,
      })
    }

    // Edges · pick a subset of possible edges using hash bits, but always
    // connect each vertex to its neighbour so nothing floats alone.
    const edges: Array<[number, number]> = []
    for (let i = 0; i < vCount; i++) {
      edges.push([i, (i + 1) % vCount])
    }
    // Add cross-links based on seed bits. More cross-links with higher rep.
    const crossCap = 2 + Math.floor(rep01 * 4)
    let added = 0
    for (let i = 0; i < vCount && added < crossCap; i++) {
      for (let j = i + 2; j < vCount && added < crossCap; j++) {
        if (i === 0 && j === vCount - 1) continue
        const bit = (seed >> ((i * vCount + j) % 30)) & 1
        if (bit) {
          edges.push([i, j])
          added++
        }
      }
    }

    // Outer arc segments · 3 arcs, positions seeded, angles split so they
    // look like notation on an old instrument dial.
    const arcs = [0, 1, 2].map((k) => {
      const a0 = (streams[k + 3] % 360)
      const a1 = a0 + 24 + (streams[k + 6] % 36)
      return { a0, a1 }
    })

    // Small tick marks around the perimeter · grows with reputation.
    const tickCount = Math.min(12, Math.floor(reputation / 10))

    // Central rune symbol · picked from a small library.
    const runeKey = (seed >> 11) % RUNES.length

    return {
      hue,
      rep01,
      vertices,
      edges,
      arcs,
      tickCount,
      runeKey,
      letter: (name.trim().slice(0, 1) || '·').toUpperCase(),
      serial: String(tokenId).padStart(3, '0'),
    }
  }, [tokenId, name, category, reputation])

  const {
    hue, rep01, vertices, edges, arcs, tickCount, runeKey, letter, serial,
  } = data

  const emberHot = `hsl(${(hue + 14) % 360} 96% 72%)`
  const ember = `hsl(${hue} 90% 58%)`
  const emberDeep = `hsl(${hue} 60% 24%)`
  const emberShadow = `hsl(${hue} 55% 12%)`

  const uid = hash32(`${tokenId}:${name}`) % 100000
  const gradCore = `kiln-core-${uid}`
  const gradDisc = `kiln-disc-${uid}`
  const filterGrain = `kiln-grain-${uid}`
  const filterGlow = `kiln-glow-${uid}`

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-label={`${name} iNFT ${serial}`}
    >
      {/* outer atmospheric halo · not scaled so it can overflow the svg */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 40% 35%, ${emberHot}, ${ember} 40%, transparent 70%)`,
          filter: `blur(${Math.max(6, size * 0.15)}px)`,
          opacity: 0.35 + rep01 * 0.3,
        }}
      />

      <svg viewBox="0 0 100 100" width={size} height={size} className="relative" role="img">
        <defs>
          {/* warm dark disc base */}
          <radialGradient id={gradDisc} cx="40%" cy="32%" r="80%">
            <stop offset="0%" stopColor={emberDeep} />
            <stop offset="55%" stopColor={emberShadow} />
            <stop offset="100%" stopColor="#0B0604" />
          </radialGradient>
          {/* central ember core */}
          <radialGradient id={gradCore} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={emberHot} stopOpacity={0.85 + rep01 * 0.15} />
            <stop offset="35%" stopColor={ember} stopOpacity="0.6" />
            <stop offset="100%" stopColor={ember} stopOpacity="0" />
          </radialGradient>
          <filter id={filterGrain} x="0%" y="0%">
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed={uid % 999} />
            <feColorMatrix values="0 0 0 0 0.95  0 0 0 0 0.70  0 0 0 0 0.45  0 0 0 0.09 0" />
          </filter>
          <filter id={filterGlow} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* outer brass ring */}
        <circle cx="50" cy="50" r="47.5" fill="none" stroke="rgba(232, 187, 90, 0.22)" strokeWidth="0.8" />

        {/* ceramic / fired disc */}
        <circle cx="50" cy="50" r="46" fill={`url(#${gradDisc})`} />

        {/* grain */}
        <circle cx="50" cy="50" r="46" fill={`url(#${filterGrain})`} style={{ mixBlendMode: 'overlay' as any }} />

        {/* outer arc notation */}
        {arcs.map((a, i) => (
          <path
            key={i}
            d={describeArc(50, 50, 44, a.a0, a.a1)}
            stroke="rgba(232, 187, 90, 0.55)"
            strokeWidth="0.6"
            fill="none"
            strokeLinecap="round"
          />
        ))}

        {/* reputation tick marks */}
        {Array.from({ length: tickCount }).map((_, i) => {
          const a = (i / 12) * 360 - 90
          const rad = (a * Math.PI) / 180
          const x1 = 50 + Math.cos(rad) * 48
          const y1 = 50 + Math.sin(rad) * 48
          const x2 = 50 + Math.cos(rad) * 44
          const y2 = 50 + Math.sin(rad) * 44
          return (
            <line key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(246, 234, 211, 0.85)"
              strokeWidth="1"
              strokeLinecap="round"
            />
          )
        })}

        {/* ember core glow */}
        <circle cx="50" cy="50" r="22" fill={`url(#${gradCore})`} />

        {/* constellation edges */}
        {edges.map(([i, j], k) => {
          const a = vertices[i]
          const b = vertices[j]
          return (
            <line
              key={k}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={`hsl(${hue} 80% 72% / 0.55)`}
              strokeWidth="0.5"
              strokeLinecap="round"
            />
          )
        })}

        {/* constellation stars */}
        {vertices.map((v, i) => (
          <g key={i} filter={`url(#${filterGlow})`}>
            <circle cx={v.x} cy={v.y} r={v.r + 0.6} fill={emberHot} opacity="0.6" />
            <circle cx={v.x} cy={v.y} r={v.r} fill="#FCEFD2" />
          </g>
        ))}

        {/* central rune symbol */}
        <g transform="translate(50 50)" opacity="0.9">
          <Rune index={runeKey} stroke={emberHot} />
        </g>

        {/* bottom corner serif stamp in a framed card */}
        <g transform="translate(72 72)">
          <rect x="-10" y="-9" width="20" height="16" rx="1" fill="#0B0604" opacity="0.7" stroke="rgba(232,187,90,0.45)" strokeWidth="0.5" />
          <text
            x="0" y="-0.5"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#F6EAD3"
            style={{
              fontFamily: 'var(--font-fraunces), serif',
              fontWeight: 500,
              fontSize: 9,
              fontVariationSettings: '"opsz" 144, "SOFT" 100',
            }}
          >
            {letter}
          </text>
          <text
            x="0" y="5.2"
            textAnchor="middle"
            fill="rgba(246, 234, 211, 0.55)"
            style={{
              fontFamily: 'var(--font-geist-mono), monospace',
              fontSize: 3.2,
              letterSpacing: 0.5,
            }}
          >
            №{serial}
          </text>
        </g>
      </svg>
    </div>
  )
}

/* ----------------------------- helpers ----------------------------- */

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

/** Small library of rune marks rendered in SVG path form. */
const RUNES: string[] = [
  // alchemical triangle with bar (fire)
  'M -6 4 L 0 -6 L 6 4 Z M -4 0 L 4 0',
  // upward arrow with crossbar
  'M 0 -7 L 0 6 M -4 -3 L 0 -7 L 4 -3 M -3 4 L 3 4',
  // cross of fours
  'M -6 0 L 6 0 M 0 -6 L 0 6 M -4 -4 L 4 4 M -4 4 L 4 -4',
  // diamond with inner dot
  'M 0 -6 L 6 0 L 0 6 L -6 0 Z M 0 0 L 0 0.1',
  // curved rune: crescent + vertical
  'M -5 0 A 5 5 0 1 0 5 0 M 0 -6 L 0 6',
  // hexagram-ish
  'M 0 -7 L 6 3 L -6 3 Z M 0 7 L 6 -3 L -6 -3 Z',
]

function Rune({ index, stroke }: { index: number; stroke: string }) {
  const d = RUNES[index % RUNES.length]
  return (
    <path
      d={d}
      stroke={stroke}
      strokeWidth="0.9"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.85"
    />
  )
}
