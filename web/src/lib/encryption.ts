/// AES-256-GCM client-side encryption for model artifacts.
/// The data key is generated per artifact, the ciphertext goes to 0G Storage,
/// and the key itself is later sealed by the TEE oracle before being put on-chain.

const ALGO = 'AES-GCM'
const KEY_LENGTH = 256
const IV_BYTES = 12

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return new Uint8Array(raw)
}

// WebCrypto's BufferSource type is fussy about the exact ArrayBuffer flavor
// of a Uint8Array. asBuffer() returns a copy backed by a fresh ArrayBuffer.
function asBuffer(b: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(b.byteLength)
  new Uint8Array(out).set(b)
  return out
}

export async function importKey(rawBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    asBuffer(rawBytes),
    { name: ALGO, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function encrypt(
  plaintext: Uint8Array,
  key: CryptoKey,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: ALGO, iv: asBuffer(iv) }, key, asBuffer(plaintext)),
  )
  return { ciphertext, iv }
}

export async function decrypt(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  key: CryptoKey,
): Promise<Uint8Array> {
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt({ name: ALGO, iv: asBuffer(iv) }, key, asBuffer(ciphertext)),
  )
  return plaintext
}

/// Convenience: hex-encode bytes for on-chain storage of the data hash.
export function bytesToHex(b: Uint8Array): `0x${string}` {
  return ('0x' + Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')) as `0x${string}`
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/// SHA-256 of bytes, returned as a hex 0x-string suitable for the on-chain dataHash.
export async function sha256Hex(b: Uint8Array): Promise<`0x${string}`> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', asBuffer(b)))
  return bytesToHex(digest)
}
