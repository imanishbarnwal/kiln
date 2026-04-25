/// Local filesystem-backed storage. Demo-quality stand-in for 0G Storage.
///
/// Files are content-addressed by SHA-256. Same bytes -> same rootHash, so
/// the downstream behaviour matches what a real Merkle-rooted store would do.
/// Storage root is `KILN_LOCAL_STORAGE_DIR` (default `./.kiln-storage`).

import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import type { StorageBackend } from './types'

function rootDir() {
  const dir = process.env.KILN_LOCAL_STORAGE_DIR
    ?? path.join(process.cwd(), '.kiln-storage')
  return dir
}

function pathFor(rootHash: string) {
  const clean = rootHash.startsWith('0x') ? rootHash.slice(2) : rootHash
  // Two-char shard prefix for filesystem hygiene with many files.
  return path.join(rootDir(), clean.slice(0, 2), clean + '.bin')
}

export const LocalStorage: StorageBackend = {
  name: 'local',

  async uploadBytes(data: Uint8Array) {
    const hash = createHash('sha256').update(data).digest('hex')
    const rootHash = '0x' + hash
    const dest = pathFor(rootHash)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, data)
    return { rootHash }
  },

  async downloadBytes(rootHash: string) {
    const src = pathFor(rootHash)
    try {
      await access(src)
    } catch {
      throw new Error(`LocalStorage: rootHash not found: ${rootHash}`)
    }
    const buf = await readFile(src)
    return new Uint8Array(buf)
  },
}
