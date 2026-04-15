/**
 * OpsAgent AI Gateway — Cloudflare Worker (Hono)
 *
 * Single edge gateway for all AI requests. Handles:
 *   - CORS for *.netlify.app origins
 *   - Bearer auth
 *   - Task-aware routing via providers.js cascade
 *   - CF Workers AI for lightweight inference
 *   - Groq for code generation
 *   - Cloud Run Ollama as fallback
 *   - Streaming SSE responses
 *
 * Endpoints:
 *   POST /api/chat     — General chat completion (streaming or JSON)
 *   POST /api/trainer   — Trainer-specific: code modification generation
 *   GET  /api/health    — Provider availability status
 *   GET  /              — Gateway info
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseOrigins(env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

function getProviderConfig(env) {
  return {
    aiBinding: env.AI,
    groqApiKey: env.GROQ_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    ollamaBaseUrl: (env.CLOUD_RUN_ENDPOINT || '').replace(/\/+$/, ''),
    ollamaModel: env.CLOUD_RUN_MODEL || 'gemma3:4b',
  }
}

function verifyAuth(c) {
  const token = c.env.API_TOKEN
  if (!token) return true // no auth configured = open (dev mode)
  const auth = c.req.header('Authorization')
  if (!auth) return false
  const bearer = auth.replace(/^Bearer\s+/i, '')
  // Timing-safe comparison
  if (bearer.length !== token.length) return false
  let mismatch = 0
  for (let i = 0; i < bearer.length; i++) {
    mismatch |= bearer.charCodeAt(i) ^ token.charCodeAt(i)
  }
  return mismatch === 0
}

// ── CORS ────────────────────────────────────────────────────────────────────

app.use(
  '/api/*',
  async (c, next) => {
    const origins = parseOrigins(c.env)
    const origin = c.req.header('Origin') || ''
    const allowed = origins.length === 0 || origins.includes(origin)
    const corsMiddleware = cors({
      origin: allowed ? origin : origins[0] || '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    })
    return corsMiddleware(c, next)
  },
)

// ── Auth middleware ──────────────────────────────────────────────────────────

app.use('/api/chat', async (c, next) => {
  if (!verifyAuth(c)) return c.json({ error: 'Unauthorized' }, 401)
  await next()
})

app.use('/api/trainer', async (c, next) => {
  if (!verifyAuth(c)) return c.json({ error: 'Unauthorized' }, 401)
  await next()
})

// ── POST /api/chat ──────────────────────────────────────────────────────────

app.post('/api/chat', async (c) => {
  const body = await c.req.json()
  const { messages, taskType, model, temperature, maxTokens, stream, numCtx } = body

  if (!messages || !Array.isArray(messages)) {
    return c.json({ error: 'messages array required' }, 400)
  }

  const config = getProviderConfig(c.env)

  // Task-aware cascade
  const cascade = getCascadeForTask(taskType || 'default')
  const errors = []

  for (const providerName of cascade) {
    try {
      const result = await runProvider(providerName, messages, {
        model,
        temperature,
        maxTokens,
        stream,
        numCtx,
        taskType,
      }, config)

      if (stream && result.stream) {
        return new Response(result.stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Provider': result.provider,
            'X-Model': result.model,
          },
        })
      }

      return c.json({
        content: result.content,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        errors: errors.length ? errors : undefined,
      })
    } catch (err) {
      errors.push({ provider: providerName, error: err.message })
    }
  }

  return c.json(
    {
      error: `All providers failed for task "${taskType || 'default'}"`,
      errors,
    },
    502,
  )
})

// ── POST /api/trainer ───────────────────────────────────────────────────────

app.post('/api/trainer', async (c) => {
  const body = await c.req.json()
  const { messages, model, temperature, stream, numCtx } = body

  if (!messages || !Array.isArray(messages)) {
    return c.json({ error: 'messages array required' }, 400)
  }

  const config = getProviderConfig(c.env)

  // Trainer tasks use trainer cascade: Groq → Gemini → Ollama
  const cascade = getCascadeForTask('trainer')
  const errors = []

  for (const providerName of cascade) {
    try {
      const result = await runProvider(providerName, messages, {
        model,
        temperature: temperature ?? 0.1,
        maxTokens: 4096,
        stream,
        numCtx: numCtx || 8192,
        taskType: 'trainer',
      }, config)

      if (stream && result.stream) {
        return new Response(result.stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Provider': result.provider,
            'X-Model': result.model,
          },
        })
      }

      return c.json({
        content: result.content,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
      })
    } catch (err) {
      errors.push({ provider: providerName, error: err.message })
    }
  }

  return c.json({ error: 'All providers failed for trainer', errors }, 502)
})

// ── GET /api/health ─────────────────────────────────────────────────────────

app.get('/api/health', async (c) => {
  const config = getProviderConfig(c.env)
  const providers = {
    'workers-ai': Boolean(config.aiBinding),
    groq: Boolean(config.groqApiKey),
    gemini: Boolean(config.geminiApiKey),
    ollama: Boolean(config.ollamaBaseUrl),
  }

  return c.json({
    status: 'ok',
    gateway: 'opsagent-ai-gateway',
    version: '0.1.0',
    providers,
    timestamp: new Date().toISOString(),
  })
})

// ── GET / ───────────────────────────────────────────────────────────────────

app.get('/', (c) =>
  c.json({
    name: 'OpsAgent AI Gateway',
    version: '0.1.0',
    endpoints: ['/api/chat', '/api/trainer', '/api/health'],
    docs: 'POST /api/chat with { messages, taskType?, stream? }',
  }),
)

// ── Provider execution ──────────────────────────────────────────────────────

const CASCADES = {
  'code-generation': ['groq', 'gemini', 'ollama'],
  classification: ['workers-ai', 'groq', 'gemini'],
  extraction: ['workers-ai', 'groq', 'gemini'],
  embedding: ['workers-ai'],
  chat: ['groq', 'workers-ai', 'gemini', 'ollama'],
  trainer: ['groq', 'gemini', 'ollama'],
  default: ['groq', 'workers-ai', 'gemini', 'ollama'],
}

function getCascadeForTask(taskType) {
  return CASCADES[taskType] || CASCADES.default
}

async function runProvider(name, messages, opts, config) {
  switch (name) {
    case 'workers-ai':
      return runWorkersAI(messages, opts, config)
    case 'groq':
      return runGroq(messages, opts, config)
    case 'gemini':
      return runGemini(messages, opts, config)
    case 'ollama':
      return runOllama(messages, opts, config)
    default:
      throw new Error(`Unknown provider: ${name}`)
  }
}

async function runWorkersAI(messages, opts, config) {
  if (!config.aiBinding) throw new Error('Workers AI not available')
  const model = opts.model || '@cf/meta/llama-3.1-8b-instruct'

  const result = await config.aiBinding.run(model, {
    messages,
    max_tokens: opts.maxTokens || 1024,
    temperature: opts.temperature ?? 0.3,
    stream: Boolean(opts.stream),
  })

  if (opts.stream) return { stream: result, provider: 'workers-ai', model }
  return { content: result.response || '', provider: 'workers-ai', model }
}

async function runGroq(messages, opts, config) {
  if (!config.groqApiKey) throw new Error('Groq not available')
  const model = opts.model || 'llama-3.3-70b-versatile'

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens || 2048,
      stream: Boolean(opts.stream),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Groq HTTP ${response.status}: ${body.slice(0, 200)}`)
  }

  if (opts.stream) return { stream: response.body, provider: 'groq', model }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    provider: 'groq',
    model,
    usage: data.usage,
  }
}

async function runGemini(messages, opts, config) {
  if (!config.geminiApiKey) throw new Error('Gemini not available')
  const model = opts.model || 'gemini-2.0-flash'

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.geminiApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens || 2048,
        stream: Boolean(opts.stream),
      }),
    },
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Gemini HTTP ${response.status}: ${body.slice(0, 200)}`)
  }

  if (opts.stream) return { stream: response.body, provider: 'gemini', model }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    provider: 'gemini',
    model,
    usage: data.usage,
  }
}

async function runOllama(messages, opts, config) {
  if (!config.ollamaBaseUrl) throw new Error('Ollama not available')
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

  if (opts.stream) return { stream: response.body, provider: 'ollama', model }

  const data = await response.json()
  return { content: data.message?.content || '', provider: 'ollama', model }
}

// ── Export ───────────────────────────────────────────────────────────────────
export default app
