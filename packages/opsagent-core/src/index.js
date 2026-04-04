/**
 * opsagent-core — Provider-agnostic workflow engine.
 *
 * This package contains the generic OpsAgent logic that's shared
 * across all client dashboards (SocialJet, MSApps, etc.).
 *
 * Subpath imports:
 *   import { match } from 'opsagent-core/matching'
 *   import { buildSchedule } from 'opsagent-core/scheduling'
 */

export { score as matchScore, rank as matchRank } from './matching.js'
export { buildSchedule, parseCron, nextRunTime } from './scheduling.js'
export { createState, updateState, getState } from './state.js'
