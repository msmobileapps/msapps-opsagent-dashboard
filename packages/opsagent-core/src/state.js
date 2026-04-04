/**
 * State management — generic lead/pipeline state for any OpsAgent client.
 * Handles normalization, merging, lead records, and pipeline analytics.
 */

const PIPELINE_STAGES = ['new', 'contacted', 'discovery', 'proposal', 'negotiation', 'won', 'lost']

/**
 * Normalize ops state to ensure all required fields exist.
 */
export function normalizeOpsState(raw = {}) {
  return {
    version: raw.version ?? 1,
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    leads: Array.isArray(raw.leads) ? raw.leads.map(normalizeLead) : [],
    clients: raw.clients ?? [],
  }
}

/**
 * Normalize a single lead record.
 */
function normalizeLead(lead) {
  return {
    id: lead.id ?? generateId(),
    name: lead.name ?? 'Unknown',
    company: lead.company ?? '',
    stage: PIPELINE_STAGES.includes(lead.stage) ? lead.stage : 'new',
    source: lead.source ?? 'unknown',
    contactEmail: lead.contactEmail ?? '',
    phone: lead.phone ?? '',
    notes: lead.notes ?? '',
    dealValue: lead.dealValue ?? 0,
    createdAt: lead.createdAt ?? new Date().toISOString(),
    updatedAt: lead.updatedAt ?? new Date().toISOString(),
    lastContactAt: lead.lastContactAt ?? null,
    nextActionDate: lead.nextActionDate ?? null,
    nextAction: lead.nextAction ?? '',
    history: Array.isArray(lead.history) ? lead.history : [],
  }
}

/**
 * Deep merge persisted state with incoming updates.
 */
export function mergePersistedOpsState(current, incoming) {
  const normalized = normalizeOpsState(incoming)
  const merged = {
    ...current,
    ...normalized,
  }

  // Merge leads by ID
  const leadMap = new Map()
  if (Array.isArray(current.leads)) {
    for (const lead of current.leads) {
      leadMap.set(lead.id, lead)
    }
  }
  if (Array.isArray(normalized.leads)) {
    for (const lead of normalized.leads) {
      const existing = leadMap.get(lead.id)
      if (existing) {
        leadMap.set(lead.id, { ...existing, ...lead })
      } else {
        leadMap.set(lead.id, lead)
      }
    }
  }

  merged.leads = Array.from(leadMap.values())
  merged.updatedAt = new Date().toISOString()
  return merged
}

/**
 * Create a normalized lead record with defaults.
 */
export function createLeadRecord({
  name = '',
  company = '',
  stage = 'new',
  source = 'unknown',
  contactEmail = '',
  phone = '',
  notes = '',
  dealValue = 0,
}) {
  if (!PIPELINE_STAGES.includes(stage)) stage = 'new'

  return {
    id: generateId(),
    name,
    company,
    stage,
    source,
    contactEmail,
    phone,
    notes,
    dealValue: Number(dealValue) || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastContactAt: null,
    nextActionDate: null,
    nextAction: '',
    history: [
      {
        stage,
        changedAt: new Date().toISOString(),
        notes: 'Created',
      },
    ],
  }
}

/**
 * Update a lead's stage and add history entry.
 */
export function updateLeadStatus(lead, newStage, notes = '') {
  if (!PIPELINE_STAGES.includes(newStage)) {
    throw new Error(`Invalid stage: ${newStage}. Must be one of: ${PIPELINE_STAGES.join(', ')}`)
  }

  const entry = {
    stage: newStage,
    changedAt: new Date().toISOString(),
    notes,
  }

  return {
    ...lead,
    stage: newStage,
    updatedAt: new Date().toISOString(),
    lastContactAt: new Date().toISOString(),
    history: [...(lead.history || []), entry],
  }
}

/**
 * Group leads by pipeline stage.
 */
export function getLeadsByStage(leads) {
  const grouped = {}
  for (const stage of PIPELINE_STAGES) {
    grouped[stage] = []
  }

  for (const lead of leads) {
    const stage = lead.stage || 'new'
    if (grouped[stage]) {
      grouped[stage].push(lead)
    }
  }

  return grouped
}

/**
 * Find leads with no contact for N days.
 */
export function getStaleLeads(leads, daysThreshold = 7) {
  const threshold = Date.now() - daysThreshold * 24 * 3600 * 1000
  return leads.filter(lead => {
    if (!lead.lastContactAt) return true
    return new Date(lead.lastContactAt).getTime() < threshold
  })
}

/**
 * Calculate pipeline statistics.
 */
export function getPipelineStats(leads) {
  const byStage = getLeadsByStage(leads)
  const staleLeads = getStaleLeads(leads, 7)

  return {
    total: leads.length,
    byStage: Object.fromEntries(Object.entries(byStage).map(([stage, items]) => [stage, items.length])),
    atRisk: staleLeads.length,
    hotCount: leads.filter(l => l.stage === 'proposal' || l.stage === 'negotiation').length,
    totalValue: leads.reduce((sum, lead) => sum + (lead.dealValue || 0), 0),
  }
}

// Legacy API compatibility
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

// Helper
function generateId() {
  return `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
