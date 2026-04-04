/**
 * API client — connects to the Express backend (same pattern as SocialJet).
 * All agent/task operations go through here.
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

// ── Task / Agent API ──────────────────────────────────────────

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

export async function fetchLeadPipelineData() {
  try {
    return await jsonFetch('/api/lead-pipeline')
  } catch (err) {
    console.warn('Lead pipeline fetch failed:', err.message)
    return { success: false, leads: [], error: err.message }
  }
}

// ── Health ──────────────────────────────────────────────────────

export async function healthCheck() {
  try {
    const data = await jsonFetch('/api/health')
    return { connected: true, ...data }
  } catch {
    return { connected: false }
  }
}
