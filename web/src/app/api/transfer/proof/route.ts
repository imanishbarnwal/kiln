import type { NextRequest } from 'next/server'
import { ethers } from 'ethers'
import { z } from 'zod'
import { ABIS, ADDRESSES } from '@/lib/contracts'
import { buildTransferProof, randomNonce } from '@/lib/attestation'

export const runtime = 'nodejs'

const Body = z.object({
  tokenId: z.union([z.string(), z.number()]),
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
})

/// Builds extended transfer-validity proofs (with backend ECDSA signature)
/// for KilnAttestationOracle. The seller's wallet calls KilnAgentNFT.transfer
/// with these proof bytes; the oracle verifies the signature against its
/// trusted-signer registry.
export async function POST(req: NextRequest) {
  try {
    const { tokenId, to } = Body.parse(await req.json())

    const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!)
    const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, provider)
    const hashes: string[] = await nft.dataHashesOf(BigInt(tokenId))
    if (!hashes.length) {
      return Response.json({ error: 'no data hashes on token' }, { status: 400 })
    }

    const signerKey = process.env.KILN_OPS_PK
    if (!signerKey) {
      return Response.json({ error: 'KILN_OPS_PK not configured' }, { status: 500 })
    }
    const signer = new ethers.Wallet(signerKey)
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 5 * 60)

    const proofs = hashes.map((oldHash) => {
      const newHash = ethers.hexlify(ethers.randomBytes(32))
      const sealedKey = ethers.hexlify(ethers.randomBytes(16))
      return buildTransferProof(signer, {
        oldDataHash: oldHash,
        newDataHash: newHash,
        receiver: to,
        sealedKey,
        nonce: randomNonce(),
        expiry,
      })
    })

    return Response.json({ proofs })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'proof build failed'
    console.error('transfer proof error', err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
