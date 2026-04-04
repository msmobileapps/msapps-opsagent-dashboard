/**
 * State management — generic workflow state for any OpsAgent client.
 */

export function createState(clientId, initialData = {}) {
  return {
    clientId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    data: initialData,
  }
}

export function updateState(state, updates) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    version: (state.version || 0) + 1,
    data: { ...state.data, ...updates },
  }
}

export function getState(state, key, defaultValue = null) {
  return state?.data?.[key] ?? defaultValue
}
