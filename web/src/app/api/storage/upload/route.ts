import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { storage } from '@/lib/storage'

export const runtime = 'nodejs'
export const maxDuration = 300

const Body = z.object({
  // base64-encoded ciphertext or raw bytes
  data: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const { data } = Body.parse(json)
    const bytes = Uint8Array.from(Buffer.from(data, 'base64'))
    const { rootHash, txHash } = await storage.uploadBytes(bytes)
    return Response.json({ rootHash, txHash, backend: storage.name })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'upload failed'
    console.error('upload error', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
