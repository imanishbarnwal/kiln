/// Lightweight retrieval over a coach's training material.
///
/// We store the coach's notes as a "manifest" of plaintext chunks in 0G
/// Storage (separate blob from the encrypted artifact, which stays
/// private). At chat time the inference route fetches the manifest,
/// runs BM25 against the student's question, and prepends the top-k
/// chunks to the system prompt so the coach can quote their own
/// material verbatim.
///
/// Why BM25 instead of embeddings:
///   - zero model dependency · runs in any V8 / Node environment
///   - deterministic and fast · no warm-up, no cold-start cost
///   - keyword-heavy domains (chess openings, asanas, frameworks)
///     are exactly where BM25 outperforms naive embeddings anyway
///   - no extra API surface to break in production
///
/// Why plaintext (not encrypted) chunks:
///   - the original raw notes stay encrypted in 0G Storage as proof of
///     authorship · the manifest is the *processed*, publicly-readable
///     teaching corpus, like a public syllabus next to private lecture
///     notes. The on-chain hash of the manifest still anchors integrity.

export type RagChunk = {
  /// Stable ordering for citations · matches the order in the manifest.
  index: number
  /// Trimmed plaintext, ~80-800 chars per chunk.
  text: string
}

export type RagManifest = {
  version: 1
  /// Hash of the original encrypted artifact · binds this manifest to
  /// the iNFT's dataHash so a tampered manifest is detectable.
  sourceDataHash: string
  source: {
    fileName: string
    fileSize: number
    mimeType: string
  }
  chunks: RagChunk[]
}

/// Split raw text into chunks. One chunk per paragraph by default · BM25
/// scores each independently so the retriever can isolate a specific
/// idea (a chess opening, a yoga pose, a framework) instead of pulling
/// a wall of unrelated material. Paragraphs longer than ~800 chars are
/// split further on sentence boundaries to keep retrieval tight.
///
/// Tiny one-line paragraphs are dropped only when the document has a
/// healthy mix of longer ones · for very short notes (a few sentences)
/// we keep everything so the coach has something to cite.
export function chunkText(text: string): RagChunk[] {
  const SOFT_MAX = 800
  const TINY = 30

  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\t+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!cleaned) return []

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const out: string[] = []
  for (const p of paragraphs) {
    if (p.length <= SOFT_MAX) {
      out.push(p)
    } else {
      // Long paragraph · split on sentence boundaries up to SOFT_MAX.
      const sentences = p.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [p]
      let buf = ''
      for (const s of sentences) {
        if (buf.length + s.length > SOFT_MAX) {
          if (buf.trim()) out.push(buf.trim())
          buf = s
        } else {
          buf += s
        }
      }
      if (buf.trim()) out.push(buf.trim())
    }
  }

  // Only filter the truly trivial fragments when we have plenty of chunks.
  const filtered = out.length > 3 ? out.filter((c) => c.length >= TINY) : out
  return filtered.map((text, index) => ({ index, text }))
}

const STOP = new Set([
  'a','an','and','are','as','at','be','by','for','from','has','have','i','in','is','it',
  'of','on','or','that','the','this','to','was','were','will','with','you','your','my',
  'me','we','our','they','their','he','she','his','her','do','does','if','so','no','not',
  'but','can','could','would','should','may','might','about','any','some','what','which',
  "don't","i'm","it's","that's","what's","you're","we're","i've",
])

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
}

/// Standard BM25 (k1=1.5, b=0.75). Returns the top-k chunks by score.
/// Falls back to "first k chunks" when no terms in the query match the
/// corpus · so a totally off-topic question still gets *some* context.
export function bm25TopK(
  chunks: RagChunk[],
  query: string,
  k: number = 3,
): RagChunk[] {
  if (!chunks.length) return []
  const queryTerms = tokenize(query)
  if (!queryTerms.length) return chunks.slice(0, k)

  const docTokens = chunks.map((c) => tokenize(c.text))
  const docLens = docTokens.map((t) => t.length || 1)
  const avgDocLen = docLens.reduce((a, b) => a + b, 0) / chunks.length

  const df = new Map<string, number>()
  for (const tokens of docTokens) {
    const seen = new Set<string>()
    for (const t of tokens) {
      if (!seen.has(t)) { df.set(t, (df.get(t) ?? 0) + 1); seen.add(t) }
    }
  }

  const N = chunks.length
  const k1 = 1.5
  const b = 0.75

  const scores = chunks.map((chunk, i) => {
    let score = 0
    const tokens = docTokens[i]
    const tf = new Map<string, number>()
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)

    for (const term of queryTerms) {
      const docFreq = df.get(term)
      if (!docFreq) continue
      const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5))
      const termFreq = tf.get(term) ?? 0
      const norm = termFreq * (k1 + 1) /
        (termFreq + k1 * (1 - b + (b * docLens[i]) / avgDocLen))
      score += idf * norm
    }
    return { chunk, score }
  })

  scores.sort((a, b) => b.score - a.score)
  // If nothing scored, return the first k chunks · better than nothing.
  if (scores[0].score === 0) return chunks.slice(0, k)
  return scores.slice(0, k).map((s) => s.chunk)
}

/// Format retrieved chunks for injection into the system prompt.
export function formatRetrieved(coachName: string, chunks: RagChunk[]): string {
  if (!chunks.length) return ''
  const cited = chunks
    .map((c) => `[#${c.index + 1}] ${c.text}`)
    .join('\n\n')
  return `Reference material from ${coachName}'s notebook · cite by [#index] when you use it:

${cited}

End of reference. Answer the student's next message using this material when relevant.`
}
