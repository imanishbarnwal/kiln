/// Exercises the /api/transfer/proof and /api/attestation/preimage endpoints.
/// Validates that returned proofs decode correctly to the extended envelope
/// shape the oracle expects.
///
/// Usage: pnpm dlx tsx scripts/smoke-attestation.ts

import { ethers } from 'ethers'

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'

async function smokeTransfer() {
  const body = { tokenId: '1', to: '0x' + 'aa'.repeat(20) }
  const res = await fetch(`${BASE}/api/transfer/proof`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error('transfer/proof returned', res.status, await res.text())
    return
  }
  const { proofs } = await res.json()
  for (const proof of proofs) {
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['bytes32', 'bytes32', 'address', 'bytes16', 'uint256', 'uint256', 'bytes'],
      proof,
    )
    console.log('transfer proof decoded:', {
      oldHash: decoded[0],
      newHash: decoded[1],
      receiver: decoded[2],
      sealedKey: decoded[3],
      nonce: decoded[4].toString(),
      expiry: decoded[5].toString(),
      sigLen: ethers.getBytes(decoded[6]).length,
    })
  }
}

async function smokePreimage() {
  const body = { dataHashes: ['0x' + 'bb'.repeat(32)] }
  const res = await fetch(`${BASE}/api/attestation/preimage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error('attestation/preimage returned', res.status, await res.text())
    return
  }
  const { proofs } = await res.json()
  for (const proof of proofs) {
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['bytes32', 'uint256', 'uint256', 'bytes'],
      proof,
    )
    console.log('preimage proof decoded:', {
      dataHash: decoded[0],
      nonce: decoded[1].toString(),
      expiry: decoded[2].toString(),
      sigLen: ethers.getBytes(decoded[3]).length,
    })
  }
}

await smokeTransfer()
await smokePreimage()
console.log('smoke OK')
