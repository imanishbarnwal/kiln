import { defineChain } from 'viem'

export const galileo = defineChain({
  id: Number(process.env.NEXT_PUBLIC_GALILEO_CHAIN_ID ?? 16602),
  name: '0G Galileo Testnet',
  nativeCurrency: { name: '0G', symbol: 'OG', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmrpc-testnet.0g.ai'] } },
  blockExplorers: {
    default: { name: '0G Galileo Scan', url: 'https://chainscan-galileo.0g.ai' },
  },
  testnet: true,
})

export const aristotle = defineChain({
  id: 16661,
  name: '0G Aristotle Mainnet',
  nativeCurrency: { name: '0G', symbol: 'OG', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmrpc.0g.ai'] } },
  blockExplorers: {
    default: { name: '0G Scan', url: 'https://chainscan.0g.ai' },
  },
})

export const targetChain =
  process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? aristotle : galileo
