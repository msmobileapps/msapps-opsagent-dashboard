/**
 * MSApps OpsAgent Dashboard — Express backend.
 *
 * Same pattern as SocialJet: serves the Vite-built frontend and
 * proxies API calls to MCP scheduled tasks + agent runner.
 *
 * In production, this connects to the MCP client to manage tasks.
 * In dev/demo mode, it returns mock data.
 */
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')

// ── Mock Data (replaced by MCP client in production) ─────────────

const MOCK_TASKS = [
  {
    taskId: 'lead-pipeline-daily',
    description: 'Daily lead pipeline briefing — scans calendar, prioritizes leads, sends report via Zoho Mail, WhatsApp reminder',
    schedule: 'At 08:04 AM, Sun-Thu',
    cronExpression: '0 8 * * 0-4',
    enabled: true,
    lastRunAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    nextRunAt: new Date(Date.now() + 18 * 3600000).toISOString(),
  },
]

const MOCK_LEADS = [
  { id: 1, name: 'TechVision AI', contact: 'Dan Cohen', industry: 'AI/ML Startup', budget: '$8-15k', status: 'Proposal sent', heat: 'hot', lastContact: '2 days ago', stage: 'proposal', source: 'LinkedIn' },
  { id: 2, name: 'CloudNine SaaS', contact: 'Sarah L.', industry: 'SaaS Platform', budget: '$5-10k', status: 'Meeting scheduled', heat: 'hot', lastContact: 'Today', stage: 'discovery', source: 'Referral' },
  { id: 3, name: 'FinEdge Solutions', contact: 'Yossi M.', industry: 'FinTech', budget: '$20k+', status: 'Technical review', heat: 'hot', lastContact: '1 day ago', stage: 'proposal', source: 'xplace' },
  { id: 4, name: 'GreenBot Agri', contact: 'Maya R.', industry: 'AgriTech', budget: '$3-5k', status: 'Initial call done', heat: 'warm', lastContact: '4 days ago', stage: 'lead', source: 'Website' },
  { id: 5, name: 'Urban Mobility Co', contact: 'Amit S.', industry: 'Transportation', budget: 'Unknown', status: 'Follow-up needed', heat: 'warm', lastContact: '6 days ago', stage: 'lead', source: 'LinkedIn' },
  { id: 6, name: 'HealthBridge', contact: 'Noa K.', industry: 'HealthTech', budget: '$10-15k', status: 'Proposal draft', heat: 'warm', lastContact: '3 days ago', stage: 'proposal', source: 'Conference' },
  { id: 7, name: 'EduSpark Ltd', contact: 'Ran B.', industry: 'EdTech', budget: '$2-4k', status: 'Exploring options', heat: 'cold', lastContact: '10 days ago', stage: 'lead', source: 'Cold outreach' },
  { id: 8, name: 'RetailBoost', contact: 'Lior H.', industry: 'E-commerce', budget: '$5k', status: 'Budget review', heat: 'cold', lastContact: '8 days ago', stage: 'lead', source: 'LinkedIn' },
]

// ── Express App ──────────────────────────────────────────────────

export function createApp() {
  const app = express()
  app.use(express.json({ limit: '2mb' }))

  // ── API Routes ──────────────────────────────────────────────

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'msapps-opsagent-dashboard',
      clientId: 'msapps',
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/api/tasks', (_req, res) => {
    // TODO: In production, call MCP client's listTasks()
    res.json({ success: true, tasks: MOCK_TASKS })
  })

  app.get('/api/tasks/:taskId', (req, res) => {
    const task = MOCK_TASKS.find(t => t.taskId === req.params.taskId)
    if (!task) return res.status(404).json({ error: 'Task not found' })
    res.json({ success: true, ...task })
  })

  app.post('/api/tasks/:taskId/trigger', (req, res) => {
    // TODO: In production, call MCP client's triggerTask()
    const task = MOCK_TASKS.find(t => t.taskId === req.params.taskId)
    if (!task) return res.status(404).json({ error: 'Task not found' })
    res.json({ success: true, triggered: true, taskId: req.params.taskId, fireAt: new Date(Date.now() + 30000).toISOString() })
  })

  app.get('/api/tasks/:taskId/output', (req, res) => {
    // TODO: In production, read from cowork session output
    res.json({
      success: true,
      sessionId: null,
      files: {
        'briefing.md': `# Lead Pipeline Briefing — ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n## Hot Actions Today\n\n- **TechVision AI** — Follow up on proposal sent 2 days ago. $8-15k opportunity.\n- **CloudNine SaaS** — Meeting today at 2pm. Prepare demo materials.\n- **FinEdge Solutions** — Technical review stage, $20k+ budget. Send case studies.\n\n## Pipeline Summary\n\n| Metric | Value |\n|--------|-------|\n| Total Leads | 8 |\n| Hot | 3 |\n| Warm | 3 |\n| Cold/Stale | 2 |\n| At Risk (7+ days) | 2 |\n\n## Risks & Flags\n\n- Urban Mobility Co: No contact in 6 days — risk of going cold\n- EduSpark Ltd: 10 days without contact — mark as stale or close\n\n## Recommendation\n\nFocus today on closing the CloudNine SaaS meeting and following up with TechVision AI. FinEdge at $20k+ is the highest-value opportunity.`,
      },
    })
  })

  app.get('/api/lead-pipeline', (_req, res) => {
    // TODO: In production, fetch from Google Calendar + last agent output
    res.json({ success: true, leads: MOCK_LEADS })
  })

  // ── Static files (Vite build) ───────────────────────────────

  app.use(express.static(distDir))

  // SPA fallback
  app.use((_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })

  return app
}

// ── Start server ────────────────────────────────────────────────

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectRun) {
  const port = process.env.PORT || 4243
  const app = createApp()
  app.listen(port, () => {
    console.log(`MSApps OpsAgent Dashboard listening on http://localhost:${port}`)
  })
}
