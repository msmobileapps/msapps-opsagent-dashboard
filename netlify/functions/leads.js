/**
 * Lead CRUD API — manages individual leads within the pipeline.
 * GET returns all leads from state, POST creates/updates a lead.
 */
import { normalizeOpsState, createLeadRecord, updateLeadStatus } from 'opsagent-core/state'
import { handleCors, jsonResponse, loadOpsState, saveOpsState } from './_lib/store.js'

export default async (request) => {
  const cors = handleCors(request)
  if (cors) return cors

  try {
    const state = normalizeOpsState(await loadOpsState())

    if (request.method === 'GET' || request.method === 'HEAD') {
      return jsonResponse({ success: true, leads: state.leads })
    }

    if (request.method === 'POST') {
      const body = await request.json()
      const { action } = body

      if (action === 'create') {
        const lead = createLeadRecord(body.lead || body)
        state.leads.push(lead)
        await saveOpsState(state)
        return jsonResponse({ success: true, lead, total: state.leads.length })
      }

      if (action === 'update-status') {
        const { leadId, stage, notes } = body
        const idx = state.leads.findIndex(l => l.id === leadId)
        if (idx === -1) return jsonResponse({ error: 'Lead not found' }, 404)
        state.leads[idx] = updateLeadStatus(state.leads[idx], stage, notes)
        await saveOpsState(state)
        return jsonResponse({ success: true, lead: state.leads[idx] })
      }

      if (action === 'delete') {
        const { leadId } = body
        state.leads = state.leads.filter(l => l.id !== leadId)
        await saveOpsState(state)
        return jsonResponse({ success: true, total: state.leads.length })
      }

      return jsonResponse({ error: 'Unknown action. Use: create, update-status, delete' }, 400)
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500)
  }
}

export const config = { path: '/api/leads' }
