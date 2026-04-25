/// Storage backend factory. Selects implementation based on
/// `NEXT_PUBLIC_STORAGE_BACKEND` at call time (not at module load).
///
/// Usage:
///   import { storage } from '@/lib/storage'
///   const { rootHash } = await storage.uploadBytes(bytes)
///   const back = await storage.downloadBytes(rootHash)

import type { StorageBackend } from './types'
import { LocalStorage } from './local'
import { ZeroGStorage } from './zerog'

function pickBackend(): StorageBackend {
  const name = (process.env.NEXT_PUBLIC_STORAGE_BACKEND ?? 'local').toLowerCase()
  return name === '0g' ? ZeroGStorage : LocalStorage
}

/// Thin proxy that resolves the backend lazily on each call. This avoids
/// ESM import ordering traps when scripts load dotenv after the storage
/// module has been imported.
export const storage: StorageBackend = {
  get name() { return pickBackend().name },
  uploadBytes: (data) => pickBackend().uploadBytes(data),
  downloadBytes: (hash) => pickBackend().downloadBytes(hash),
}

export type { StorageBackend } from './types'
