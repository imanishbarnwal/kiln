/// Persona metadata that lives on-chain in the iNFT's `dataDescriptions[0]` field.
/// ERC-7857 already exposes this as a public string[] per token, so we do not need
/// a separate contract to store user-entered coach data.
///
/// Format: JSON-encoded persona object, prefixed with `kiln:v1:` for version
/// handling. Fallback to the bundled seed personas when parsing fails.

import { PERSONAS as SEED_PERSONAS, type Persona } from './seed-personas'

export type { Persona } from './seed-personas'

const MAGIC = 'kiln:v1:'

export function serializePersona(p: Persona): string {
  return MAGIC + JSON.stringify(p)
}

export function tryParsePersona(raw: string | undefined | null): Persona | null {
  if (!raw || !raw.startsWith(MAGIC)) return null
  try {
    const parsed = JSON.parse(raw.slice(MAGIC.length)) as Partial<Persona>
    if (!parsed.name || !parsed.systemPrompt) return null
    return {
      name: parsed.name,
      category: parsed.category ?? 'General',
      avatar: parsed.avatar ?? '',
      blurb: parsed.blurb ?? '',
      systemPrompt: parsed.systemPrompt,
      ragHash: parsed.ragHash || undefined,
      ragChunkCount: typeof parsed.ragChunkCount === 'number' ? parsed.ragChunkCount : undefined,
    }
  } catch {
    return null
  }
}

/// Resolve a persona for a given tokenId from whatever on-chain descriptions
/// we have, falling back to seed personas and finally a generic stub.
export function resolvePersona(
  tokenId: string | number | bigint,
  onChainDescriptions: string[] | null | undefined,
): Persona {
  const firstDesc = onChainDescriptions?.[0]
  const fromChain = tryParsePersona(firstDesc)
  if (fromChain) return fromChain

  const seeded = SEED_PERSONAS[String(tokenId)]
  if (seeded) return seeded

  return {
    name: `iNFT #${tokenId.toString()}`,
    category: 'General',
    avatar: '',
    blurb: firstDesc && !firstDesc.startsWith(MAGIC)
      ? firstDesc
      : 'Minted on Kiln.',
    systemPrompt: 'You are a helpful AI assistant.',
  }
}
