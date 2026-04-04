/**
 * Express ↔ Netlify function adapter — allows Netlify function code to run on Express.
 * Provides utilities to convert between request/response formats and create unified Express apps.
 */

/**
 * Convert Express request to Web Request format.
 */
export function toWebRequest(expressReq) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(expressReq.headers)) {
    if (Array.isArray(value)) {
      value.forEach(v => headers.append(key, v))
    } else {
      headers.set(key, value)
    }
  }

  let body = null
  if (['POST', 'PUT', 'PATCH'].includes(expressReq.method?.toUpperCase?.() || expressReq.method)) {
    body = typeof expressReq.body === 'string' ? expressReq.body : JSON.stringify(expressReq.body || {})
  }

  return {
    method: expressReq.method,
    url: `${expressReq.protocol || 'http'}://${expressReq.get?.('host') || 'localhost'}${expressReq.originalUrl || expressReq.url}`,
    headers,
    body,
  }
}

/**
 * Send Web Response via Express.
 */
export async function sendWebResponse(webResponse, expressRes) {
  const status = webResponse.status || 200
  const headers = {}

  if (webResponse.headers) {
    for (const [key, value] of webResponse.headers.entries()) {
      headers[key] = value
    }
  }

  const body = webResponse.body ? await webResponse.text() : ''

  expressRes.status(status).set(headers)
  if (body) {
    try {
      expressRes.json(JSON.parse(body))
    } catch {
      expressRes.send(body)
    }
  } else {
    expressRes.end()
  }
}

/**
 * Route a request to a Netlify function module.
 */
export async function routeHandler(modulePath, req, res) {
  try {
    const module = await import(modulePath)
    const handler = module.default || module.handler || module.post || module.get

    if (!handler) {
      return res.status(500).json({ error: 'No handler found in module' })
    }

    const webReq = toWebRequest(req)
    const webRes = await handler(webReq)

    await sendWebResponse(webRes, res)
  } catch (err) {
    console.error('Route handler error:', err)
    res.status(500).json({ error: err.message })
  }
}

/**
 * Create Express app from route map and static files.
 * @param {Object} functionRoutes - Map of path -> module path
 * @param {Object} options - { distDir, healthMeta, enableHourlyOps }
 */
/**
 * Create Express app from route map and static files.
 * @param {Object} functionRoutes - Map of path -> module path
 * @param {Object} options - { distDir, healthMeta }
 * @param {Function} expressModule - The express module (pass `import('express')` result)
 */
export async function createApp(functionRoutes = {}, options = {}, expressModule = null) {
  if (!expressModule) {
    expressModule = (await import('express')).default
  }
  const path = await import('node:path')
  const app = expressModule()

  const { distDir = null, healthMeta = {} } = options

  app.use(expressModule.json({ limit: '2mb' }))

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString(), ...healthMeta })
  })

  // Function routes
  for (const [route, modulePath] of Object.entries(functionRoutes)) {
    app.all(route, (req, res) => routeHandler(modulePath, req, res))
  }

  // API 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found' })
  })

  // Static files + SPA fallback
  if (distDir) {
    const fullPath = path.resolve(distDir)
    app.use(expressModule.static(fullPath))
    app.use((_req, res) => {
      res.sendFile(path.join(fullPath, 'index.html'))
    })
  }

  return app
}
