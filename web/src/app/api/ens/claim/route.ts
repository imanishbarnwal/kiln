import type { NextRequest } from 'next/server'
import { ethers } from 'ethers'
import { z } from 'zod'
import { ABIS, ADDRESSES } from '@/lib/contracts'
import { KILN_ENS_REGISTRAR, KILN_ENS_REGISTRAR_ABI } from '@/lib/kiln-ens'
import { resolvePersona } from '@/lib/persona'

export const runtime = 'nodejs'

/// Server-relayed claim of `<label>.kiln.eth` for a Kiln iNFT.
///
/// The client signs an EIP-191 message proving wallet ownership without
/// having to chain-switch to Sepolia mid-flow. We verify the signature,
/// confirm the wallet owns the iNFT on Galileo, then fire the actual
/// ENS register() tx on Sepolia from the ops wallet (which already paid
/// for the parent name and holds the parent ownership). Gas cost per
/// claim is fractions of a cent.

const Body = z.object({
  tokenId: z.union([z.string(), z.number()]),
  label: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/, 'lowercase a-z, 0-9 and dashes only'),
  claimant: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
})

export function claimMessage(label: string, tokenId: string): string {
  return `Kiln · claim ${label}.kiln.eth for iNFT #${tokenId}`
}

export async function POST(req: NextRequest) {
  try {
    const { tokenId, label, claimant, signature } = Body.parse(await req.json())
    const tokenIdStr = tokenId.toString()
    const cleanLabel = label.trim().toLowerCase()

    // 1. recover signer from signature
    const message = claimMessage(cleanLabel, tokenIdStr)
    const recovered = ethers.verifyMessage(message, signature)
    if (recovered.toLowerCase() !== claimant.toLowerCase()) {
      return Response.json({ error: 'signature does not match claimant' }, { status: 401 })
    }

    // 2. confirm claimant owns the iNFT on Galileo
    const galileoRpc = process.env.ZG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai'
    const galileo = new ethers.JsonRpcProvider(galileoRpc)
    const nft = new ethers.Contract(ADDRESSES.KilnAgentNFT, ABIS.KilnAgentNFT as any, galileo)
    const owner: string = await nft.ownerOf(BigInt(tokenIdStr))
    if (owner.toLowerCase() !== claimant.toLowerCase()) {
      return Response.json({ error: 'claimant is not the iNFT owner' }, { status: 403 })
    }

    // 3. derive a description from the persona stored on chain (best effort)
    let description = ''
    try {
      const descs: string[] = await nft.dataDescriptionsOf(BigInt(tokenIdStr))
      const persona = resolvePersona(tokenIdStr, descs)
      description = persona.blurb || ''
    } catch {}

    // 4. relay the register tx from the ops wallet on Sepolia
    const sepoliaRpc =
      process.env.SEPOLIA_RPC ??
      process.env.NEXT_PUBLIC_SEPOLIA_RPC ??
      'https://ethereum-sepolia-rpc.publicnode.com'
    const opsPk = process.env.KILN_OPS_PK
    if (!opsPk) {
      return Response.json({ error: 'ops wallet not configured' }, { status: 500 })
    }
    const sepolia = new ethers.JsonRpcProvider(sepoliaRpc)
    const ops = new ethers.Wallet(opsPk, sepolia)
    const registrar = new ethers.Contract(KILN_ENS_REGISTRAR, KILN_ENS_REGISTRAR_ABI, ops)

    // 5. pre-flight · is the label still free?
    const labelHash = ethers.keccak256(ethers.toUtf8Bytes(cleanLabel))
    const taken: boolean = await registrar.labelClaimed(labelHash)
    if (taken) {
      return Response.json({ error: 'label already claimed' }, { status: 409 })
    }
    const existingSubnode: string = await registrar.tokenSubnode(BigInt(tokenIdStr))
    if (existingSubnode && existingSubnode !== ethers.ZeroHash) {
      return Response.json({ error: 'token already has a subname' }, { status: 409 })
    }

    const url = `https://kiln.eth.limo/chat/${tokenIdStr}` // best-effort canonical
    const tx = await registrar.register(cleanLabel, BigInt(tokenIdStr), claimant, description, url)
    const receipt = await tx.wait()

    return Response.json({
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber ?? null,
      subname: `${cleanLabel}.kiln.eth`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'claim failed'
    console.error('ens claim error', err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
