/**
 * streaming-client.js — Generic Ollama/OpenAI-compatible streaming client.
 *
 * Works in both browser and Node.js 18+ (uses native fetch + ReadableStream).
 * Zero dependencies.
 *
 * @example
 *   // Async generator — process tokens one by one
 *   for await (const token of streamChat(endpoint, model, messages)) {
 *     process.stdout.write(token)
 *   }
 *
 *   // Convenience — collect full response
 *   const { text, tokenCount, elapsed } = await streamChatToString(endpoint, model, messages)
 */

/**
 * Stream a chat completion from an Ollama-compatible endpoint.
 * Yields individual content tokens as they arrive.
 *
 * @param {string} endpoint  - Base URL (e.g. 'https://my-ollama.run.app')
 * @param {string} model     - Model name (e.g. 'gemma3:4b')
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options]
 * @param {number} [options.num_ctx=4096]      - Context window size
 * @param {number} [options.temperature=0.1]   - Sampling temperature
 * @param {number} [options.timeout=300000]    - Request timeout (ms), default 5 min
 * @param {AbortSignal} [options.signal]       - External abort signal
 * @yields {string} Individual content tokens
 */
export async function* streamChat(endpoint, model, messages, options = {}) {
  const {
    num_ctx = 4096,
    temperature = 0.1,
    timeout = 300_000,
    signal: externalSignal,
  } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  // Link external signal if provided
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const url = endpoint.replace(/\/+$/, '') + '/api/chat'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        options: { num_ctx, temperature },
        messages,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`AI streaming error: HTTP ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue
        try {
          const j = JSON.parse(line)
          if (j.message?.content) {
            yield j.message.content
          }
        } catch {
          // Partial line — skip
        }
      }
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Convenience wrapper — streams the full response and returns collected text.
 *
 * @param {string} endpoint
 * @param {string} model
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options] - Same as streamChat options
 * @param {function} [options.onToken] - Callback invoked with (token, tokenCount, elapsedMs)
 * @returns {Promise<{text: string, tokenCount: number, elapsed: number}>}
 */
export async function streamChatToString(endpoint, model, messages, options = {}) {
  const { onToken, ...streamOptions } = options
  let text = ''
  let tokenCount = 0
  const startTime = Date.now()

  for await (const token of streamChat(endpoint, model, messages, streamOptions)) {
    text += token
    tokenCount++
    if (onToken) {
      onToken(token, tokenCount, Date.now() - startTime)
    }
  }

  return {
    text,
    tokenCount,
    elapsed: Date.now() - startTime,
  }
}
