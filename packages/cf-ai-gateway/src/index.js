/**
 * OpsAgent AI Gateway — Cloudflare Worker (Hono)
 *
 * Single edge gateway for all AI requests. Handles:
 *   - CORS for *.netlify.app origins
 *   - Bearer auth
 *   - Task-aware routing — ZERO token cost
 *   - CF Workers AI (primary — free edge inference)
 *   - Cloud Run Ollama (fallback — self-hosted Gemma)
 *   - Streaming SSE responses
 *
 * NO paid/metered providers. No Groq, no Gemini, no OpenAI, no Anthropic.
 *
 * Endpoints:
 *   POST /api/chat     — General chat completion (streaming or JSON)
 *   POST /api/trainer   — Trainer-specific: code modification generation
 *   GET  /api/health    — Provider availability status
 *   GET  /api/test      — Diagnostic: live binding + timing check (no auth required)
 *   GET  /              — Gateway info
 *
 * Fix log:
 *   v0.2.0 — Added Promise.race timeout on Workers AI (12s), Cloud Run auth header,
 *             /api/test diagnostic endpoint. Fixes 15s hang + silent fallback failures.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// ── Constants ────────────────────────────────────────────────────────────────

// Workers AI: 12s timeout — fast enough to cascade to Ollama before client gives up
const WORKERS_AI_TIMEOUT_MS = 12_000
// Cloud Run Ollama: 25s — CPU inference is slower, give it more room
const OLLAMA_TIMEOUT_MS = 25_000

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
    ollamaBaseUrl: (env.CLOUD_RUN_ENDPOINT || '').replace(/\/+$/, ''),
    // Default to gemma3:12b — the only model pre-loaded in the Cloud Run `gemma3-12b-warm` image.
    // Using gemma3:4b as the default forces Ollama to pull-on-first-request → 3+ min cold start.
    ollamaModel: env.CLOUD_RUN_MODEL || 'gemma3:12b',
    // FIX: pass Cloud Run token so the fallback can authenticate
    cloudRunToken: env.CLOUD_RUN_TOKEN || '',
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

  // Trainer tasks use trainer cascade: Workers AI → Ollama
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
    ollama: Boolean(config.ollamaBaseUrl),
  }

  return c.json({
    status: 'ok',
    gateway: 'opsagent-ai-gateway',
    version: '0.2.0',
    providers,
    cloudRunTokenSet: Boolean(config.cloudRunToken),
    workersAiTimeoutMs: WORKERS_AI_TIMEOUT_MS,
    ollamaTimeoutMs: OLLAMA_TIMEOUT_MS,
    timestamp: new Date().toISOString(),
  })
})

// ── GET /api/test ─────────────────────────────────────────────────────────
// Diagnostic endpoint — no auth required. Runs a tiny Workers AI inference
// and reports binding status, timing, and any errors. Safe to call publicly.

app.get('/api/test', async (c) => {
  const config = getProviderConfig(c.env)
  const report = {
    gateway: 'opsagent-ai-gateway',
    version: '0.2.0',
    timestamp: new Date().toISOString(),
    binding: {
      workersAi: Boolean(config.aiBinding),
      cloudRunEndpoint: config.ollamaBaseUrl || '(not set)',
      cloudRunToken: config.cloudRunToken ? '✅ set' : '❌ not set',
    },
    inference: null,
    error: null,
  }

  if (!config.aiBinding) {
    report.error = 'env.AI binding is undefined — [ai] binding missing or Worker not redeployed'
    return c.json(report, 503)
  }

  const t0 = Date.now()
  try {
    const model = '@cf/meta/llama-3.2-1b-instruct' // Smallest available — fastest for diagnostics
    const result = await Promise.race([
      config.aiBinding.run(model, {
        messages: [{ role: 'user', content: 'Reply with just the word "ok".' }],
        max_tokens: 10,
        stream: false,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out after ${WORKERS_AI_TIMEOUT_MS}ms`)), WORKERS_AI_TIMEOUT_MS),
      ),
    ])
    report.inference = {
      status: 'ok',
      model,
      response: result?.response || '(empty)',
      latencyMs: Date.now() - t0,
    }
  } catch (err) {
    report.inference = {
      status: 'error',
      latencyMs: Date.now() - t0,
    }
    report.error = err.message
  }

  return c.json(report, report.error ? 503 : 200)
})

// ── GET / ───────────────────────────────────────────────────────────────────

app.get('/', (c) =>
  c.json({
    name: 'OpsAgent AI Gateway',
    version: '0.2.0',
    endpoints: ['/api/chat', '/api/trainer', '/api/health', '/api/test'],
    docs: 'POST /api/chat with { messages, taskType?, stream? }',
  }),
)

// ── Provider execution ──────────────────────────────────────────────────────

const CASCADES = {
  'code-generation': ['workers-ai', 'ollama'],
  classification: ['workers-ai'],
  extraction: ['workers-ai'],
  embedding: ['workers-ai'],
  chat: ['workers-ai', 'ollama'],
  trainer: ['workers-ai', 'ollama'],
  default: ['workers-ai', 'ollama'],
}

function getCascadeForTask(taskType) {
  return CASCADES[taskType] || CASCADES.default
}

async function runProvider(name, messages, opts, config) {
  switch (name) {
    case 'workers-ai':
      return runWorkersAI(messages, opts, config)
    case 'ollama':
      return runOllama(messages, opts, config)
    default:
      throw new Error(`Unknown provider: ${name}`)
  }
}

async function runWorkersAI(messages, opts, config) {
  if (!config.aiBinding) throw new Error('Workers AI not available')
  const model = opts.model || '@cf/meta/llama-3.1-8b-instruct'

  // FIX: Race against a hard timeout so we cascade to Ollama before the client gives up.
  // aiBinding.run() doesn't accept AbortSignal directly, so we use Promise.race.
  const result = await Promise.race([
    config.aiBinding.run(model, {
      messages,
      max_tokens: opts.maxTokens || 1024,
      temperature: opts.temperature ?? 0.3,
      stream: Boolean(opts.stream),
    }),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Workers AI timed out after ${WORKERS_AI_TIMEOUT_MS}ms — cascading to Ollama`)),
        WORKERS_AI_TIMEOUT_MS,
      ),
    ),
  ])

  if (opts.stream) return { stream: result, provider: 'workers-ai', model }
  return { content: result.response || '', provider: 'workers-ai', model }
}

async function runOllama(messages, opts, config) {
  if (!config.ollamaBaseUrl) throw new Error('Ollama not available')
  const model = opts.model || config.ollamaModel || 'gemma3:12b'
  const baseUrl = config.ollamaBaseUrl.replace(/\/+$/, '')

  // FIX: include Authorization header so Cloud Run (which requires auth by default) accepts the call
  const headers = { 'Content-Type': 'application/json' }
  if (config.cloudRunToken) {
    headers['Authorization'] = `Bearer ${config.cloudRunToken}`
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers,
    // FIX: hard timeout on Ollama too — CPU inference can stall indefinitely
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
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
