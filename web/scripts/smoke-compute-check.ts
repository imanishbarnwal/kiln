import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') })

import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL!)
  const wallet = new ethers.Wallet(process.env.KILN_OPS_PK!, provider)
  const broker = await createZGComputeNetworkBroker(wallet as any)
  try {
    const l = await broker.ledger.getLedger()
    console.log('existing ledger:', l)
  } catch (e) {
    console.log('no ledger:', (e as Error).message)
  }
}
main().catch(console.error)
