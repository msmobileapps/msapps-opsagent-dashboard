/**
 * MSApps state persistence — uses Netlify Blobs for serverless storage.
 * Falls back to local file for local dev (via Express server).
 */
import { handleCors, jsonResponse } from 'opsagent-core/api/cors'
import { getStore } from '@netlify/blobs'

export { handleCors, jsonResponse }

const STORE_NAME = 'opsagent-state'
const STATE_KEY = 'ops-state'

function isNetlify() {
  return !!(globalThis.Netlify || process.env.NETLIFY || process.env.NETLIFY_DEV)
}

export async function loadOpsState() {
  if (isNetlify()) {
    try {
      const store = getStore({ name: STORE_NAME, consistency: 'strong' })
      const data = await store.get(STATE_KEY, { type: 'json' })
      return data || { version: 1, updatedAt: new Date().toISOString(), leads: [], clients: [] }
    } catch (err) {
      console.warn('Netlify Blobs load failed:', err.message)
      return { version: 1, updatedAt: new Date().toISOString(), leads: [], clients: [] }
    }
  }

  // Local dev fallback
  try {
    const { loadOpsState: coreLoad } = await import('opsagent-core/api/ops-store')
    return await coreLoad()
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), leads: [], clients: [] }
  }
}

export async function saveOpsState(state) {
  const payload = { ...state, updatedAt: new Date().toISOString() }

  if (isNetlify()) {
    try {
      const store = getStore({ name: STORE_NAME, consistency: 'strong' })
      await store.setJSON(STATE_KEY, payload)
      return payload
    } catch (err) {
      console.warn('Netlify Blobs save failed:', err.message)
      throw err
    }
  }

  // Local dev fallback
  const { saveOpsState: coreSave } = await import('opsagent-core/api/ops-store')
  await coreSave(payload)
  return payload
}
