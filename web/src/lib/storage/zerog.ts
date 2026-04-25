/// 0G Storage backend using @0gfoundation/0g-ts-sdk (the actively-maintained
/// package; the older @0glabs/0g-ts-sdk@0.3.3 is abandoned).

import { ethers } from 'ethers'
import { Indexer, ZgFile } from '@0gfoundation/0g-ts-sdk'
import { writeFile, readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { StorageBackend } from './types'

let _indexer: Indexer | null = null
function indexer() {
  if (!_indexer) {
    const url = process.env.ZG_INDEXER_URL
    if (!url) throw new Error('ZG_INDEXER_URL not set')
    _indexer = new Indexer(url)
  }
  return _indexer
}

function signer() {
  const rpc = process.env.ZG_RPC_URL
  const pk = process.env.KILN_OPS_PK
  if (!rpc) throw new Error('ZG_RPC_URL not set')
  if (!pk) throw new Error('KILN_OPS_PK not set')
  return new ethers.Wallet(pk, new ethers.JsonRpcProvider(rpc))
}

export const ZeroGStorage: StorageBackend = {
  name: '0g',

  async uploadBytes(data: Uint8Array) {
    const dir = await mkdtemp(path.join(tmpdir(), 'kiln-up-'))
    const src = path.join(dir, 'blob.bin')
    try {
      await writeFile(src, data)
      const file = await ZgFile.fromFilePath(src)
      try {
        // The docs example computes the merkle tree explicitly before upload.
        const [, treeErr] = await file.merkleTree()
        if (treeErr) throw treeErr

        const rpc = process.env.ZG_RPC_URL!
        const [tx, err] = await indexer().upload(
          file,
          rpc,
          signer() as unknown as Parameters<Indexer['upload']>[2],
        )
        if (err) throw err

        // Tx may have single-hash or multi-hash shape depending on fragmentation.
        if ('rootHash' in tx) {
          return { rootHash: tx.rootHash, txHash: tx.txHash }
        }
        return { rootHash: (tx as any).rootHashes?.[0], txHash: (tx as any).txHashes?.[0] }
      } finally {
        await file.close()
      }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  },

  async downloadBytes(rootHash: string) {
    const dir = await mkdtemp(path.join(tmpdir(), 'kiln-dl-'))
    const dest = path.join(dir, 'blob.bin')
    try {
      const err = await indexer().download(rootHash, dest, true)
      if (err) throw err
      const buf = await readFile(dest)
      return new Uint8Array(buf)
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  },
}
