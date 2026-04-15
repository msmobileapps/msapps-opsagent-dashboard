/**
 * opsagent-core — Provider-agnostic workflow engine.
 *
 * This package contains the generic OpsAgent logic that's shared
 * across all client dashboards (SocialJet, MSApps, etc.).
 *
 * Subpath imports:
 *   import { createLeadRecord } from 'opsagent-core/state'
 *   import { buildSchedule } from 'opsagent-core/scheduling'
 *   import { loadOpsState } from 'opsagent-core/api/ops-store'
 *   import { jsonResponse } from 'opsagent-core/api/cors'
 */

// State management
export {
  normalizeOpsState,
  mergePersistedOpsState,
  createLeadRecord,
  updateLeadStatus,
  getLeadsByStage,
  getStaleLeads,
  getPipelineStats,
  createState,
  updateState,
  getState,
} from './state.js'

// Scheduling
export {
  parseCron,
  buildSchedule,
  nextRunTime,
  isScheduleActive,
  humanReadableSchedule,
  getNextRuns,
} from './scheduling.js'

// Matching
export { score as matchScore, rank as matchRank } from './matching.js'

// Discovery
export { filterByHeat, findStale, prioritize } from './discovery.js'

// Outreach
export { buildOutreachRecord, isFollowUpDue } from './outreach.js'

// AI tasks
export { buildTaskPrompt, parseTaskOutput } from './ai/tasks.js'

// AI runtime
export { RuntimeClient } from './ai/runtime-client.js'

// AI providers (task-aware cascading)
export { createCascadingProvider, TASK_TYPES } from './ai/providers.js'

// Trainer engine
export { createTrainerEngine } from './trainer/trainer-engine.js'
