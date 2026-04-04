/**
 * AI runtime client — interface to call OpsAgent's runner.
 * In production, this connects to the Express API which
 * proxies to the MCP client → Claude Agent SDK.
 */

export class RuntimeClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.apiKey = options.apiKey || null
    this.timeout = options.timeout || 30000
  }

  async _fetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers['X-API-Key'] = this.apiKey

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  async listTasks() {
    return this._fetch('/api/tasks')
  }

  async triggerTask(taskId) {
    return this._fetch(`/api/tasks/${taskId}/trigger`, { method: 'POST' })
  }

  async getTaskOutput(taskId) {
    return this._fetch(`/api/tasks/${taskId}/output`)
  }

  async healthCheck() {
    try {
      const data = await this._fetch('/api/health')
      return { connected: true, ...data }
    } catch {
      return { connected: false }
    }
  }
}
