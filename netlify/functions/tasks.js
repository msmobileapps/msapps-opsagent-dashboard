/**
 * Tasks API — returns configured agent tasks for this client.
 * Tasks are derived from the client's identity config, not mock data.
 */
import { handleCors, jsonResponse } from './_lib/store.js'

// Client-specific task definitions (each dashboard defines its own)
const TASKS = [
  {
    taskId: 'lead-pipeline-daily',
    name: 'Lead Pipeline Daily',
    description: 'Daily lead pipeline briefing — scans calendar, prioritizes leads, flags follow-ups, delivers actionable report.',
    schedule: 'Sun-Thu 8:00 AM',
    cronExpression: '0 8 * * 0-4',
    enabled: true,
    agentTemplate: 'lead-pipeline',
    steps: [
      { step: '01', title: 'Scan Calendar', body: 'Reads Google Calendar events for lead status, meetings, and follow-up dates.' },
      { step: '02', title: 'Prioritize', body: 'Ranks leads by urgency, deal size, and days since last contact.' },
      { step: '03', title: 'Flag Actions', body: 'Generates specific next steps for hot leads and stale opportunities.' },
      { step: '04', title: 'Email Report', body: 'Sends morning briefing to michal@msapps.mobi via Zoho Mail.' },
      { step: '05', title: 'WhatsApp Ping', body: 'Sends a quick summary reminder via WhatsApp.' },
    ],
  },
]

export default async (request) => {
  const cors = handleCors(request)
  if (cors) return cors

  try {
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/$/, '')

    // GET /api/tasks — list all tasks
    if (path === '/api/tasks') {
      return jsonResponse({ success: true, tasks: TASKS })
    }

    // GET /api/tasks/:taskId — single task detail
    const taskId = path.replace('/api/tasks/', '')

    // GET /api/tasks/:taskId — single task detail
    const task = TASKS.find(t => t.taskId === taskId)
    if (!task) return jsonResponse({ error: 'Task not found' }, 404)
    return jsonResponse({ success: true, ...task })
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500)
  }
}

export const config = { path: ['/api/tasks', '/api/tasks/:taskId'] }
