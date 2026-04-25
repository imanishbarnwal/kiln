/// Five Kiln logo concepts, rendered as pure SVG so they stay crisp at any
/// size. Each takes a `size` prop so we can preview them at 16/32/80px.

import { CSSProperties } from 'react'

type Props = { size?: number; className?: string; style?: CSSProperties }

/* ------------------------------------------------------------------ */
/* Concept A · EMBER DROP                                             */
/* A single upward ember / teardrop with a warm gradient. Calm, iconic,
   reads well at favicon size. Pairs cleanly with Fraunces wordmark.  */
/* ------------------------------------------------------------------ */
export function LogoEmber({ size = 64, className, style }: Props) {
  const id = 'ember-' + size
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} style={style}>
      <defs>
        <radialGradient id={id} cx="40%" cy="60%" r="55%">
          <stop offset="0%" stopColor="#FFD08A" />
          <stop offset="45%" stopColor="#FF7A2B" />
          <stop offset="100%" stopColor="#B93A0D" />
        </radialGradient>
      </defs>
      <path
        d="M32 6 C 22 22, 14 30, 14 40 A 18 18 0 0 0 50 40 C 50 30, 42 22, 32 6 Z"
        fill={`url(#${id})`}
      />
      <path
        d="M32 22 C 26 30, 22 36, 22 42 A 10 10 0 0 0 42 42 C 42 36, 38 30, 32 22 Z"
        fill="rgba(255, 230, 190, 0.55)"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Concept B · FIRED SEAL                                             */
/* Circular wax-seal mark with an inner flame glyph. Feels like a
   potter's maker's stamp. Distinct. Works at 16px.                   */
/* ------------------------------------------------------------------ */
export function LogoSeal({ size = 64, className, style }: Props) {
  const id = 'seal-' + size
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} style={style}>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FFB66A" />
          <stop offset="55%" stopColor="#FF5A1F" />
          <stop offset="100%" stopColor="#B93A0D" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill={`url(#${id})`} />
      <circle cx="32" cy="32" r="28" fill="none" stroke="#2A0E04" strokeOpacity="0.5" strokeWidth="1" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="#2A0E04" strokeOpacity="0.35" strokeWidth="0.8" />
      {/* flame glyph */}
      <path
        d="M32 18 C 27 24, 24 28, 24 34 A 8 8 0 0 0 40 34 C 40 28, 37 24, 32 18 Z"
        fill="#1A0803"
        opacity="0.85"
      />
      <circle cx="32" cy="36" r="2.5" fill="#FFE6B5" opacity="0.9" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Concept C · KILN ARCH                                              */
/* A minimal furnace-mouth silhouette: two verticals, a flat lintel,
   a hot glow inside. Architectural, editorial, quiet.                */
/* ------------------------------------------------------------------ */
export function LogoArch({ size = 64, className, style }: Props) {
  const id = 'arch-' + size
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} style={style}>
      <defs>
        <radialGradient id={id} cx="50%" cy="70%" r="50%">
          <stop offset="0%" stopColor="#FFD08A" />
          <stop offset="60%" stopColor="#FF5A1F" />
          <stop offset="100%" stopColor="#3B1608" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* arch silhouette */}
      <path
        d="M14 54 L14 28 A 18 18 0 0 1 50 28 L50 54"
        fill="none"
        stroke="#E8BB5A"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* hot interior */}
      <path
        d="M20 54 L20 32 A 12 12 0 0 1 44 32 L44 54 Z"
        fill={`url(#${id})`}
      />
      {/* tiny flame */}
      <path
        d="M32 36 C 29 40, 27 43, 27 47 A 5 5 0 0 0 37 47 C 37 43, 35 40, 32 36 Z"
        fill="#FFE6B5"
        opacity="0.9"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Concept D · K MONOGRAM                                             */
/* Hand-drawn "K" with a flame embedded in the counter. Elegant,
   wordmark-ready. Pairs with Fraunces italic.                       */
/* ------------------------------------------------------------------ */
export function LogoMonogram({ size = 64, className, style }: Props) {
  const id = 'mono-' + size
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} style={style}>
      <defs>
        <radialGradient id={id} cx="60%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFD08A" />
          <stop offset="60%" stopColor="#FF5A1F" />
          <stop offset="100%" stopColor="#B93A0D" />
        </radialGradient>
      </defs>
      {/* K strokes */}
      <rect x="14" y="12" width="5" height="40" fill="#F6EAD3" rx="1" />
      <path
        d="M22 32 L42 12 L48 16 L28 32 L48 48 L42 52 Z"
        fill="#F6EAD3"
      />
      {/* flame in the counter */}
      <path
        d="M36 30 C 33 34, 31 37, 31 40 A 5 5 0 0 0 41 40 C 41 37, 39 34, 36 30 Z"
        fill={`url(#${id})`}
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Concept E · STAMP & FLAME                                          */
/* A cream disc with a deep-carved ember flame. Reads like a fired
   ceramic tile. Most atmospheric, richest at hero size.              */
/* ------------------------------------------------------------------ */
export function LogoStampFlame({ size = 64, className, style }: Props) {
  const idDisc = 'stamp-disc-' + size
  const idFlame = 'stamp-flame-' + size
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} style={style}>
      <defs>
        <radialGradient id={idDisc} cx="40%" cy="30%" r="85%">
          <stop offset="0%" stopColor="#F7E7C7" />
          <stop offset="80%" stopColor="#D9C090" />
          <stop offset="100%" stopColor="#8A6D40" />
        </radialGradient>
        <linearGradient id={idFlame} x1="50%" y1="10%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FFAE5A" />
          <stop offset="55%" stopColor="#FF5A1F" />
          <stop offset="100%" stopColor="#7A1F06" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill={`url(#${idDisc})`} />
      <circle cx="32" cy="32" r="28" fill="none" stroke="#4A2E1D" strokeOpacity="0.4" strokeWidth="1" />
      {/* carved flame */}
      <path
        d="M32 14 C 25 24, 20 30, 20 40 A 12 12 0 0 0 44 40 C 44 30, 39 24, 32 14 Z"
        fill={`url(#${idFlame})`}
      />
      {/* engraved inner flame highlight */}
      <path
        d="M32 28 C 28 33, 26 37, 26 41 A 6 6 0 0 0 38 41 C 38 37, 36 33, 32 28 Z"
        fill="rgba(255, 230, 190, 0.55)"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Wordmark helper · renders the logo + "Kiln" in Fraunces display   */
/* ------------------------------------------------------------------ */
export function KilnWordmark({
  Logo,
  size = 40,
  text = 'Kiln',
  italicize = false,
}: {
  Logo: React.ComponentType<Props>
  size?: number
  text?: string
  italicize?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <Logo size={size} />
      <span
        className="kiln-display leading-none"
        style={{
          fontSize: size * 0.95,
          fontStyle: italicize ? 'italic' : 'normal',
          fontVariationSettings: italicize
            ? '"opsz" 144, "SOFT" 100, "WONK" 1'
            : '"opsz" 144, "SOFT" 100',
        }}
      >
        {text}
      </span>
    </div>
  )
}
