'use client'

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
import { resolveAddress, resolveName, shortAddress } from '@/lib/ens'

export function TransferModal({
  tokenId,
  open,
  onClose,
  onTransferred,
}: {
  tokenId: bigint
  open: boolean
  onClose: () => void
  onTransferred?: (newOwner: string, txHash: string) => void
}) {
  const { wallets } = useWallets()
  const wallet = wallets[0]

  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)

  // ENS hint state · resolves either direction depending on what user types
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null)
  const [resolvedName, setResolvedName] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    setResolvedAddress(null)
    setResolvedName(null)
    const v = to.trim()
    if (!v) return
    const isAddr = ethers.isAddress(v)
    const looksLikeEns = !isAddr && v.includes('.')
    if (!isAddr && !looksLikeEns) return

    let cancelled = false
    setResolving(true)
    ;(async () => {
      try {
        if (isAddr) {
          const name = await resolveAddress(v)
          if (!cancelled) setResolvedName(name)
        } else if (looksLikeEns) {
          const addr = await resolveName(v)
          if (!cancelled) setResolvedAddress(addr)
        }
      } finally {
        if (!cancelled) setResolving(false)
      }
    })()
    return () => { cancelled = true }
  }, [to])

  /// The on-chain address we will actually transfer to. If the user typed an
  /// ENS name we use the forward-resolved address; otherwise we use the input.
  function effectiveRecipient(): string | null {
    const v = to.trim()
    if (ethers.isAddress(v)) return v
    if (resolvedAddress && ethers.isAddress(resolvedAddress)) return resolvedAddress
    return null
  }

  async function transfer() {
    if (!wallet) return toast.error('No wallet')
    const recipient = effectiveRecipient()
    if (!recipient) return toast.error('Enter a valid 0x... address or .eth name')

    setBusy(true)
    setTxHash(null)
    try {
      // Switch chain if needed.
      if (Number(wallet.chainId.split(':').pop()) !== galileo.id) {
        await wallet.switchChain(galileo.id)
      }

      // Build proof bytes (server has the sender's legacy secret in production;
      // hackathon stand-in uses random new hash + sealed key bound to `to`).
      toast.message('Preparing TEE proof…')
      const res = await fetch('/api/transfer/proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: tokenId.toString(), to: recipient }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'proof api failed')
      const proofs: `0x${string}`[] = json.proofs

      // Sign and broadcast transfer from the current wallet.
      toast.message('Signing transfer…')
      const eip = await wallet.getEthereumProvider()
      const bp = new ethers.BrowserProvider(eip as any)
      const signer = await bp.getSigner()
      const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, signer)

      const tx = await nft.transfer(recipient, tokenId, proofs, {
        gasPrice: 5_000_000_000n,
      })
      setTxHash(tx.hash as `0x${string}`)
      await tx.wait()

      toast.success(`Transferred iNFT #${tokenId} to ${shortAddress(recipient)}`)
      onTransferred?.(recipient, tx.hash)
      onClose()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'transfer failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[var(--kiln-bg-1)] border-[var(--kiln-border)] text-[var(--kiln-fg-0)] max-w-lg">
        <DialogHeader>
          <div className="kiln-stamp">Transfer · iNFT {tokenId.toString().padStart(3, '0')}</div>
          <DialogTitle className="kiln-display text-3xl leading-tight mt-1">
            Send this coach
            <br />
            <span className="kiln-display-italic text-[var(--kiln-ember-hot)]">somewhere else.</span>
          </DialogTitle>
          <DialogDescription className="text-[var(--kiln-fg-1)] pt-2">
            The encrypted artifact is re-sealed for the new owner via the TEE
            oracle. Your existing authorizations wipe. You stop being able to
            query this iNFT the moment the tx lands.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <div className="kiln-label">Recipient · address or .eth name</div>
          <Input
            placeholder="0x… or vitalik.eth"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="kiln-input h-11 font-mono text-sm"
          />
          {/* Resolution hint */}
          {(resolving || resolvedName || resolvedAddress) && (
            <div className="text-xs font-mono text-[var(--kiln-fg-2)] flex items-center gap-2">
              {resolving ? (
                <>
                  <span className="w-1 h-1 rounded-full bg-[var(--kiln-ember)] animate-pulse" />
                  resolving via ENS…
                </>
              ) : resolvedName ? (
                <>
                  <span className="kiln-label normal-case tracking-[0.18em] text-[var(--kiln-fg-3)]">ENS</span>
                  <span className="text-[var(--kiln-ember-hot)]">{resolvedName}</span>
                </>
              ) : resolvedAddress ? (
                <>
                  <span className="kiln-label normal-case tracking-[0.18em] text-[var(--kiln-fg-3)]">resolves to</span>
                  <span className="text-[var(--kiln-fg-1)]">{resolvedAddress}</span>
                </>
              ) : null}
            </div>
          )}
          <p className="kiln-stamp normal-case tracking-normal text-[var(--kiln-fg-2)]">
            tip · use a second wallet you control so you can prove loss-of-access in the demo.
          </p>
        </div>

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
            onClick={transfer}
            disabled={busy || !to}
            className="h-10 px-6 rounded-sm font-mono text-xs tracking-widest uppercase bg-[var(--kiln-danger)] text-white hover:brightness-110"
          >
            {busy ? 'Transferring…' : 'Confirm transfer'}
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
