/**
 * Netlify Function — POST /api/generate-image
 *
 * Validates input via opsagent-core, proxies to the image service.
 * Falls back to mock mode when IMAGE_SERVICE_URL is not set.
 */

import { validateInput, applyDefaults } from '../../packages/opsagent-core/src/image-generation/contracts.js'
import { buildGenerationPayload } from '../../packages/opsagent-core/src/image-generation/prompt-builder.js'

export default async function handler(req, context) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req),
    })
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders(req) })
  }

  try {
    const body = await req.json()

    // Validate
    const validation = validateInput(body)
    if (!validation.valid) {
      return Response.json({ error: 'Validation failed', details: validation.errors }, {
        status: 400,
        headers: corsHeaders(req),
      })
    }

    // Apply defaults and build payload via shared builder
    const resolved = applyDefaults(body)
    const payload = buildGenerationPayload(resolved)

    const serviceUrl = process.env.IMAGE_SERVICE_URL
    if (!serviceUrl) {
      // Mock mode — return placeholder images
      const images = Array.from({ length: payload.numImages }, (_, i) => ({
        url: `https://placehold.co/${payload.width}x${payload.height}/1a1a2e/6c3aed?text=${encodeURIComponent(resolved.prompt.slice(0, 30))}`,
        seed: payload.seed + i,
      }))
      return Response.json({
        images,
        meta: { provider: 'mock', elapsedMs: 0, params: payload },
      }, { headers: corsHeaders(req) })
    }

    // Proxy to image service
    const res = await fetch(`${serviceUrl.replace(/\/+$/, '')}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    return Response.json(data, { status: res.status, headers: corsHeaders(req) })
  } catch (err) {
    console.error('[generate-image] Error:', err)
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders(req) })
  }
}

function corsHeaders(req) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export const config = {
  path: '/api/generate-image',
}
