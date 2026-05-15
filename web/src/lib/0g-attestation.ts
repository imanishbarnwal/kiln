import { getBroker } from './compute'   // existing broker singleton

/// Wraps 0G Compute broker's TEE attestation request.
/// Returns the raw TDX quote when the provider supports it; falls back to a
/// labeled placeholder otherwise so the rest of the flow ships unbroken.
/// The on-chain oracle does not inspect this blob — it only verifies the
/// envelope signature — so a failed fetch is non-blocking for correctness.
export interface TeePayload {
  raw: string                  // 0x-prefixed bytes
  sourcedFrom: 'broker' | 'placeholder'
  signingAddress?: string      // present when sourcedFrom === 'broker'
}

const ATTESTATION_TIMEOUT_MS = 8_000

export async function fetchTeePayload(opts: {
  providerAddress?: string
  sessionId?: string
  tokenId: bigint
}): Promise<TeePayload> {
  try {
    if (!opts.providerAddress) return placeholderFor(opts)

    const broker = await getBroker()
    const racer = broker.inference.verifier.getQuote(opts.providerAddress)
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('attestation timeout')), ATTESTATION_TIMEOUT_MS),
    )
    const quote = await Promise.race([racer, timeout])

    return {
      raw: quote.rawReport.startsWith('0x') ? quote.rawReport : '0x' + quote.rawReport,
      sourcedFrom: 'broker',
      signingAddress: quote.signingAddress,
    }
  } catch (err) {
    console.warn('0g-attestation: getQuote failed, using placeholder', err)
    return placeholderFor(opts)
  }
}

async function placeholderFor(opts: { sessionId?: string; tokenId: bigint }): Promise<TeePayload> {
  const encoder = new TextEncoder()
  const seed = `kiln:placeholder:${opts.tokenId}:${opts.sessionId ?? 'no-session'}`
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(seed))
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return { raw: '0x' + hex, sourcedFrom: 'placeholder' }
}
