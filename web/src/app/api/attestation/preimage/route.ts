import type { NextRequest } from 'next/server'
import { ethers } from 'ethers'
import { z } from 'zod'
import { buildPreimageProof, randomNonce } from '@/lib/attestation'

export const runtime = 'nodejs'

const Body = z.object({
  dataHashes: z.array(z.string().regex(/^0x[0-9a-fA-F]{64}$/)).min(1),
})

/// Signs preimage proof envelopes for refine/update flows. The coach owns
/// the resulting dataHashes (they came from coach-uploaded artifacts); the
/// backend just signs the envelope so the oracle accepts it. Two-of-two:
/// the on-chain caller must also be the token owner.
export async function POST(req: NextRequest) {
  try {
    const { dataHashes } = Body.parse(await req.json())
    const signerKey = process.env.KILN_OPS_PK
    if (!signerKey) {
      return Response.json({ error: 'KILN_OPS_PK not configured' }, { status: 500 })
    }
    const signer = new ethers.Wallet(signerKey)
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 5 * 60)

    const proofs = dataHashes.map((dataHash) =>
      buildPreimageProof(signer, {
        dataHash,
        nonce: randomNonce(),
        expiry,
      }),
    )
    return Response.json({ proofs })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'proof build failed'
    console.error('preimage proof error', err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
