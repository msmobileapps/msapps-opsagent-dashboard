/**
 * opsagent-core/trainer — Generic trainer engine for AI-powered code modification.
 *
 * Subpath imports:
 *   import { createTrainerEngine } from 'opsagent-core/trainer'
 *   import { streamChat } from 'opsagent-core/trainer/streaming-client'
 *   import { createIlcfConfig } from 'opsagent-core/trainer/config-ilcf'
 */

// Engine (primary export)
export { createTrainerEngine } from './trainer-engine.js'

// Prompt building
export {
  estimateTokens,
  chooseNumCtx,
  selectRelevantSections,
  buildTrainerPrompt,
} from './prompt-builder.js'

// Streaming
export { streamChat, streamChatToString } from './streaming-client.js'

// Response parsing
export { extractJson, parseModifications } from './response-parser.js'

// GitHub committing
export { applyModifications, commitModifications } from './github-committer.js'

// Fuzzy matching
export {
  fuzzyMatch,
  findClosestMatch,
  normalizeWhitespace,
  validateModifications,
} from './fuzzy-match.js'
