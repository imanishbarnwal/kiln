// Smoke test for 0G Compute inference round-trip.
// Run: cd web && pnpm dlx tsx scripts/smoke-compute.ts
//
// 1) Creates a broker against Galileo.
// 2) Deposits test funds into the ledger (idempotent).
// 3) Lists available inference services.
// 4) Picks a chat-capable service, prepares the provider, runs one chat.

import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') })

import {
  ensureLedger,
  listInferenceServices,
  prepareProvider,
  inferenceHandles,
} from '../src/lib/compute'

async function main() {
  console.log('ensuring ledger...')
  await ensureLedger(3)

  console.log('listing inference services...')
  const services: any[] = await listInferenceServices() as any
  console.log('  found', services.length, 'services')
  for (const s of services.slice(0, 8)) {
    console.log(
      '   *',
      s.provider ?? s.providerAddress ?? '(no addr)',
      '->',
      s.model ?? s.name ?? '(no model)',
    )
  }

  const target = services.find((s) => {
    const m = (s.model ?? s.name ?? '').toLowerCase()
    return m.includes('qwen') || m.includes('gpt-oss') || m.includes('chat')
  }) ?? services[0]
  if (!target) throw new Error('no services available')
  const providerAddress = target.provider ?? target.providerAddress
  console.log('picked provider:', providerAddress, target.model ?? target.name)

  console.log('preparing provider (ack + transferFund)...')
  // Keep transfer small so total lock-up (ledger + provider) fits in our test balance.
  await prepareProvider(providerAddress, 0.5)

  console.log('fetching service metadata + billing headers...')
  const { endpoint, model, headers } = await inferenceHandles(
    providerAddress,
    'Hello from Kiln smoke test.',
  )
  console.log('  endpoint:', endpoint)
  console.log('  model   :', model)

  const body = {
    model,
    messages: [{ role: 'user', content: 'Reply with exactly one word: ready.' }],
  }

  console.log('running chat completion...')
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers as unknown as Record<string, string>) },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error('HTTP', res.status)
    console.error(await res.text())
    process.exit(1)
  }
  const json = await res.json() as any
  const answer = json.choices?.[0]?.message?.content
  console.log('inference answer:', answer)
  console.log('compute smoke test ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
