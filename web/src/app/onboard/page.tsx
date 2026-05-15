'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SiteNav, SiteFooter } from '@/components/site-chrome'
import { UploadDropzone } from '@/components/upload-dropzone'
import { UploadGuide } from '@/components/upload-guide'
import { FiringLadder } from '@/components/firing-ladder'
import { generateKey, exportKey, encrypt, sha256Hex } from '@/lib/encryption'
import { ABIS, ADDRESSES } from '@/lib/contracts'
import { galileo } from '@/lib/chains'
import { serializePersona, type Persona } from '@/lib/persona'
import { chunkText, type RagManifest } from '@/lib/rag'

type Phase = 'idle' | 'switching' | 'encrypting' | 'uploading' | 'indexing' | 'minting' | 'done'

const CATEGORY_HINTS = [
  'Chess', 'Wellness', 'Startup', 'Languages',
  'Coding', 'Finance', 'Music', 'Writing', 'Math', 'Art', 'Other',
]

function phaseLabel(p: Phase) {
  switch (p) {
    case 'switching': return 'Switching network'
    case 'encrypting': return 'Sealing artifact'
    case 'uploading': return 'Loading into the chamber'
    case 'indexing': return 'Indexing notes for retrieval'
    case 'minting': return 'Firing on-chain'
    case 'done': return 'Fired'
    default: return 'Begin firing'
  }
}

export default function OnboardPage() {
  const router = useRouter()
  const { authenticated } = usePrivy()
  const { wallets } = useWallets()

  const [files, setFiles] = useState<File[]>([])
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [blurb, setBlurb] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')

  const [phase, setPhase] = useState<Phase>('idle')
  const [rootHash, setRootHash] = useState<string | null>(null)
  const [mintedTokenId, setMintedTokenId] = useState<bigint | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [ragChunkCount, setRagChunkCount] = useState<number | null>(null)

  async function fire() {
    if (!authenticated) return toast.error('Connect your wallet first')
    const wallet = wallets[0]
    if (!wallet) return toast.error('No wallet connected')
    if (!name.trim()) return toast.error('Give your persona a name')
    if (!systemPrompt.trim()) return toast.error('Describe the persona style')
    if (!files.length) return toast.error('Add at least one training file')

    setRagChunkCount(null)
    try {
      if (Number(wallet.chainId.split(':').pop()) !== galileo.id) {
        setPhase('switching')
        await wallet.switchChain(galileo.id)
      }

      setPhase('encrypting')
      const payload = new Uint8Array(await new Blob(files).arrayBuffer())
      const key = await generateKey()
      const { ciphertext } = await encrypt(payload, key)
      const rawKey = await exportKey(key)

      setPhase('uploading')
      const upRes = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: Buffer.from(ciphertext).toString('base64') }),
      })
      if (!upRes.ok) throw new Error(`upload ${upRes.status}: ${await upRes.text()}`)
      const { rootHash: rh, backend } = await upRes.json() as { rootHash: string; backend: string }
      setRootHash(rh)
      toast.success(`Sealed to ${backend}`)

      try {
        sessionStorage.setItem(`kiln.dataKey.${rh}`, Buffer.from(rawKey).toString('base64'))
      } catch {}

      // Build a RAG manifest from the readable contents of the upload.
      // We try to decode the upload as text · if it's binary or empty,
      // we skip the indexing step and the coach falls back to system-
      // prompt-only inference.
      setPhase('indexing')
      const dataHash = await sha256Hex(ciphertext)
      let ragHash: string | undefined
      let ragChunkCount: number | undefined
      try {
        const text = await readFilesAsText(files)
        const chunks = chunkText(text)
        if (chunks.length > 0) {
          const manifest: RagManifest = {
            version: 1,
            sourceDataHash: dataHash,
            source: {
              fileName: files[0].name,
              fileSize: files.reduce((acc, f) => acc + f.size, 0),
              mimeType: files[0].type || 'text/plain',
            },
            chunks,
          }
          const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest))
          const ragRes = await fetch('/api/storage/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: Buffer.from(manifestBytes).toString('base64') }),
          })
          if (ragRes.ok) {
            const { rootHash: rh2 } = await ragRes.json() as { rootHash: string }
            ragHash = rh2
            ragChunkCount = chunks.length
            setRagChunkCount(chunks.length)
            toast.success(`Indexed ${chunks.length} note chunk${chunks.length === 1 ? '' : 's'}`)
          }
        }
      } catch {
        // Indexing is best-effort · the mint should not fail if a coach
        // uploads a binary file. Their system prompt still drives replies.
      }

      setPhase('minting')
      const persona: Persona = {
        name: name.trim(),
        category: category.trim() || 'General',
        avatar: '',
        blurb: blurb.trim() || systemPrompt.trim().slice(0, 120),
        systemPrompt: systemPrompt.trim(),
        ragHash,
        ragChunkCount,
      }
      const descriptions = [serializePersona(persona)]

      const eip = await wallet.getEthereumProvider()
      const bp = new ethers.BrowserProvider(eip as any)
      const signer = await bp.getSigner()
      const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, signer)

      const proofRes = await fetch('/api/attestation/preimage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataHashes: [dataHash] }),
      })
      if (!proofRes.ok) {
        throw new Error(`attestation/preimage failed: ${await proofRes.text()}`)
      }
      const { proofs } = await proofRes.json() as { proofs: string[] }

      const tx = await nft.mint(proofs, descriptions, await signer.getAddress(), {
        gasPrice: 5_000_000_000n,
      })
      setTxHash(tx.hash as `0x${string}`)
      const receipt = await tx.wait()

      const iface = new ethers.Interface(ABIS.KilnAgentNFT as any)
      let tokenId: bigint | null = null
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = iface.parseLog(log)
          if (parsed?.name === 'Minted') { tokenId = parsed.args._tokenId as bigint; break }
        } catch {}
      }
      setMintedTokenId(tokenId)
      setPhase('done')
      toast.success(tokenId !== null ? `Fired iNFT #${tokenId}` : 'Fired')
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'something broke')
      setPhase('idle')
    }
  }

  const working = phase !== 'idle' && phase !== 'done'

  return (
    <div className="relative min-h-dvh">
      <SiteNav />

      {/* subtle ember behind hero */}
      <div
        aria-hidden
        className="kiln-ember-orb"
        style={{ width: 560, height: 560, top: -200, right: -160, opacity: 0.35 }}
      />

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="kiln-label">Intake Form · Coach</div>
            <h1 className="mt-2 kiln-display text-5xl md:text-6xl leading-[0.95]">
              Fire a <span className="kiln-display-italic text-[var(--kiln-ember-hot)]">new</span> model.
            </h1>
          </div>
          <div className="kiln-stamp hidden md:block">§ Onboard</div>
        </div>
        <div className="kiln-rule mb-12" />

        {/* Section 1: IDENTITY */}
        <Section numeral="I" title="Persona" caption="Who is this coach to the world?">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Display name">
              <Input
                placeholder="e.g. GM Mira Volkov"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="kiln-input h-11"
              />
            </Field>
            <Field label="Category">
              <Input
                list="category-options"
                placeholder="Chess, Wellness, Startup…"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="kiln-input h-11"
              />
              <datalist id="category-options">
                {CATEGORY_HINTS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
          </div>
          <Field label="One-line blurb" sub="Shown on marketplace cards.">
            <Input
              placeholder="Russian-school grandmaster. Teaches positional play."
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              className="kiln-input h-11"
            />
          </Field>
          <Field label="System prompt" sub="The voice, the constraints, the teaching method. This shapes every reply.">
            <textarea
              rows={6}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={
                'You are Mira, a Russian-school chess grandmaster. Short paragraphs. Ask one clarifying question per reply when the position is ambiguous. Reference classical games. Never just give the move. Teach the reason.'
              }
              className="kiln-input w-full px-4 py-3.5 resize-y leading-relaxed"
            />
          </Field>
        </Section>

        <div className="kiln-rule my-14" />

        {/* Section 2: MATERIAL */}
        <Section numeral="II" title="Raw material" caption="What will the fire consume?">
          <UploadDropzone onFiles={setFiles} />
          {files.length > 0 && (
            <ul className="mt-4 text-sm font-mono text-[var(--kiln-fg-1)] space-y-1">
              {files.map((f) => (
                <li key={f.name} className="flex items-center justify-between border-b border-[var(--kiln-border-soft)] py-1.5">
                  <span className="text-[var(--kiln-fg-0)]">{f.name}</span>
                  <span className="text-[var(--kiln-fg-2)]">{(f.size / 1024).toFixed(1)} KB</span>
                </li>
              ))}
            </ul>
          )}
          <UploadGuide />
        </Section>

        <div className="kiln-rule my-14" />

        {/* Section 3: FIRE */}
        <Section numeral="III" title="Fire" caption="Encrypt, seal, mint · all from your wallet.">
          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={fire}
              disabled={working}
              className="kiln-btn-ember h-14 px-10 rounded-sm text-sm uppercase tracking-[0.22em] font-mono"
            >
              {phaseLabel(phase)}
            </Button>
            {phase === 'done' && (
              <Button
                variant="outline"
                onClick={() => router.push('/profile')}
                className="h-14 px-8 rounded-sm font-mono text-xs tracking-widest uppercase border-[var(--kiln-border)] bg-transparent hover:bg-[var(--kiln-bg-2)]"
              >
                View my iNFTs
              </Button>
            )}
          </div>

          <FiringLadder phase={phase} ragChunkCount={ragChunkCount} />

          <div className="mt-8 space-y-2 font-mono text-xs text-[var(--kiln-fg-2)]">
            {rootHash && (
              <div>
                <span className="kiln-label mr-3">Artifact root</span>
                <span className="text-[var(--kiln-fg-1)] break-all">{rootHash}</span>
              </div>
            )}
            {txHash && (
              <div>
                <span className="kiln-label mr-3">Mint tx</span>
                <a
                  href={`https://chainscan-galileo.0g.ai/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--kiln-ember-hot)] hover:text-[var(--kiln-ember)] underline-offset-2 hover:underline break-all"
                >
                  {txHash}
                </a>
              </div>
            )}
            {mintedTokenId !== null && (
              <div className="text-[var(--kiln-success)]">
                <span className="kiln-label mr-3 text-[var(--kiln-success)]">Fired</span>
                <Link href={`/chat/${mintedTokenId}`} className="underline underline-offset-2">
                  iNFT #{mintedTokenId.toString()}
                </Link>
              </div>
            )}
          </div>
        </Section>
      </main>

      <SiteFooter />
    </div>
  )
}

function Section({
  numeral,
  title,
  caption,
  children,
}: {
  numeral: string
  title: string
  caption?: string
  children: React.ReactNode
}) {
  return (
    <section className="grid grid-cols-12 gap-x-10 gap-y-6">
      <div className="col-span-12 md:col-span-4 md:sticky md:top-24 md:self-start space-y-3">
        <span className="kiln-numeral block">{numeral}</span>
        <h2 className="kiln-display text-[2rem] leading-tight">{title}</h2>
        {caption && (
          <p className="text-sm text-[var(--kiln-fg-2)] leading-relaxed max-w-[30ch]">{caption}</p>
        )}
      </div>
      <div className="col-span-12 md:col-span-8 space-y-5">
        {children}
      </div>
    </section>
  )
}

function Field({
  label,
  sub,
  children,
}: {
  label: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="kiln-label">{label}</span>
        {sub && (
          <span className="text-xs text-[var(--kiln-fg-2)] text-right">
            {sub}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

async function readFilesAsText(files: File[]): Promise<string> {
  // Decode every file as utf-8 text. Binary blobs decode to garbage but the
  // chunker drops chunks that are too short or noisy; the indexing step is
  // best-effort and the mint succeeds either way.
  const chunks: string[] = []
  for (const f of files) {
    try {
      const buf = await f.arrayBuffer()
      const text = new TextDecoder("utf-8", { fatal: false }).decode(buf)
      if (text && text.trim()) chunks.push(text)
    } catch {}
  }
  return chunks.join('\n\n')
}
