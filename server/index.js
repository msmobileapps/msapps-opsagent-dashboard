/**
 * MSApps OpsAgent Dashboard — Express backend.
 *
 * Same pattern as SocialJet: wraps Netlify function handlers so the same
 * code runs locally (Express) and deployed (Netlify Functions).
 */
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { toWebRequest, sendWebResponse, routeHandler } from 'opsagent-core/api/route-adapter'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')

// Map API routes to Netlify function modules
const functionRoutes = {
  '/api/health':            '../netlify/functions/health.js',
  '/api/ops-state':         '../netlify/functions/ops-state.js',
  '/api/leads':             '../netlify/functions/leads.js',
  '/api/tasks':             '../netlify/functions/tasks.js',
  '/api/tasks/*':           '../netlify/functions/tasks.js',
}

// Task-specific routes (need separate handlers for trigger/output)
const taskSubRoutes = {
  trigger: '../netlify/functions/task-trigger.js',
  output:  '../netlify/functions/task-output.js',
}

export function createApp() {
  const app = express()
  app.use(express.json({ limit: '2mb' }))

  // Health
  app.get('/api/health', (req, res) =>
    routeHandler(new URL('../netlify/functions/health.js', import.meta.url).href, req, res))

  // Ops state
  app.all('/api/ops-state', (req, res) =>
    routeHandler(new URL('../netlify/functions/ops-state.js', import.meta.url).href, req, res))

  // Leads
  app.all('/api/leads', (req, res) =>
    routeHandler(new URL('../netlify/functions/leads.js', import.meta.url).href, req, res))

  // Task trigger — must come before generic tasks route
  app.post('/api/tasks/:taskId/trigger', (req, res) =>
    routeHandler(new URL('../netlify/functions/task-trigger.js', import.meta.url).href, req, res))

  // Task output
  app.get('/api/tasks/:taskId/output', (req, res) =>
    routeHandler(new URL('../netlify/functions/task-output.js', import.meta.url).href, req, res))

  // Tasks (list + detail)
  app.get('/api/tasks/:taskId?', (req, res) =>
    routeHandler(new URL('../netlify/functions/tasks.js', import.meta.url).href, req, res))

  // API 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found' })
  })

  // Static files (Vite build)
  app.use(express.static(distDir))

  // SPA fallback
  app.use((_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })

  return app
}

// Start server when run directly
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectRun) {
  const port = process.env.PORT || 4243
  const app = createApp()
  app.listen(port, () => {
    console.log(`MSApps OpsAgent Dashboard listening on http://localhost:${port}`)
  })
}
