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
import { targetChain } from '@/lib/chains'

export function ListModal({
  tokenId,
  open,
  onClose,
  onListed,
  initialPerSession,
  initialPerDay,
  mode = 'create',
}: {
  tokenId: bigint
  open: boolean
  onClose: () => void
  onListed?: () => void
  initialPerSession?: bigint
  initialPerDay?: bigint
  mode?: 'create' | 'update'
}) {
  const { wallets } = useWallets()
  const wallet = wallets[0]

  const [perSession, setPerSession] = useState(
    initialPerSession ? ethers.formatEther(initialPerSession) : '0.001',
  )
  const [perDay, setPerDay] = useState(
    initialPerDay ? ethers.formatEther(initialPerDay) : '0.01',
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPerSession(initialPerSession ? ethers.formatEther(initialPerSession) : '0.001')
    setPerDay(initialPerDay ? ethers.formatEther(initialPerDay) : '0.01')
  }, [initialPerSession, initialPerDay, open])

  async function submit() {
    if (!wallet) return toast.error('No wallet')
    let sessionWei: bigint
    let dayWei: bigint
    try {
      sessionWei = ethers.parseEther((perSession || '0').trim())
      dayWei = ethers.parseEther((perDay || '0').trim())
    } catch {
      return toast.error('Invalid price format')
    }
    if (sessionWei === 0n && dayWei === 0n) {
      return toast.error('Set at least one price')
    }

    setBusy(true)
    try {
      if (Number(wallet.chainId.split(':').pop()) !== targetChain.id) {
        await wallet.switchChain(targetChain.id)
      }
      const eip = await wallet.getEthereumProvider()
      const bp = new ethers.BrowserProvider(eip as any)
      const signer = await bp.getSigner()
      const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, signer)
      const market = new ethers.Contract(ADDRESSES.KilnMarket, ABIS.KilnMarket as any, signer)
      const executor = (process.env.NEXT_PUBLIC_KILN_OPS_ADDRESS
        ?? '0x3e8983d0df94f7AF2f830eB5E49d10917dB92303') as `0x${string}`

      // Ensure our executor is authorized for this token. Cheap no-op-ish check:
      // `authorizeUsage` just appends so re-calling is safe but wastes gas. Skip
      // when we know we already did it (mode === 'update').
      if (mode === 'create') {
        toast.message('Authorizing executor…')
        const authTx = await nft.authorizeUsage(tokenId, executor, {
          gasPrice: 5_000_000_000n,
        })
        await authTx.wait()
      }

      toast.message(mode === 'update' ? 'Updating listing…' : 'Listing on marketplace…')
      const listTx = await market.list(
        tokenId,
        sessionWei,
        dayWei,
        `kiln://persona/${tokenId}`,
        { gasPrice: 5_000_000_000n },
      )
      await listTx.wait()

      toast.success(mode === 'update' ? 'Listing updated' : `Listed iNFT #${tokenId}`)
      onListed?.()
      onClose()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'listing failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[var(--kiln-bg-1)] border-[var(--kiln-border)] text-[var(--kiln-fg-0)] max-w-lg">
        <DialogHeader>
          <div className="kiln-stamp">
            {mode === 'update' ? 'Update' : 'List'} · iNFT {tokenId.toString().padStart(3, '0')}
          </div>
          <DialogTitle className="kiln-display text-3xl leading-tight mt-1">
            {mode === 'update' ? 'Reprice' : 'Set your rent.'}
          </DialogTitle>
          <DialogDescription className="text-[var(--kiln-fg-1)] pt-2">
            Leave either field at zero to disable that rent mode. You keep 90%
            of every payment; 8% funds Kiln, 2% flows to the 0G ecosystem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="kiln-label">Per session</span>
              <span className="kiln-stamp">OG</span>
            </div>
            <Input
              placeholder="0.001"
              value={perSession}
              onChange={(e) => setPerSession(e.target.value)}
              className="kiln-input h-11 font-mono"
            />
            <p className="text-xs text-[var(--kiln-fg-2)]">Paid once per chat session.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="kiln-label">License per day</span>
              <span className="kiln-stamp">OG / day</span>
            </div>
            <Input
              placeholder="0.01"
              value={perDay}
              onChange={(e) => setPerDay(e.target.value)}
              className="kiln-input h-11 font-mono"
            />
            <p className="text-xs text-[var(--kiln-fg-2)]">For teams licensing you for N days.</p>
          </div>
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
            onClick={submit}
            disabled={busy}
            className="kiln-btn-ember h-10 px-6 rounded-sm font-mono text-xs tracking-widest uppercase"
          >
            {busy ? 'Firing…' : mode === 'update' ? 'Update' : 'List'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
