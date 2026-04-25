'use client'
import { useState, useCallback } from 'react'

export function UploadDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [drag, setDrag] = useState(false)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    onFiles(Array.from(e.dataTransfer.files))
  }, [onFiles])

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={`kiln-ticked block cursor-pointer border rounded-sm p-10 text-center transition-all ${
        drag
          ? 'border-[var(--kiln-ember)] bg-[color:rgba(255,90,31,0.06)]'
          : 'border-[var(--kiln-border-soft)] bg-[var(--kiln-bg-1)]/60 hover:border-[var(--kiln-border)] hover:bg-[var(--kiln-bg-1)]'
      }`}
    >
      <input
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))}
      />
      <div className="kiln-stamp">Drop to seal</div>
      <div className="mt-3 kiln-display text-xl text-[var(--kiln-fg-0)]">
        PDFs, TXT, Markdown, PGN, DOCX
      </div>
      <div className="mt-3 text-xs font-mono text-[var(--kiln-fg-2)]">
        Encrypted in your browser with AES-256-GCM before it ever leaves your machine.
      </div>
    </label>
  )
}
