/// 0G Compute Network wrapper.
///
/// Server-side only. Reads KILN_OPS_PK to sign ledger ops.
/// Package: @0glabs/0g-serving-broker (active scope for Compute; Storage uses
/// the newer @0gfoundation scope).

import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'

export type Broker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>

let _broker: Broker | null = null

async function broker(): Promise<Broker> {
  if (_broker) return _broker
  const rpc = process.env.ZG_RPC_URL
  const pk = process.env.KILN_OPS_PK
  if (!rpc) throw new Error('ZG_RPC_URL not set')
  if (!pk) throw new Error('KILN_OPS_PK not set')
  const provider = new ethers.JsonRpcProvider(rpc)
  const wallet = new ethers.Wallet(pk, provider)
  _broker = await createZGComputeNetworkBroker(wallet as any)
  return _broker
}

/// Ensure a ledger exists. If none, create one with the minimum 3 OG.
/// Caller is responsible for topping up later via broker.ledger.depositFund
/// if their usage outgrows the initial balance.
export async function ensureLedger(initialOG: number = 3) {
  const b = await broker()
  try {
    await b.ledger.getLedger()
    return // already have one; leave it alone
  } catch {
    // Falls through to create.
  }
  await b.ledger.addLedger(Math.max(initialOG, 3))
}

export async function listInferenceServices() {
  const b = await broker()
  return b.inference.listService()
}

/// Ensure a provider sub-account exists with funds transferred for inference.
/// Required once before first inference call; idempotent after.
export async function prepareProvider(providerAddress: string, transferOG: number = 1) {
  const b = await broker()
  try {
    await b.inference.acknowledgeProviderSigner(providerAddress)
  } catch (e) {
    console.warn('acknowledgeProviderSigner warning:', (e as Error).message)
  }
  try {
    const wei = BigInt(Math.floor(transferOG * 1e18))
    await b.ledger.transferFund(providerAddress, 'inference', wei)
  } catch (e) {
    console.warn('transferFund warning:', (e as Error).message)
  }
}

/// Fetch the inference endpoint + model + billing headers for a provider.
export async function inferenceHandles(providerAddress: string, content?: string) {
  const b = await broker()
  const { endpoint, model } = await b.inference.getServiceMetadata(providerAddress)
  const headers = await b.inference.getRequestHeaders(providerAddress, content)
  return { endpoint, model, headers }
}
