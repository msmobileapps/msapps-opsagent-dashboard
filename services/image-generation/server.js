/**
 * Image generation service — Express server for Cloud Run.
 *
 * Routes:
 *   POST /generate  → Generate images
 *   GET  /health    → Health check
 *   GET  /models    → List available models
 *
 * Env vars:
 *   IMAGE_PROVIDER    - 'cf-workers-ai' | 'comfyui' | 'mock' (default: 'mock')
 *   ALLOWED_ORIGINS   - Comma-separated CORS origins
 *   PORT              - Server port (default: 8080)
 *   CF_ACCOUNT_ID     - Cloudflare account ID (for cf-workers-ai)
 *   CF_API_TOKEN      - Cloudflare API token (for cf-workers-ai)
 *   COMFYUI_BASE_URL  - ComfyUI server URL (for comfyui)
 */

import express from 'express'
import { getProvider } from './providers/index.js'

const app = express()
const PORT = process.env.PORT || 8080
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)

// ── CORS ───────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(express.json({ limit: '1mb' }))

// ── POST /generate ─────────────────────────────────────────────────────────
app.post('/generate', async (req, res) => {
  try {
    const { prompt, negativePrompt, width, height, numImages, guidanceScale, inferenceSteps, seed } = req.body

    if (!prompt) return res.status(400).json({ error: 'prompt is required' })

    const provider = getProvider()
    const startMs = Date.now()

    const images = await provider.generate({
      prompt,
      negativePrompt: negativePrompt || '',
      width: width || 1024,
      height: height || 1024,
      numImages: numImages || 1,
      guidanceScale: guidanceScale ?? 7.5,
      inferenceSteps: inferenceSteps ?? 28,
      seed, // adapter always sends a resolved seed
    })

    const elapsedMs = Date.now() - startMs

    res.json({
      images,
      meta: {
        provider: provider.name,
        elapsedMs,
        params: { width, height, numImages, guidanceScale, inferenceSteps, seed },
      },
    })
  } catch (err) {
    console.error('[generate] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /health ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const provider = getProvider()
  res.json({
    status: 'ok',
    provider: provider.name,
    models: provider.models || [],
    timestamp: new Date().toISOString(),
  })
})

// ── GET /models ────────────────────────────────────────────────────────────
app.get('/models', (req, res) => {
  const provider = getProvider()
  res.json({ models: provider.models || [] })
})

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const provider = getProvider()
  console.log(`🎨 Image service running on :${PORT} (provider: ${provider.name})`)
})

export default app
