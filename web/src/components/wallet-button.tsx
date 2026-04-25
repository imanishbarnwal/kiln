'use client'
import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { Button } from '@/components/ui/button'
import { resolveAddress, shortAddress } from '@/lib/ens'

export function WalletButton() {
  const { ready, authenticated, user, login, logout } = usePrivy()
  const addr = user?.wallet?.address ?? user?.email?.address ?? ''
  const isAddress = addr.startsWith('0x')

  const [ensName, setEnsName] = useState<string | null>(null)
  useEffect(() => {
    setEnsName(null)
    if (!isAddress) return
    resolveAddress(addr).then(setEnsName)
  }, [addr, isAddress])

  if (!ready) {
    return (
      <Button
        disabled
        variant="outline"
        className="border-[var(--kiln-border)] bg-transparent text-[var(--kiln-fg-2)] font-mono text-xs tracking-wider uppercase"
      >
        Loading
      </Button>
    )
  }
  if (!authenticated) {
    return (
      <Button
        onClick={login}
        className="kiln-btn-ember h-9 px-5 font-mono text-xs tracking-widest uppercase"
      >
        Connect Wallet
      </Button>
    )
  }

  const display = ensName ?? (isAddress ? shortAddress(addr).replace('…', '···') : 'Connected')

  return (
    <Button
      variant="outline"
      onClick={logout}
      title={isAddress ? (ensName ? `${ensName} · ${addr}` : addr) : 'Connected'}
      className="border-[var(--kiln-border)] bg-[var(--kiln-bg-2)]/50 text-[var(--kiln-fg-1)] hover:bg-[var(--kiln-bg-2)] hover:text-[var(--kiln-fg-0)] font-mono text-xs tracking-wider flex items-center gap-2"
    >
      <span className="kiln-dot kiln-dot-live" aria-hidden />
      {display}
    </Button>
  )
}
