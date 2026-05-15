import { AbiCoder, getBytes, Signature, Wallet, keccak256, toUtf8Bytes } from 'ethers'

/// Context tags hashed into the signed digest. Must match
/// KilnAttestationOracle.PREIMAGE_DOMAIN / TRANSFER_DOMAIN exactly.
export const PREIMAGE_DOMAIN = keccak256(toUtf8Bytes('KILN_PREIMAGE_V1'))
export const TRANSFER_DOMAIN = keccak256(toUtf8Bytes('KILN_TRANSFER_V1'))

const coder = AbiCoder.defaultAbiCoder()

export interface PreimageProofInputs {
  dataHash: string       // 0x-prefixed 32 bytes
  nonce: bigint
  expiry: bigint         // unix seconds
}

export interface TransferProofInputs {
  oldDataHash: string
  newDataHash: string
  receiver: string       // 0x-prefixed address
  sealedKey: string      // 0x-prefixed 16 bytes
  nonce: bigint
  expiry: bigint
}

export function buildPreimageProof(
  signer: Wallet,
  inputs: PreimageProofInputs,
): string {
  const digest = keccak256(coder.encode(
    ['bytes32', 'uint256', 'uint256', 'bytes32'],
    [inputs.dataHash, inputs.nonce, inputs.expiry, PREIMAGE_DOMAIN],
  ))
  const sig = signer.signingKey.sign(getBytes(digest))
  const signature = Signature.from(sig).serialized
  return coder.encode(
    ['bytes32', 'uint256', 'uint256', 'bytes'],
    [inputs.dataHash, inputs.nonce, inputs.expiry, signature],
  )
}

export function buildTransferProof(
  signer: Wallet,
  inputs: TransferProofInputs,
): string {
  const digest = keccak256(coder.encode(
    ['bytes32', 'bytes32', 'address', 'bytes16', 'uint256', 'uint256', 'bytes32'],
    [
      inputs.oldDataHash, inputs.newDataHash, inputs.receiver, inputs.sealedKey,
      inputs.nonce, inputs.expiry, TRANSFER_DOMAIN,
    ],
  ))
  const sig = signer.signingKey.sign(getBytes(digest))
  const signature = Signature.from(sig).serialized
  return coder.encode(
    ['bytes32', 'bytes32', 'address', 'bytes16', 'uint256', 'uint256', 'bytes'],
    [
      inputs.oldDataHash, inputs.newDataHash, inputs.receiver, inputs.sealedKey,
      inputs.nonce, inputs.expiry, signature,
    ],
  )
}

/// Random uint256 nonce. Backend is stateless; oracle enforces uniqueness.
export function randomNonce(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let n = 0n
  for (const b of bytes) n = (n << 8n) | BigInt(b)
  return n
}
