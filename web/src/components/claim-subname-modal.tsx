'use client'

/// Claim a `<label>.kiln.eth` subname for a Kiln iNFT you own.
///
/// Flow: user types a label · we debounce-check `labelClaimed` against
/// the live registrar on Sepolia · if free, the user signs an EIP-191
/// message proving wallet ownership and we relay the actual ENS tx
/// from the ops wallet so the user does not have to chain-switch to
/// Sepolia. Cost to user: zero gas. Cost to ops wallet: fractions of
/// a cent of Sepolia ETH per claim.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
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
import {
  KILN_ENS_PARENT,
  isLabelClaimed,
  invalidateSubnameCache,
} from '@/lib/kiln-ens'

type Props = {
  tokenId: bigint
  open: boolean
  onClose: () => void
  onClaimed?: (subname: string, txHash: string) => void
}

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'invalid'

const LABEL_RX = /^[a-z0-9-]{3,40}$/

export function ClaimSubnameModal({ tokenId, open, onClose, onClaimed }: Props) {
  const { wallets } = useWallets()
  const wallet = wallets[0]

  const [label, setLabel] = useState('')
  const [availability, setAvailability] = useState<Availability>('idle')
  const [busy, setBusy] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setLabel('')
      setAvailability('idle')
      setTxHash(null)
    }
  }, [open])

  // Debounced availability check against the live registrar
  useEffect(() => {
    const v = label.trim().toLowerCase()
    if (!v) { setAvailability('idle'); return }
    if (!LABEL_RX.test(v)) { setAvailability('invalid'); return }
    setAvailability('checking')
    let cancelled = false
    const timer = setTimeout(async () => {
      const taken = await isLabelClaimed(v)
      if (!cancelled) setAvailability(taken ? 'taken' : 'free')
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [label])

  async function submit() {
    if (!wallet) return toast.error('No wallet')
    const v = label.trim().toLowerCase()
    if (!LABEL_RX.test(v)) return toast.error('Use 3-40 chars · a-z, 0-9, dashes')
    if (availability === 'taken') return toast.error('Label already claimed')

    setBusy(true)
    setTxHash(null)
    try {
      const message = `Kiln · claim ${v}.kiln.eth for iNFT #${tokenId.toString()}`
      const eip = await wallet.getEthereumProvider()
      // personal_sign · prompts the user's wallet for a tiny signature only
      const signature = (await eip.request({
        method: 'personal_sign',
        params: [message, wallet.address],
      })) as string

      toast.message('Registering on Sepolia ENS…')
      const res = await fetch('/api/ens/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: tokenId.toString(),
          label: v,
          claimant: wallet.address,
          signature,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'claim failed')

      setTxHash(json.txHash as string)
      invalidateSubnameCache(tokenId)
      toast.success(`Claimed ${json.subname}`)
      onClaimed?.(json.subname, json.txHash)
    } catch (err: unknown) {
      const msg = (err as Error).message ?? 'claim failed'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[var(--kiln-bg-1)] border-[var(--kiln-border)] text-[var(--kiln-fg-0)] max-w-lg">
        <DialogHeader>
          <div className="kiln-stamp">ENS · iNFT {tokenId.toString().padStart(3, '0')}</div>
          <DialogTitle className="kiln-display text-3xl leading-tight mt-1">
            Claim a <span className="kiln-display-italic text-[var(--kiln-ember-hot)]">name</span>.
          </DialogTitle>
          <DialogDescription className="text-[var(--kiln-fg-1)] pt-2">
            One label, one iNFT. Permanent on Sepolia ENS · resolves to your
            wallet, with the tokenId stored as a text record so any ENS-aware
            client can route to this coach.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="kiln-label">Label</div>
          <div className="flex items-stretch gap-0">
            <Input
              autoFocus
              placeholder="mira"
              value={label}
              onChange={(e) => setLabel(e.target.value.toLowerCase())}
              className="kiln-input h-11 font-mono text-sm rounded-r-none"
              disabled={busy}
            />
            <div className="h-11 px-4 flex items-center font-mono text-sm bg-[var(--kiln-bg-2)] border border-l-0 border-[var(--kiln-border)] text-[var(--kiln-fg-2)] rounded-r-sm">
              .{KILN_ENS_PARENT}
            </div>
          </div>

          <div className="text-xs font-mono min-h-[1.25rem]">
            {availability === 'checking' && (
              <span className="text-[var(--kiln-fg-2)]">
                <span className="inline-block w-1 h-1 rounded-full bg-[var(--kiln-ember)] animate-pulse mr-2 align-middle" />
                checking availability…
              </span>
            )}
            {availability === 'free' && (
              <span className="text-[var(--kiln-ember-hot)]">
                ✓ {label}.{KILN_ENS_PARENT} is available
              </span>
            )}
            {availability === 'taken' && (
              <span className="text-[var(--kiln-danger)]">
                ✗ {label}.{KILN_ENS_PARENT} already claimed
              </span>
            )}
            {availability === 'invalid' && (
              <span className="text-[var(--kiln-fg-2)]">
                3-40 chars · lowercase a-z, 0-9, dashes
              </span>
            )}
          </div>

          <p className="kiln-stamp normal-case tracking-normal text-[var(--kiln-fg-2)]">
            tip · the registrar mints from the ops wallet, so you sign once and
            pay zero gas. Subname ownership transfers to your wallet on the
            same tx.
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
            onClick={submit}
            disabled={busy || availability !== 'free'}
            className="kiln-btn-ember h-10 px-6 rounded-sm font-mono text-xs tracking-widest uppercase"
          >
            {busy ? 'Claiming…' : 'Claim subname'}
          </Button>
        </div>

        {txHash && (
          <div className="text-xs font-mono text-[var(--kiln-fg-2)] break-all pt-2">
            <span className="kiln-label mr-2">tx</span>
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
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
