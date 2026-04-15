/**
 * Task-aware cascading AI provider — CF Workers AI + Cloud Run Ollama.
 *
 * ZERO token cost. No paid/metered providers (Groq, Gemini, OpenAI, Anthropic).
 *
 * Routes AI requests based on task type to the best provider cascade:
 *   code-generation → Workers AI → Ollama
 *   classification  → Workers AI
 *   extraction      → Workers AI
 *   embedding       → Workers AI only
 *   chat            → Workers AI → Ollama
 *   trainer         → Workers AI → Ollama
 *   default         → Workers AI → Ollama
 *
 * Zero dependencies. Works in browser AND Node.js.
 * CF Workers AI uses the AI binding inside Workers, or HTTP API externally.
 *
 * @module opsagent-core/ai/providers
 */

// ── Task types ──────────────────────────────────────────────────────────────
export const TASK_TYPES = {
  CODE_GENERATION: 'code-generation',
  CLASSIFICATION: 'classification',
  EXTRACTION: 'extraction',
  EMBEDDING: 'embedding',
  CHAT: 'chat',
  TRAINER: 'trainer',
}

// ── Provider interface ──────────────────────────────────────────────────────
// Each provider implements:
//   name: string
//   models: string[]
//   supportedTasks: string[]
//   isAvailable(config): boolean
//   chat(messages, opts, config): Promise<{ content, provider, model, usage? }>
//   stream?(messages, opts, config): ReadableStream | AsyncIterable

// ── CF Workers AI Provider ──────────────────────────────────────────────────

export const WorkersAIProvider = {
  name: 'workers-ai',
  models: [
    '@cf/meta/llama-3.1-8b-instruct',
    '@cf/meta/llama-3.2-3b-instruct',
    '@cf/baai/bge-base-en-v1.5',
  ],
  supportedTasks: ['classification', 'extraction', 'embedding', 'chat'],

  isAvailable(config = {}) {
    // Inside a Worker: AI binding is on env
    if (config.aiBinding) return true
    // Outside a Worker: need account ID + API token for HTTP API
    return Boolean(config.accountId && config.apiToken)
  },

  async chat(messages, opts = {}, config = {}) {
    const model = opts.model || '@cf/meta/llama-3.1-8b-instruct'

    // Path 1: Direct AI binding (inside a CF Worker)
    if (config.aiBinding) {
      const result = await config.aiBinding.run(model, {
        messages,
        max_tokens: opts.maxTokens || 1024,
        temperature: opts.temperature ?? 0.3,
        ...(opts.stream ? { stream: true } : {}),
      })
      if (opts.stream) return { stream: result, provider: 'workers-ai', model }
      return {
        content: result.response || result.result || '',
        provider: 'workers-ai',
        model,
      }
    }

    // Path 2: HTTP API (outside a Worker)
    const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        max_tokens: opts.maxTokens || 1024,
        temperature: opts.temperature ?? 0.3,
        stream: Boolean(opts.stream),
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`Workers AI HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    if (opts.stream) {
      return { stream: response.body, provider: 'workers-ai', model }
    }

    const data = await response.json()
    return {
      content: data.result?.response || '',
      provider: 'workers-ai',
      model,
    }
  },

  async embed(text, config = {}) {
    const model = '@cf/baai/bge-base-en-v1.5'
    if (config.aiBinding) {
      const result = await config.aiBinding.run(model, { text })
      return { embedding: result.data?.[0] || result.data, provider: 'workers-ai', model }
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })
    if (!response.ok) throw new Error(`Workers AI embed HTTP ${response.status}`)
    const data = await response.json()
    return { embedding: data.result?.data?.[0] || data.result?.data, provider: 'workers-ai', model }
  },
}

// ── Cloud Run Ollama Provider ───────────────────────────────────────────────

export const OllamaProvider = {
  name: 'ollama',
  models: ['gemma3:4b', 'gemma3:12b'],
  supportedTasks: ['code-generation', 'chat', 'trainer'],

  isAvailable(config = {}) {
    return Boolean(config.ollamaBaseUrl)
  },

  async chat(messages, opts = {}, config = {}) {
    const model = opts.model || config.ollamaModel || 'gemma3:4b'
    const baseUrl = config.ollamaBaseUrl.replace(/\/+$/, '')
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: Boolean(opts.stream),
        options: {
          temperature: opts.temperature ?? 0.2,
          num_ctx: opts.numCtx || 4096,
        },
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`Ollama HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    if (opts.stream) {
      return { stream: response.body, provider: 'ollama', model }
    }

    const data = await response.json()
    return {
      content: data.message?.content || '',
      provider: 'ollama',
      model,
    }
  },
}

// ── Task-aware cascade routing ──────────────────────────────────────────────

const DEFAULT_CASCADES = {
  'code-generation': ['workers-ai', 'ollama'],
  classification: ['workers-ai'],
  extraction: ['workers-ai'],
  embedding: ['workers-ai'],
  chat: ['workers-ai', 'ollama'],
  trainer: ['workers-ai', 'ollama'],
  default: ['workers-ai', 'ollama'],
}

const PROVIDER_MAP = {
  'workers-ai': WorkersAIProvider,
  ollama: OllamaProvider,
}

// ── CascadingProvider ───────────────────────────────────────────────────────

/**
 * Create a task-aware cascading AI provider.
 *
 * @param {object} config - Provider credentials and endpoints
 * @param {object} [config.aiBinding] - CF Workers AI binding (inside a Worker)
 * @param {string} [config.accountId] - CF account ID (for HTTP API)
 * @param {string} [config.apiToken] - CF API token (for HTTP API)
 * @param {string} [config.ollamaBaseUrl] - Cloud Run Ollama base URL
 * @param {string} [config.ollamaModel] - Ollama model name
 * @param {object} [config.cascades] - Custom cascade overrides per task type
 * @returns {object} CascadingProvider instance
 */
export function createCascadingProvider(config = {}) {
  const cascades = { ...DEFAULT_CASCADES, ...config.cascades }

  function getCascade(taskType) {
    return cascades[taskType] || cascades.default
  }

  function getAvailableProviders() {
    return Object.entries(PROVIDER_MAP)
      .filter(([, provider]) => provider.isAvailable(config))
      .map(([name]) => name)
  }

  /**
   * Run a chat completion with task-aware cascade.
   *
   * @param {Array} messages - Chat messages [{role, content}]
   * @param {object} [opts] - Options
   * @param {string} [opts.taskType='default'] - Task type for routing
   * @param {string} [opts.model] - Override model (skips task routing)
   * @param {number} [opts.temperature=0.2] - Temperature
   * @param {number} [opts.maxTokens=2048] - Max tokens
   * @param {boolean} [opts.stream=false] - Stream response
   * @param {number} [opts.numCtx] - Context window (Ollama only)
   * @returns {Promise<{content, provider, model, usage?, errors?}>}
   */
  async function chat(messages, opts = {}) {
    const taskType = opts.taskType || 'default'
    const cascade = getCascade(taskType)
    const errors = []

    for (const providerName of cascade) {
      const provider = PROVIDER_MAP[providerName]
      if (!provider || !provider.isAvailable(config)) continue

      try {
        const result = await provider.chat(messages, opts, config)
        return { ...result, errors: errors.length ? errors : undefined }
      } catch (err) {
        errors.push({ provider: providerName, error: err.message })
      }
    }

    // All failed or none available
    const available = getAvailableProviders()
    if (available.length === 0) {
      return {
        content: '',
        provider: null,
        model: null,
        error: 'No AI provider configured. Set one of: aiBinding (CF Worker), accountId+apiToken (HTTP), or ollamaBaseUrl',
      }
    }

    return {
      content: '',
      provider: null,
      model: null,
      error: `All providers failed for task "${taskType}": ${errors.map((e) => `${e.provider}: ${e.error}`).join(' | ')}`,
      errors,
    }
  }

  /**
   * Generate embeddings (CF Workers AI only).
   */
  async function embed(text) {
    if (!WorkersAIProvider.isAvailable(config)) {
      throw new Error('Embedding requires CF Workers AI (aiBinding or accountId+apiToken)')
    }
    return WorkersAIProvider.embed(text, config)
  }

  /**
   * Check which providers are configured and available.
   */
  function status() {
    const providers = {}
    for (const [name, provider] of Object.entries(PROVIDER_MAP)) {
      providers[name] = {
        available: provider.isAvailable(config),
        models: provider.models,
        tasks: provider.supportedTasks,
      }
    }
    return { providers, cascades }
  }

  return {
    chat,
    embed,
    status,
    getAvailableProviders,
    getCascade,
    TASK_TYPES,
  }
}
