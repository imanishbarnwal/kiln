import ABIS from './abis'
import { targetChain } from './chains'

export const ADDRESSES = {
  KilnAgentNFT: (process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  KilnMarket:   (process.env.NEXT_PUBLIC_KILN_MARKET_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
  KilnMockVerifier: (process.env.NEXT_PUBLIC_VERIFIER_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
}

export { ABIS, targetChain }
