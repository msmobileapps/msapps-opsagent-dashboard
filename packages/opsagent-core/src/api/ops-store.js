/**
 * State persistence layer — dual-mode support for GCS (production) or local JSON (dev).
 * Loads and saves OpsAgent state with automatic environment detection.
 */

const STATE_FILE = '.opsagent-state.json'
const CLIENTS_FILE = '.opsagent-clients.json'

/**
 * Load ops state from GCS bucket or local file.
 * Falls back to local file if GCS is unavailable.
 */
export async function loadOpsState() {
  const bucket = process.env.OPSAGENT_STATE_BUCKET
  if (bucket) {
    try {
      return await loadFromGCS(bucket, 'state.json')
    } catch (err) {
      console.warn('GCS load failed, falling back to local file:', err.message)
    }
  }

  // Fallback to local file
  try {
    return await loadFromFile(STATE_FILE)
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), leads: [], clients: [] }
  }
}

/**
 * Save ops state to GCS bucket or local file.
 */
export async function saveOpsState(state) {
  const bucket = process.env.OPSAGENT_STATE_BUCKET
  if (bucket) {
    try {
      await saveToGCS(bucket, 'state.json', {
        ...state,
        updatedAt: new Date().toISOString(),
      })
      return
    } catch (err) {
      console.warn('GCS save failed, falling back to local file:', err.message)
    }
  }

  // Fallback to local file
  await saveToFile(STATE_FILE, {
    ...state,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Load clients table from GCS or local file.
 */
export async function loadClientsTable() {
  const bucket = process.env.OPSAGENT_STATE_BUCKET
  if (bucket) {
    try {
      return await loadFromGCS(bucket, 'clients.json')
    } catch (err) {
      console.warn('GCS load failed, falling back to local file:', err.message)
    }
  }

  try {
    return await loadFromFile(CLIENTS_FILE)
  } catch {
    return []
  }
}

/**
 * Save clients table to GCS or local file.
 */
export async function saveClientsTable(clients) {
  const bucket = process.env.OPSAGENT_STATE_BUCKET
  if (bucket) {
    try {
      await saveToGCS(bucket, 'clients.json', clients)
      return
    } catch (err) {
      console.warn('GCS save failed, falling back to local file:', err.message)
    }
  }

  await saveToFile(CLIENTS_FILE, clients)
}

// ============ GCS Helpers (dynamic import) ============

async function loadFromGCS(bucket, filename) {
  let storage
  try {
    const gcmod = await import('@google-cloud/storage')
    const { Storage } = gcmod
    storage = new Storage()
  } catch {
    throw new Error('GCS not available; set OPSAGENT_STATE_BUCKET to use GCS')
  }

  const file = storage.bucket(bucket).file(filename)
  const [contents] = await file.download()
  return JSON.parse(contents.toString('utf-8'))
}

async function saveToGCS(bucket, filename, data) {
  let storage
  try {
    const gcmod = await import('@google-cloud/storage')
    const { Storage } = gcmod
    storage = new Storage()
  } catch {
    throw new Error('GCS not available; set OPSAGENT_STATE_BUCKET to use GCS')
  }

  const file = storage.bucket(bucket).file(filename)
  await file.save(JSON.stringify(data, null, 2))
}

// ============ File Helpers (node:fs/promises) ============

async function loadFromFile(filepath) {
  const fs = await import('node:fs/promises')
  const contents = await fs.readFile(filepath, 'utf-8')
  return JSON.parse(contents)
}

async function saveToFile(filepath, data) {
  const fs = await import('node:fs/promises')
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8')
}
