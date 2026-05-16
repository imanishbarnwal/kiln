'use client'

/// Internal export page for ETHGlobal submission images.
///
/// Visit /design/exports in your browser. Two designed boxes are
/// rendered at exact pixel dimensions. Use Cmd-Shift-5 to take a
/// "Capture Selected Portion" screenshot, hold Option while dragging
/// to lock the dimensions, and align to each box's edges.
///
/// Logo: 512x512 (square, used as project icon on ETHGlobal)
/// Cover: 1280x720 (16:9, used as ETHGlobal cover and as the closing
///        end-card frame in the demo video)
///
/// We render with real Fraunces + brand CSS variables so the exports
/// match the live site exactly.

import { LogoStampFlame } from '@/components/logo-concepts'

export default function ExportsPage() {
  return (
    <div style={{ background: '#222', minHeight: '100vh', padding: 32 }}>
      <div style={{ color: '#bbb', fontFamily: 'monospace', fontSize: 13, marginBottom: 24 }}>
        <strong style={{ color: '#fff' }}>Internal · ETHGlobal export page</strong>
        <br />
        Take a Cmd-Shift-5 capture of each box. Hold Option while dragging to lock the size to the exact pixels.
        <br />
        Save as PNG. Upload to the matching field in the ETHGlobal submission form.
      </div>

      {/* === LOGO 512x512 === */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ color: '#9A8467', fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
          LOGO · 512 × 512 · square · ETHGlobal &quot;Logo&quot; field
        </div>
        <div
          id="export-logo"
          style={{
            width: 512,
            height: 512,
            background: 'radial-gradient(ellipse at 50% 40%, #1A0A06 0%, #0B0604 70%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed #444',
          }}
        >
          <LogoStampFlame size={360} />
        </div>
      </div>

      {/* === COVER 1280x720 === */}
      <div>
        <div style={{ color: '#9A8467', fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
          COVER · 1280 × 720 · 16:9 · ETHGlobal &quot;Cover image&quot; field + video end card
        </div>
        <div
          id="export-cover"
          style={{
            width: 1280,
            height: 720,
            position: 'relative',
            background: 'radial-gradient(ellipse at 30% 30%, #2A0F08 0%, #0B0604 65%)',
            overflow: 'hidden',
            border: '1px dashed #444',
            fontFamily: 'var(--font-fraunces), Georgia, serif',
            color: '#F6EAD3',
          }}
        >
          {/* Subtle ember orb top-right */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              width: 560,
              height: 560,
              top: -220,
              right: -180,
              background: 'radial-gradient(circle, rgba(255,90,31,0.35) 0%, rgba(255,90,31,0) 70%)',
              borderRadius: '50%',
              filter: 'blur(10px)',
            }}
          />
          {/* Subtle ember orb bottom-left */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              width: 420,
              height: 420,
              bottom: -180,
              left: -150,
              background: 'radial-gradient(circle, rgba(255,174,90,0.18) 0%, rgba(255,90,31,0) 70%)',
              borderRadius: '50%',
              filter: 'blur(10px)',
            }}
          />

          {/* Top-left: STAMP label */}
          <div
            style={{
              position: 'absolute',
              top: 56,
              left: 64,
              fontFamily: 'var(--font-geist-mono), monospace',
              fontSize: 12,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: '#9A8467',
            }}
          >
            Sovereign agent atelier · est. on 0G
          </div>

          {/* Top-right: workshop tag */}
          <div
            style={{
              position: 'absolute',
              top: 56,
              right: 64,
              fontFamily: 'var(--font-geist-mono), monospace',
              fontSize: 12,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: '#6E5A44',
              textAlign: 'right',
            }}
          >
            Workshop · Galileo 16602
          </div>

          {/* Center · logo + wordmark + tagline */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 28,
              padding: '0 64px',
            }}
          >
            <LogoStampFlame size={148} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
              <span
                style={{
                  fontSize: 132,
                  lineHeight: 1,
                  fontWeight: 400,
                  letterSpacing: '-0.02em',
                  color: '#F6EAD3',
                }}
              >
                Kiln
              </span>
              <span
                style={{
                  fontSize: 132,
                  lineHeight: 1,
                  fontWeight: 400,
                  fontStyle: 'italic',
                  letterSpacing: '-0.01em',
                  color: '#FFAE5A',
                  marginLeft: 14,
                }}
              >
                .
              </span>
            </div>
            <div
              style={{
                fontSize: 22,
                color: '#D6C2A0',
                letterSpacing: '0.02em',
                textAlign: 'center',
                maxWidth: 720,
              }}
            >
              Your knowledge.
              <span style={{ color: '#FFAE5A', fontStyle: 'italic' }}> Your model.</span>
              <span style={{ color: '#9A8467' }}> Yours forever.</span>
            </div>
          </div>

          {/* Bottom-left: URL */}
          <div
            style={{
              position: 'absolute',
              bottom: 56,
              left: 64,
              fontFamily: 'var(--font-geist-mono), monospace',
              fontSize: 13,
              color: '#D6C2A0',
              letterSpacing: '0.04em',
            }}
          >
            kiln-virid-rho.vercel.app
            <div style={{ color: '#6E5A44', fontSize: 11, marginTop: 4, letterSpacing: '0.06em' }}>
              github.com/imanishbarnwal/kiln
            </div>
          </div>

          {/* Bottom-right: partner row */}
          <div
            style={{
              position: 'absolute',
              bottom: 56,
              right: 64,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontFamily: 'var(--font-geist-mono), monospace',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#9A8467',
            }}
          >
            <span>Built on</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/0g-purple.svg" alt="0G" style={{ height: 22, width: 'auto' }} />
            <span style={{ color: '#6E5A44' }}>·</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/ens-mark.svg" alt="ENS" style={{ height: 22, width: 'auto' }} />
            <span style={{ color: '#6E5A44' }}>·</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/gensyn-mark.svg" alt="Gensyn" style={{ height: 22, width: 'auto' }} />
          </div>

          {/* Hairline border like a stamp / certificate */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 32,
              border: '1px solid rgba(74,46,29,0.55)',
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 36,
              border: '1px solid rgba(74,46,29,0.25)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  )
}
