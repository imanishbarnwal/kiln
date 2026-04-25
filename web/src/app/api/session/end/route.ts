import type { NextRequest } from 'next/server'
import { ethers } from 'ethers'
import { z } from 'zod'
import { ABIS, ADDRESSES } from '@/lib/contracts'

export const runtime = 'nodejs'

const Body = z.object({
  sessionId: z.union([z.string(), z.number()]),
  rating: z.number().int().min(1).max(5).default(5),
})

/// The market's endSession is `onlyExecutor`. The student cannot settle directly.
/// This route signs the settlement tx from the server-side KILN_OPS_PK wallet,
/// which is the configured executor. It also defends against double-settlement
/// by checking on-chain state before sending.
export async function POST(req: NextRequest) {
  try {
    const { sessionId, rating } = Body.parse(await req.json())
    const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!)
    const wallet = new ethers.Wallet(process.env.KILN_OPS_PK!, provider)
    const market = new ethers.Contract(
      ADDRESSES.KilnMarket,
      ABIS.KilnMarket as any,
      wallet,
    )

    const s: any = await market.sessions(BigInt(sessionId))
    if ((s.settled ?? s[3]) === true) {
      return Response.json({ ok: true, already: true })
    }

    const tx = await market.endSession(BigInt(sessionId), rating, {
      gasPrice: 5_000_000_000n,
    })
    const receipt = await tx.wait()

    return Response.json({ ok: true, txHash: receipt?.hash ?? tx.hash })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'endSession failed'
    console.error('endSession error', err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
