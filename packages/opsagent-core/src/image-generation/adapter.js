/**
 * ImageGenerationAdapter — provider-agnostic HTTP client for image services.
 *
 * Talks to any backend that exposes:
 *   POST /generate   → { images: [{ url, base64, seed }], meta }
 *   GET  /health     → { status, provider, models }
 *   GET  /models     → { models: [...] }
 *
 * @module opsagent-core/image-generation/adapter
 */

export class ImageGenerationAdapter {
  /**
   * @param {object} opts
   * @param {string} opts.baseUrl - Image service URL (no trailing slash)
   * @param {string} [opts.apiKey] - Optional auth token
   * @param {number} [opts.timeout=120000] - Request timeout in ms
   * @param {object} [opts.defaultOverrides] - Default overrides merged into every request
   */
  constructor({ baseUrl, apiKey, timeout = 120_000, defaultOverrides = {} } = {}) {
    if (!baseUrl) throw new Error('ImageGenerationAdapter requires a baseUrl')
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.apiKey = apiKey
    this.timeout = timeout
    this.defaultOverrides = defaultOverrides
  }

  /** @private */
  _headers() {
    const h = { 'Content-Type': 'application/json' }
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`
    return h
  }

  /**
   * Generate images from a fully built payload.
   *
   * @param {object} payload - Output of buildGenerationPayload()
   * @returns {Promise<{ images: Array<{url?, base64?, seed}>, meta: object }>}
   */
  async generateImage(payload) {
    const body = { ...this.defaultOverrides, ...payload }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const res = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Image service ${res.status}: ${text.slice(0, 300)}`)
      }

      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Health check the image service.
   * @returns {Promise<{ status: string, provider?: string, models?: string[] }>}
   */
  async healthCheck() {
    const res = await fetch(`${this.baseUrl}/health`, { headers: this._headers() })
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
    return res.json()
  }

  /**
   * List available models.
   * @returns {Promise<{ models: string[] }>}
   */
  async listModels() {
    const res = await fetch(`${this.baseUrl}/models`, { headers: this._headers() })
    if (!res.ok) throw new Error(`List models failed: ${res.status}`)
    return res.json()
  }
}
