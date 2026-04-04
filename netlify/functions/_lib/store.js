/**
 * MSApps state persistence — wraps opsagent-core ops-store with local config.
 * Each client dashboard has its own store.js that configures the persistence path.
 */
import { loadOpsState as coreLoad, saveOpsState as coreSave } from 'opsagent-core/api/ops-store'
import { handleCors, jsonResponse } from 'opsagent-core/api/cors'

export { handleCors, jsonResponse }

export async function loadOpsState() {
  return coreLoad()
}

export async function saveOpsState(state) {
  return coreSave(state)
}
