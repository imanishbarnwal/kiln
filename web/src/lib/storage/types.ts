/// Storage backend interface used by Kiln's encrypted artifact pipeline.
///
/// Multiple backends implement this contract so we can swap between 0G
/// Storage (production target) and local filesystem (current default while
/// 0G Galileo's storage layer stabilizes).
///
/// Returned `rootHash` MUST be a 0x-prefixed 32-byte hex string. We use
/// SHA-256 of the bytes for the local backend; 0G uses its own Merkle root.
/// Both are stored on-chain inside the iNFT's `dataHashes` array, so the
/// downstream contracts and UI do not care which backend produced them.
export interface StorageBackend {
  readonly name: 'local' | '0g'
  uploadBytes(data: Uint8Array): Promise<{ rootHash: string; txHash?: string }>
  downloadBytes(rootHash: string): Promise<Uint8Array>
}
