'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChessBoardInline } from '@/components/chess-board'

type MsgKind = 'ok' | 'error'
type Msg = {
  role: 'user' | 'assistant'
  content: string
  kind?: MsgKind
  retriable?: boolean
}

export type ChatStreamMsg = Msg

export function ChatStream({
  sessionId,
  onMessagesChange,
}: {
  sessionId: string
  /** Called whenever the conversation state changes. Parent persists the
   *  transcript with full metadata it has access to (wallet, tokenId, coach). */
  onMessagesChange?: (messages: Msg[]) => void
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    onMessagesChange?.(messages)
    // intentionally only depends on `messages`; the parent keeps the same
    // callback reference so we don't rerun on prop identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  const runInference = useCallback(
    async (conversation: Msg[]) => {
      setStreaming(true)

      let res: Response
      try {
        res = await fetch(`/api/inference/session/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversation.filter((m) => !m.kind || m.kind === 'ok'),
            stream: true,
          }),
        })
      } catch (err: unknown) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            kind: 'error',
            retriable: true,
            content: `Network error reaching the coach. ${(err as Error).message}`,
          },
        ])
        setStreaming(false)
        return
      }

      if (!res.ok) {
        // Try to parse structured error from our API; fall back to a clean tone
        let message = 'The coach is momentarily unreachable.'
        let retriable = true
        try {
          const json = await res.json()
          if (json?.error) message = prettifyError(String(json.error), res.status)
          if (json?.retriable === false) retriable = false
          if (res.status === 403) retriable = false
        } catch {
          /* ignore · stick with default */
        }
        setMessages((m) => [
          ...m,
          { role: 'assistant', kind: 'error', retriable, content: message },
        ])
        setStreaming(false)
        return
      }

      if (!res.body) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            kind: 'error',
            retriable: true,
            content: 'Empty response from the coach. Try again.',
          },
        ])
        setStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantText = ''
      let openedPlaceholder = false

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const ln of lines) {
          const line = ln.trim()
          if (!line || !line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const json = JSON.parse(payload)
            const tok = json.choices?.[0]?.delta?.content ?? ''
            if (tok) {
              assistantText += tok
              if (!openedPlaceholder) {
                openedPlaceholder = true
                setMessages((m) => [...m, { role: 'assistant', content: '' }])
              }
              setMessages((m) => {
                const copy = [...m]
                copy[copy.length - 1] = { role: 'assistant', content: assistantText }
                return copy
              })
            }
          } catch {
            // partial JSON chunk boundary; skip
          }
        }
      }

      if (!openedPlaceholder) {
        // Stream closed without tokens · treat as an error the user can retry
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            kind: 'error',
            retriable: true,
            content: 'The coach returned an empty reply. Try again.',
          },
        ])
      }
      setStreaming(false)
    },
    [sessionId],
  )

  async function send() {
    if (!input.trim() || streaming) return
    const next: Msg[] = [...messages, { role: 'user', content: input }]
    setMessages(next)
    setInput('')
    await runInference(next)
  }

  async function retry() {
    if (streaming) return
    // Strip the trailing error bubble, keep all prior ok messages
    const cleaned: Msg[] = []
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      if (m.kind === 'error' && i === messages.length - 1) continue
      cleaned.push(m)
    }
    setMessages(cleaned)
    // Nothing to retry if the last non-error message is not a user message
    const lastOk = [...cleaned].reverse().find((m) => !m.kind || m.kind === 'ok')
    if (!lastOk || lastOk.role !== 'user') return
    await runInference(cleaned)
  }

  const lastMsg = messages[messages.length - 1]
  const showRetry = lastMsg?.kind === 'error' && lastMsg.retriable && !streaming

  return (
    <div className="kiln-card flex flex-col h-[60dvh] overflow-hidden">
      <div ref={scrollerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="kiln-stamp text-[var(--kiln-fg-3)] italic normal-case tracking-normal">
            Open with a question. For chess coaches try &ldquo;show me the Italian opening starting position&rdquo;.
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            msg={m}
            isLast={i === messages.length - 1}
            onRetry={showRetry && i === messages.length - 1 ? retry : undefined}
          />
        ))}
        {streaming && lastMsg?.role === 'user' && (
          <div className="flex">
            <div className="px-4 py-3 rounded-sm border border-[var(--kiln-border-soft)] bg-[var(--kiln-bg-2)]/60 text-[var(--kiln-fg-2)]">
              <span className="inline-flex items-center gap-1 font-mono text-xs tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--kiln-ember)] animate-pulse" />
                thinking
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-[var(--kiln-border-soft)] bg-[var(--kiln-bg-0)]/40 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask something…"
          className="kiln-input h-11"
          disabled={streaming}
        />
        <Button
          onClick={send}
          disabled={streaming}
          className="kiln-btn-ember h-11 px-6 rounded-sm font-mono text-xs tracking-widest uppercase"
        >
          {streaming ? '···' : 'Send'}
        </Button>
      </div>
    </div>
  )
}

function MessageBubble({
  msg,
  onRetry,
}: {
  msg: Msg
  isLast: boolean
  onRetry?: () => void
}) {
  if (msg.kind === 'error') {
    return (
      <div className="flex">
        <div className="px-4 py-3 rounded-sm border border-[var(--kiln-rule)]/60 bg-[var(--kiln-bg-2)]/40 text-[var(--kiln-fg-2)] text-sm max-w-[82%]">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--kiln-danger)]" />
            <span className="kiln-label text-[var(--kiln-fg-2)]">Upstream hiccup</span>
          </div>
          <p>{msg.content}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-[var(--kiln-ember-hot)] hover:text-[var(--kiln-ember)] underline-offset-2 hover:underline font-mono text-xs tracking-wider uppercase"
            >
              Retry →
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={msg.role === 'user' ? 'flex justify-end' : 'flex'}>
      <div
        className={`max-w-[82%] px-4 py-3 rounded-sm text-left text-[0.95rem] leading-relaxed ${
          msg.role === 'user'
            ? 'bg-[color:var(--kiln-ember)] text-[#120703] font-medium'
            : 'bg-[var(--kiln-bg-2)] text-[var(--kiln-fg-0)] border border-[var(--kiln-border-soft)]'
        }`}
        style={
          msg.role === 'assistant'
            ? { boxShadow: 'inset 1px 0 0 rgba(255, 90, 31, 0.35)' }
            : undefined
        }
      >
        <MessageRenderer content={msg.content} />
      </div>
    </div>
  )
}

function MessageRenderer({ content }: { content: string }) {
  const fenMatch = content.match(/\[fen\s+([^\]]+)\]/)
  const text = content.replace(/\[fen\s+[^\]]+\]/g, '').trim()
  return (
    <>
      {text && <div className="whitespace-pre-wrap">{text}</div>}
      {fenMatch && <ChessBoardInline fen={fenMatch[1].trim()} />}
    </>
  )
}

/// Turn raw provider errors into short human sentences. Never show raw JSON.
function prettifyError(raw: string, status: number): string {
  const lower = raw.toLowerCase()
  if (status === 403 || lower.includes('executor no longer authorized')) {
    return 'This iNFT was transferred. The old executor is no longer authorized to serve sessions.'
  }
  if (status === 400 && lower.includes('settled')) {
    return 'This session was already settled.'
  }
  if (lower.includes('upstream 502') || lower.includes('upstream provider returned')) {
    return '0G Compute upstream is flaking right now. Try again in a moment.'
  }
  if (status === 502 || lower.includes('all inference providers')) {
    return '0G Compute providers are all timing out. Try again in a moment.'
  }
  if (status === 503 || lower.includes('no chat-capable')) {
    return 'No inference provider is available right now.'
  }
  // Generic fallback · strip any leaked JSON so the user never sees raw dumps
  return 'The coach is momentarily unreachable. Try again in a moment.'
}
