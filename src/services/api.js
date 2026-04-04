/**
 * API client — connects to the Express/Netlify backend.
 * All state and task operations go through here. No mock data.
 */
const API_BASE = import.meta.env.VITE_API_BASE || ''

async function jsonFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  const apiKey = import.meta.env.VITE_API_KEY
  if (apiKey) headers['X-API-Key'] = apiKey

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

// ── Ops State ────────────────────────────────────────────────

export async function fetchOpsState() {
  try {
    return await jsonFetch('/api/ops-state')
  } catch (err) {
    console.warn('Ops state fetch failed:', err.message)
    return { success: false, state: null, error: err.message }
  }
}

export async function saveOpsState(state) {
  try {
    return await jsonFetch('/api/ops-state', {
      method: 'POST',
      body: JSON.stringify(state),
    })
  } catch (err) {
    console.warn('Ops state save failed:', err.message)
    return { success: false, error: err.message }
  }
}

// ── Leads ────────────────────────────────────────────────────

export async function fetchLeads() {
  try {
    return await jsonFetch('/api/leads')
  } catch (err) {
    console.warn('Leads fetch failed:', err.message)
    return { success: false, leads: [], error: err.message }
  }
}

export async function createLead(lead) {
  try {
    return await jsonFetch('/api/leads', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', lead }),
    })
  } catch (err) {
    console.warn('Lead create failed:', err.message)
    return { success: false, error: err.message }
  }
}

export async function updateLeadStage(leadId, stage, notes = '') {
  try {
    return await jsonFetch('/api/leads', {
      method: 'POST',
      body: JSON.stringify({ action: 'update-status', leadId, stage, notes }),
    })
  } catch (err) {
    console.warn('Lead update failed:', err.message)
    return { success: false, error: err.message }
  }
}

export async function deleteLead(leadId) {
  try {
    return await jsonFetch('/api/leads', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', leadId }),
    })
  } catch (err) {
    console.warn('Lead delete failed:', err.message)
    return { success: false, error: err.message }
  }
}

// ── Tasks ────────────────────────────────────────────────────

export async function fetchTasks() {
  try {
    return await jsonFetch('/api/tasks')
  } catch (err) {
    console.warn('Tasks fetch failed:', err.message)
    return { success: false, tasks: [], error: err.message }
  }
}

export async function fetchTaskDetail(taskId) {
  try {
    return await jsonFetch(`/api/tasks/${taskId}`)
  } catch (err) {
    console.warn('Task detail fetch failed:', err.message)
    return { success: false, error: err.message }
  }
}

export async function triggerTask(taskId) {
  try {
    return await jsonFetch(`/api/tasks/${taskId}/trigger`, { method: 'POST' })
  } catch (err) {
    console.warn('Task trigger failed:', err.message)
    return { success: false, error: err.message }
  }
}

export async function fetchTaskOutput(taskId) {
  try {
    return await jsonFetch(`/api/tasks/${taskId}/output`)
  } catch (err) {
    console.warn('Task output fetch failed:', err.message)
    return { success: false, error: err.message }
  }
}

// ── Health ────────────────────────────────────────────────────

export async function healthCheck() {
  try {
    const data = await jsonFetch('/api/health')
    return { connected: true, ...data }
  } catch {
    return { connected: false }
  }
}
