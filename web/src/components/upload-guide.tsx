'use client'

/// Inline guidance panel shown under the onboard dropzone.
///
/// Gives coaches concrete examples of what to upload (by category) plus an
/// honest note about how the material is used today (persona + on-chain
/// storage) versus where fine-tuning fits in v2.

import { useState } from 'react'

type Example = { label: string; items: string[] }

const EXAMPLES: Example[] = [
  {
    label: 'Chess coach',
    items: [
      'Annotated PGN files of your best games',
      'Opening repertoire notes (PDF or markdown)',
      'Transcripts of 1:1 lesson recordings',
    ],
  },
  {
    label: 'Yoga / wellness teacher',
    items: [
      'Class sequences as plain text',
      'Mysore journal notes',
      'Anatomy cues and injury-modification tables',
    ],
  },
  {
    label: 'Startup mentor',
    items: [
      'Your own blog posts and essays',
      'Talk transcripts or AMA recordings',
      'Investor memos you have written',
    ],
  },
  {
    label: 'Language teacher',
    items: [
      'Lesson plans with example dialogues',
      'Correction notebooks from past students',
      'Grammar explainers in your voice',
    ],
  },
  {
    label: 'Math / science professor',
    items: [
      'Solved problem sets with full worked solutions',
      'Lecture scripts or course notes',
      'Your own proofs and derivations',
    ],
  },
]

export function UploadGuide() {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-4 border border-[var(--kiln-border-soft)] rounded-sm bg-[var(--kiln-bg-1)]/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-[var(--kiln-bg-2)]/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--kiln-fg-2)]"
          >
            <circle cx="7" cy="7" r="5.5" />
            <path d="M7 4v3.5M7 10v.01" />
          </svg>
          <span className="kiln-label text-[var(--kiln-fg-0)]">
            What should I upload?
          </span>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className={`text-[var(--kiln-fg-2)] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-5 border-t border-[var(--kiln-border-soft)]">
          <p className="text-sm text-[var(--kiln-fg-1)] leading-relaxed pt-3">
            Whatever best captures your teaching voice. Structured notes beat
            raw videos. Text beats PDFs with images. Pick the files a student
            would learn the most from if they found them on your desk.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {EXAMPLES.map((ex) => (
              <div key={ex.label} className="space-y-1.5">
                <div className="kiln-stamp text-[var(--kiln-ember-hot)]">{ex.label}</div>
                <ul className="text-[0.8125rem] text-[var(--kiln-fg-1)] space-y-1">
                  {ex.items.map((it) => (
                    <li key={it} className="flex gap-2">
                      <span className="text-[var(--kiln-fg-3)]">›</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-2 border border-[var(--kiln-border-soft)] rounded-sm p-4 bg-[var(--kiln-bg-0)]/40">
            <div className="kiln-label mb-2">How your material is used</div>
            <p className="text-[0.8125rem] text-[var(--kiln-fg-1)] leading-relaxed">
              Files are encrypted in your browser with AES-256-GCM before
              leaving your machine, then pinned to 0G Storage. Today the coach
              persona lives in the system prompt you type above; the uploaded
              files are committed on chain for tamper-evidence and will power
              on-chain fine-tuning in the next release (0G Compute fine-tune,
              currently in testnet beta). You always own the encryption key,
              and you can revoke access by transferring the iNFT.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
