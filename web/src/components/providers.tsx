'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider, createConfig } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http } from 'viem'
import { ReactNode, useState } from 'react'
import { galileo, aristotle, targetChain } from '@/lib/chains'

const wagmiConfig = createConfig({
  chains: [galileo, aristotle],
  transports: {
    [galileo.id]: http(),
    [aristotle.id]: http(),
  },
})

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
  if (!appId) {
    return (
      <div className="min-h-dvh grid place-items-center text-center p-8">
        <div>
          <h1 className="text-2xl font-bold">Configuration missing</h1>
          <p className="mt-2 text-zinc-400">
            Set <code className="text-orange-400">NEXT_PUBLIC_PRIVY_APP_ID</code> in
            <code className="text-orange-400"> web/.env.local</code> and restart the dev server.
          </p>
        </div>
      </div>
    )
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'google', 'wallet'],
        appearance: { theme: 'dark', accentColor: '#FF6B1A' },
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
        defaultChain: targetChain,
        supportedChains: [galileo, aristotle],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}
