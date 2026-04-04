/**
 * Ops state API — GET to read pipeline state, POST to update it.
 * Generic pattern: any client dashboard uses the same endpoint shape.
 */
import { normalizeOpsState, mergePersistedOpsState } from 'opsagent-core/state'
import { handleCors, jsonResponse, loadOpsState, saveOpsState } from './_lib/store.js'

export default async (request) => {
  const cors = handleCors(request)
  if (cors) return cors

  try {
    if (request.method === 'GET' || request.method === 'HEAD') {
      const state = normalizeOpsState(await loadOpsState())
      return jsonResponse({ success: true, state })
    }

    if (request.method === 'POST') {
      const body = await request.json()
      const current = normalizeOpsState(await loadOpsState())
      const merged = mergePersistedOpsState(current, body)
      await saveOpsState(merged)
      return jsonResponse({ success: true, state: merged })
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500)
  }
}

export const config = { path: '/api/ops-state' }
