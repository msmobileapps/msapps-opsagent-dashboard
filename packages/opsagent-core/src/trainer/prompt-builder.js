/**
 * prompt-builder.js — Smart section selection & AI prompt construction.
 *
 * Given a user instruction and a set of named code sections, selects only
 * the relevant sections to minimize token usage. Builds the full prompt
 * for the AI to generate code modifications.
 *
 * Token-optimized: single-section edits go from ~7400 tokens to ~1500-3000.
 * Fully generic — app-specific keywords come from the config object.
 *
 * @example
 *   import { buildTrainerPrompt, estimateTokens, chooseNumCtx } from 'opsagent-core/trainer'
 *
 *   const config = {
 *     appName: 'ILCF MedInfo',
 *     appDescription: 'Hebrew medical info chatbot for lung cancer patients',
 *     sectionKeywords: { ... },
 *     backendKeywords: ['chat.js', 'function', 'serverless'],
 *     coupledSections: { cr: ['matchResponse', 'aliases'] },
 *     conditionalIncludes: [{ trigger: 'buildPrompt', keywords: ['tone', ...], include: 'emotionalTokens' }],
 *   }
 */

/**
 * Estimate token count for mixed Hebrew/English/code text.
 * ~3.5 characters per token is a reasonable average.
 *
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 3.5)
}

/**
 * Choose optimal num_ctx based on estimated prompt size.
 * Leaves at least 1024 tokens for generation.
 *
 * @param {string} promptText - Full prompt text (system + user)
 * @returns {{ num_ctx: number, estimatedTokens: number }}
 */
export function chooseNumCtx(promptText) {
  const tokens = estimateTokens(promptText)
  if (tokens < 2800) return { num_ctx: 4096, estimatedTokens: tokens }
  if (tokens < 6500) return { num_ctx: 8192, estimatedTokens: tokens }
  return { num_ctx: 8192, estimatedTokens: tokens }
}

/**
 * Select only relevant code sections based on instruction keywords.
 *
 * @param {string} instruction - User instruction text
 * @param {Record<string, string>} allSections - All available code sections
 * @param {string|null} backendCode - Optional backend code (e.g. chat.js)
 * @param {object} config - App-specific keyword configuration
 * @param {Record<string, string[]>} config.sectionKeywords - Section name → trigger keywords
 * @param {string[]} [config.backendKeywords] - Keywords that trigger backend code inclusion
 * @param {Record<string, string[]>} [config.coupledSections] - Sections that should be included together
 * @param {Array<{trigger: string, keywords: string[], include: string}>} [config.conditionalIncludes] - Conditional section inclusion rules
 * @returns {{ sections: Record<string, string>, includeBackend: boolean }}
 */
export function selectRelevantSections(instruction, allSections, backendCode, config) {
  const lower = instruction.toLowerCase()
  const selected = {}
  let anyMatch = false

  // Match sections by keywords
  for (const [section, keywords] of Object.entries(config.sectionKeywords || {})) {
    if (allSections[section] && keywords.some(kw => lower.includes(kw))) {
      selected[section] = allSections[section]
      anyMatch = true
    }
  }

  // Include coupled sections (e.g. cr → matchResponse + aliases)
  for (const [trigger, coupled] of Object.entries(config.coupledSections || {})) {
    if (selected[trigger]) {
      for (const dep of coupled) {
        if (allSections[dep]) selected[dep] = allSections[dep]
      }
    }
  }

  // Conditional includes (e.g. buildPrompt + tone keywords → emotionalTokens)
  for (const rule of config.conditionalIncludes || []) {
    if (selected[rule.trigger] && allSections[rule.include]) {
      if (rule.keywords.some(kw => lower.includes(kw))) {
        selected[rule.include] = allSections[rule.include]
      }
    }
  }

  // Fallback: no keyword match → include everything
  if (!anyMatch) {
    return { sections: allSections, includeBackend: true }
  }

  // Include backend code only if instruction mentions backend keywords
  const includeBackend = (config.backendKeywords || []).some(kw => lower.includes(kw))

  return { sections: selected, includeBackend }
}

/**
 * Build the full AI prompt for code modifications.
 *
 * @param {string} instruction - User instruction
 * @param {Record<string, string>} allSections - All code sections
 * @param {string|null} backendCode - Optional backend code
 * @param {object} config - App-specific configuration
 * @param {string} config.appName - App name (e.g. 'ILCF MedInfo')
 * @param {string} config.appDescription - App description
 * @param {string} config.mainFilePath - Primary file path (e.g. 'clients/ilcf/index.html')
 * @param {string} [config.backendFilePath] - Backend file path (e.g. 'clients/ilcf/netlify/functions/chat.js')
 * @param {string[]} [config.extraRules] - Additional rules for the AI
 * @param {Record<string, string[]>} config.sectionKeywords
 * @param {string[]} [config.backendKeywords]
 * @param {Record<string, string[]>} [config.coupledSections]
 * @param {Array} [config.conditionalIncludes]
 * @returns {{ prompt: string, systemMessage: string, sectionCount: number, includeBackend: boolean }}
 */
export function buildTrainerPrompt(instruction, allSections, backendCode, config) {
  const { sections, includeBackend } = selectRelevantSections(
    instruction, allSections, backendCode, config
  )
  const sectionNames = Object.keys(sections)

  const sectionTexts = Object.entries(sections)
    .map(([name, text]) => `<section name="${name}">\n${text}\n</section>`)
    .join('\n\n')

  const backendPart = (includeBackend && backendCode && config.backendFilePath)
    ? `\n\n<file path="${config.backendFilePath}">\n${backendCode}\n</file>`
    : ''

  const defaultRules = [
    '"search" must be a CHARACTER-FOR-CHARACTER EXACT copy from the source file — copy-paste, do NOT retype or reformat. Include 2-3 lines of surrounding context so the match is unique.',
    'Preserve ALL original whitespace, indentation (spaces vs tabs), quote style, and line breaks in the "search" field. Even one extra space will cause a match failure.',
    'Modify ONLY what instruction asks. Preserve code structure.',
    'Return ONLY valid JSON — no explanation, no markdown outside the JSON.',
  ]
  const rules = [...defaultRules, ...(config.extraRules || [])]
  const rulesText = rules.map((r, i) => `${i + 1}. ${r}`).join('\n')

  const systemMessage = 'You are a precise code modification assistant. Return only valid JSON. Every search string must be an exact match from the source file.'

  const prompt = [
    `You are modifying the ${config.appName} (${config.appDescription}).`,
    '',
    `<instruction>\n${instruction}\n</instruction>`,
    '',
    `Modifiable sections (showing only relevant ones: ${sectionNames.join(', ')}):`,
    '',
    `<file path="${config.mainFilePath}">\n${sectionTexts}\n</file>`,
    backendPart,
    '',
    'Return a JSON object:',
    '{',
    '  "summary_he": "Hebrew summary",',
    '  "summary_en": "English summary",',
    `  "modifications": [{"file": "${config.mainFilePath}", "search": "EXACT substring", "replace": "replacement"}]`,
    '}',
    '',
    'RULES:',
    rulesText,
  ].join('\n')

  return {
    prompt,
    systemMessage,
    sectionCount: sectionNames.length,
    includeBackend,
  }
}
