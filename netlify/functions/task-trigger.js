/**
 * Task trigger API — triggers an agent run.
 * POST /api/tasks/:taskId/trigger
 */
import { handleCors, jsonResponse } from './_lib/store.js'

export default async (request) => {
  const cors = handleCors(request)
  if (cors) return cors

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const url = new URL(request.url)
    const parts = url.pathname.split('/')
    // /api/tasks/<taskId>/trigger
    const taskId = parts[3]

    if (!taskId) {
      return jsonResponse({ error: 'Missing taskId' }, 400)
    }

    // In production, this calls the OpsAgent runner via the VM tunnel.
    // For now, record the trigger request.
    const triggeredAt = new Date().toISOString()

    return jsonResponse({
      success: true,
      triggered: true,
      taskId,
      triggeredAt,
      message: `Task ${taskId} trigger recorded. Connect to OpsAgent backend to execute.`,
    })
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500)
  }
}

export const config = { path: '/api/tasks/*/trigger' }
