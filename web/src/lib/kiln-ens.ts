/// Kiln subname helpers · forward + reverse lookup against the Sepolia
/// KilnSubnameRegistrar so the app can route by `<label>.kiln.eth` and
/// surface the canonical subname wherever a tokenId is shown.
///
/// Why Sepolia: ENS subnames live on the Sepolia ENS registry for the
/// hackathon demo. Mainnet ENS still works for forward/reverse lookup
/// of *user* wallet names (handled by `./ens.ts`); these helpers are
/// strictly for the Kiln-issued subname namespace.
///
/// Caching:
///   - `tokenForLabel` and `subnameForToken` cache in-memory for the
///     page lifetime. Subnames don't churn often; a hard refresh is
///     plenty for the demo. No sessionStorage write-through to keep
///     the surface area small.

import { ethers } from 'ethers'

export const KILN_ENS_PARENT =
  process.env.NEXT_PUBLIC_KILN_ENS_PARENT ?? 'kiln.eth'

export const KILN_ENS_REGISTRAR =
  (process.env.NEXT_PUBLIC_KILN_ENS_REGISTRAR ??
    '0x0000000000000000000000000000000000000000') as `0x${string}`

const SEPOLIA_RPC =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC ??
  'https://ethereum-sepolia-rpc.publicnode.com'

const REGISTRAR_ABI = [
  'function tokenSubnode(uint256) view returns (bytes32)',
  'function subnodeToken(bytes32) view returns (uint256)',
  'function subnodeLabel(bytes32) view returns (string)',
  'function labelClaimed(bytes32) view returns (bool)',
  'function register(string,uint256,address,string,string) returns (bytes32)',
  'event SubnameRegistered(uint256 indexed tokenId, bytes32 indexed subnode, string label, address indexed registrant)',
]

let _provider: ethers.JsonRpcProvider | null = null
function provider(): ethers.JsonRpcProvider {
  if (!_provider) _provider = new ethers.JsonRpcProvider(SEPOLIA_RPC)
  return _provider
}

function registrar(): ethers.Contract {
  return new ethers.Contract(KILN_ENS_REGISTRAR, REGISTRAR_ABI, provider())
}

const tokenToName = new Map<string, string | null>()
const labelToToken = new Map<string, bigint | null>()

/// Resolve a Kiln tokenId to its claimed subname (e.g. `mira.kiln.eth`),
/// or null if the token was never claimed.
export async function subnameForToken(
  tokenId: bigint | string | number,
): Promise<string | null> {
  const key = tokenId.toString()
  if (tokenToName.has(key)) return tokenToName.get(key) ?? null

  try {
    const reg = registrar()
    const subnode: string = await reg.tokenSubnode(BigInt(key))
    if (!subnode || subnode === ethers.ZeroHash) {
      tokenToName.set(key, null)
      return null
    }
    const label: string = await reg.subnodeLabel(subnode)
    const full = label ? `${label}.${KILN_ENS_PARENT}` : null
    tokenToName.set(key, full)
    return full
  } catch {
    return null
  }
}

/// Parse and resolve a Kiln subname (e.g. `mira.kiln.eth` or just `mira`)
/// to its tokenId. Returns null when not found.
export async function tokenForSubname(
  input: string | null | undefined,
): Promise<bigint | null> {
  if (!input) return null
  const label = stripParent(input).toLowerCase()
  if (!label || label.includes('.')) return null

  if (labelToToken.has(label)) return labelToToken.get(label) ?? null

  try {
    const subnode = subnodeOf(label)
    const token: bigint = await registrar().subnodeToken(subnode)
    const out = token === 0n ? null : token
    labelToToken.set(label, out)
    return out
  } catch {
    return null
  }
}

/// True when the given label has been claimed under kiln.eth.
export async function isLabelClaimed(label: string): Promise<boolean> {
  const clean = label.trim().toLowerCase()
  if (!clean) return false
  try {
    const labelHash = ethers.keccak256(ethers.toUtf8Bytes(clean))
    const claimed: boolean = await registrar().labelClaimed(labelHash)
    return claimed
  } catch {
    return false
  }
}

/// Drop a single tokenId from the local cache so the next lookup re-fetches.
export function invalidateSubnameCache(tokenId: bigint | string | number) {
  const key = tokenId.toString()
  const cached = tokenToName.get(key)
  if (cached) {
    const label = cached.replace(`.${KILN_ENS_PARENT}`, '')
    labelToToken.delete(label)
  }
  tokenToName.delete(key)
}

/// Recognise inputs the user might type into a URL or search field that
/// look like a Kiln subname: `mira`, `mira.kiln.eth`, `MIRA.KILN.ETH`.
export function looksLikeKilnSubname(s: string): boolean {
  const v = s.trim().toLowerCase()
  if (!v) return false
  if (v === KILN_ENS_PARENT) return false
  if (v.endsWith(`.${KILN_ENS_PARENT}`)) return true
  // bare label · only treat as a subname candidate if it has no dots and
  // is not numeric (numeric paths are tokenIds)
  return !v.includes('.') && !/^\d+$/.test(v)
}

/* ---------------------------- helpers ------------------------------- */

function stripParent(s: string): string {
  const v = s.trim().toLowerCase()
  return v.endsWith(`.${KILN_ENS_PARENT}`)
    ? v.slice(0, v.length - KILN_ENS_PARENT.length - 1)
    : v
}

function subnodeOf(label: string): string {
  // namehash(label.parent) = keccak256(parentNode || keccak256(label))
  const parentNode = ethers.namehash(KILN_ENS_PARENT)
  const labelHash = ethers.keccak256(ethers.toUtf8Bytes(label))
  return ethers.keccak256(ethers.concat([parentNode, labelHash]))
}

export const KILN_ENS_REGISTRAR_ABI = REGISTRAR_ABI
