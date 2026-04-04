/**
 * Task output API — returns the last agent run output.
 * GET /api/tasks/:taskId/output
 *
 * In production, reads from agent logs. On Netlify, reads from persisted state.
 */
import { handleCors, jsonResponse, loadOpsState } from './_lib/store.js'

export default async (request) => {
  const cors = handleCors(request)
  if (cors) return cors

  try {
    const url = new URL(request.url)
    const parts = url.pathname.split('/')
    const taskId = parts[3]

    const state = await loadOpsState()
    const outputs = state?.taskOutputs || {}
    const output = outputs[taskId]

    if (!output) {
      return jsonResponse({
        success: true,
        taskId,
        files: null,
        message: 'No output yet. Run the task or wait for the next scheduled execution.',
      })
    }

    return jsonResponse({
      success: true,
      taskId,
      ...output,
    })
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500)
  }
}

export const config = { path: '/api/tasks/*/output' }
