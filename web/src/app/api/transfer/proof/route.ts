import type { NextRequest } from 'next/server'
import { ethers } from 'ethers'
import { z } from 'zod'
import { ABIS, ADDRESSES } from '@/lib/contracts'

export const runtime = 'nodejs'

const Body = z.object({
  tokenId: z.union([z.string(), z.number()]),
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
})

/// Build the proof bytes KilnMockVerifier expects for a transfer.
///
/// Per IERC7857DataVerifier on our mock:
///   TransferValidityProofOutput = abi.decode(proof, (bytes32 oldHash,
///                                                    bytes32 newHash,
///                                                    address receiver,
///                                                    bytes16 sealedKey))
///
/// In production the TEE re-encrypts the artifact and seals a fresh AES key
/// for the receiver's pubkey. For the hackathon we generate a random new
/// dataHash and sealedKey on the server. Receiver + old hash are real.
export async function POST(req: NextRequest) {
  try {
    const { tokenId, to } = Body.parse(await req.json())
    const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!)
    const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, provider)

    const hashes: string[] = await nft.dataHashesOf(BigInt(tokenId))
    if (!hashes.length) {
      return Response.json({ error: 'no data hashes on token' }, { status: 400 })
    }

    const proofs = hashes.map((oldHash) => {
      const newHash = ethers.hexlify(ethers.randomBytes(32))
      const sealedKey = ethers.hexlify(ethers.randomBytes(16))
      return ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'bytes32', 'address', 'bytes16'],
        [oldHash, newHash, to, sealedKey],
      )
    })

    return Response.json({ proofs })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'proof build failed'
    console.error('transfer proof error', err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
