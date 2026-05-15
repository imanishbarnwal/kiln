'use client'

/// Refine modal · coach edits the persona text on chain.
///
/// Calls KilnAgentNFT.refine(tokenId, proofs, dataDescriptions) which
/// rotates both the data hashes and the descriptions in one tx. The
/// proof[i] is the new keccak256(personaJson) so the on-chain hash
/// stays content-addressed against the new persona string.
///
/// We do NOT touch the underlying encrypted training file in this flow
/// · refine() is for persona text. A separate "swap training material"
/// flow (calls update()) is on the roadmap once fine-tuning is wired.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ethers } from 'ethers'
import { useWallets } from '@privy-io/react-auth'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ABIS, ADDRESSES } from '@/lib/contracts'
import { galileo } from '@/lib/chains'
import { resolvePersona, serializePersona, type Persona } from '@/lib/persona'
import { invalidatePersonaCache } from '@/lib/use-persona'

const CATEGORY_HINTS = [
  'Chess', 'Wellness', 'Startup', 'Languages',
  'Coding', 'Finance', 'Music', 'Writing', 'Math', 'Art', 'Other',
]

type Props = {
  tokenId: bigint
  open: boolean
  onClose: () => void
  onRefined?: (txHash: string) => void
}

export function RefineModal({ tokenId, open, onClose, onRefined }: Props) {
  const { wallets } = useWallets()
  const wallet = wallets[0]

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [blurb, setBlurb] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')

  const [loadingCurrent, setLoadingCurrent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)

  // Pull current persona on open so the form is pre-filled with what's on chain
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingCurrent(true)
    setTxHash(null)
    ;(async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai')
        const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, provider)
        const descs: string[] = await nft.dataDescriptionsOf(tokenId)
        const persona = resolvePersona(tokenId.toString(), descs)
        if (cancelled) return
        setName(persona.name)
        setCategory(persona.category)
        setBlurb(persona.blurb)
        setSystemPrompt(persona.systemPrompt)
      } catch (err: unknown) {
        if (!cancelled) toast.error(`Could not load persona: ${(err as Error).message}`)
      } finally {
        if (!cancelled) setLoadingCurrent(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, tokenId])

  async function submit() {
    if (!wallet) return toast.error('No wallet')
    if (!name.trim()) return toast.error('Display name required')
    if (!systemPrompt.trim()) return toast.error('System prompt required')

    setBusy(true)
    setTxHash(null)
    try {
      if (Number(wallet.chainId.split(':').pop()) !== galileo.id) {
        await wallet.switchChain(galileo.id)
      }

      // Build the new persona JSON
      const persona: Persona = {
        name: name.trim(),
        category: category.trim() || 'General',
        avatar: '',
        blurb: blurb.trim() || systemPrompt.trim().slice(0, 120),
        systemPrompt: systemPrompt.trim(),
      }
      const newDesc = serializePersona(persona)
      const newHash = ethers.keccak256(new TextEncoder().encode(newDesc))

      // Fetch a signed preimage proof envelope (nonce + expiry + sig) from
      // the backend. The oracle rejects bare hashes; it wants the full
      // envelope shape. We pass `proofs` verbatim to the contract.
      toast.message('Preparing TEE proof…')
      const res = await fetch('/api/attestation/preimage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataHashes: [newHash] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'proof api failed')
      const proofs: `0x${string}`[] = json.proofs

      // Sign and broadcast refine() from the owner's wallet
      const eip = await wallet.getEthereumProvider()
      const bp = new ethers.BrowserProvider(eip as any)
      const signer = await bp.getSigner()
      const nft = new ethers.Contract(
        ADDRESSES.KilnAgentNFT,
        ABIS.KilnAgentNFT as any,
        signer,
      )

      toast.message('Refining iNFT…')
      const tx = await nft.refine(tokenId, proofs, [newDesc], {
        gasPrice: 5_000_000_000n,
      })
      setTxHash(tx.hash as `0x${string}`)
      await tx.wait()

      // Drop the persona cache so the marketplace + chat pages pick up
      // the refreshed persona text on next read.
      invalidatePersonaCache(tokenId.toString())

      toast.success(`Refined iNFT #${tokenId}`)
      onRefined?.(tx.hash)
      onClose()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'refine failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[var(--kiln-bg-1)] border-[var(--kiln-border)] text-[var(--kiln-fg-0)] max-w-2xl">
        <DialogHeader>
          <div className="kiln-stamp">Refine · iNFT {tokenId.toString().padStart(3, '0')}</div>
          <DialogTitle className="kiln-display text-3xl leading-tight mt-1">
            Evolve your <span className="kiln-display-italic text-[var(--kiln-ember-hot)]">persona</span>.
          </DialogTitle>
          <DialogDescription className="text-[var(--kiln-fg-1)] pt-2">
            Edit the on-chain persona. Both the data hash and the
            description rotate atomically. Past forks (when shipped) keep
            the old snapshot; new sessions use the refreshed version.
          </DialogDescription>
        </DialogHeader>

        {loadingCurrent ? (
          <div className="py-12 text-center kiln-stamp text-[var(--kiln-fg-2)]">
            Reading current persona from chain…
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="kiln-label">Display name</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="kiln-input h-11"
                />
              </div>
              <div className="space-y-2">
                <span className="kiln-label">Category</span>
                <Input
                  list="refine-category-options"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="kiln-input h-11"
                />
                <datalist id="refine-category-options">
                  {CATEGORY_HINTS.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            <div className="space-y-2">
              <span className="kiln-label">One-line blurb</span>
              <Input
                value={blurb}
                onChange={(e) => setBlurb(e.target.value)}
                className="kiln-input h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="kiln-label">System prompt</span>
                <span className="text-xs text-[var(--kiln-fg-2)]">{systemPrompt.length} chars</span>
              </div>
              <textarea
                rows={6}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="kiln-input w-full px-4 py-3 resize-y leading-relaxed text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--kiln-border-soft)]">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={busy}
            className="text-[var(--kiln-fg-2)] hover:text-[var(--kiln-fg-0)] hover:bg-[var(--kiln-bg-2)] font-mono text-xs uppercase tracking-widest"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy || loadingCurrent}
            className="kiln-btn-ember h-10 px-6 rounded-sm font-mono text-xs tracking-widest uppercase"
          >
            {busy ? 'Refining…' : 'Refine on chain'}
          </Button>
        </div>

        {txHash && (
          <div className="text-xs font-mono text-[var(--kiln-fg-2)] break-all pt-2">
            <span className="kiln-label mr-2">tx</span>
            <a
              href={`https://chainscan-galileo.0g.ai/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--kiln-ember-hot)] hover:underline"
            >
              {txHash}
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
