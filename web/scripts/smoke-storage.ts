// Smoke test for 0G Storage round-trip.
// Run: cd web && pnpm dlx tsx scripts/smoke-storage.ts
//
// Reads env from web/.env.local. Uploads a tiny payload, prints the root hash,
// downloads it back, prints the round-tripped string.

import 'dotenv/config'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') })

import { storage } from '../src/lib/storage'

async function main() {
  console.log('backend:', storage.name)
  const seed = 'hello kiln ' + Date.now() + ' '
  const payload = new TextEncoder().encode(seed.repeat(64))
  console.log('uploading', payload.length, 'bytes...')
  const { rootHash, txHash } = await storage.uploadBytes(payload)
  console.log('  rootHash:', rootHash)
  if (txHash) console.log('  txHash:  ', txHash)

  console.log('downloading back...')
  const back = await storage.downloadBytes(rootHash)
  const decoded = new TextDecoder().decode(back)
  console.log('  decoded length:', decoded.length, 'bytes')

  if (decoded === new TextDecoder().decode(payload)) {
    console.log('round-trip ok')
  } else {
    console.error('round-trip MISMATCH')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
