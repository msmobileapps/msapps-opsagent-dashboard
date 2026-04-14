/**
 * response-parser.js — Extract and validate JSON from AI responses.
 *
 * AI models often wrap JSON in markdown fences or include explanatory text.
 * This module robustly extracts the JSON payload and validates the
 * trainer modification format.
 *
 * @example
 *   import { extractJson, parseModifications } from 'opsagent-core/trainer'
 *
 *   const raw = '```json\n{"summary_he": "...", "modifications": [...]}\n```'
 *   const result = parseModifications(raw)
 *   // { summary_he, summary_en, modifications: [{file, search, replace}] }
 */

/**
 * Extract JSON string from AI response text.
 * Handles: ```json fences, ``` fences, raw JSON, mixed text with JSON.
 *
 * @param {string} text - Raw AI response text
 * @returns {string} Extracted JSON string (unparsed)
 */
export function extractJson(text) {
  // Try ```json fences first
  const jsonFence = text.match(/```json\s*([\s\S]*?)```/i)
  if (jsonFence) return jsonFence[1].trim()

  // Try generic ``` fences
  const genericFence = text.match(/```\s*([\s\S]*?)```/)
  if (genericFence) return genericFence[1].trim()

  // Try raw JSON (first { to last })
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) return text.slice(first, last + 1)

  // Return as-is (will fail at parse time with clear error)
  return text
}

/**
 * @typedef {object} Modification
 * @property {string} file   - File path to modify
 * @property {string} search - Exact search substring
 * @property {string} replace - Replacement text
 */

/**
 * @typedef {object} TrainerResult
 * @property {string} summary_he - Hebrew summary of changes
 * @property {string} summary_en - English summary of changes
 * @property {Modification[]} modifications - List of code modifications
 */

/**
 * Parse and validate the full AI response into a TrainerResult.
 *
 * @param {string} rawText - Raw AI response (may include fences, explanatory text)
 * @returns {TrainerResult}
 * @throws {Error} If JSON is invalid or missing required fields
 */
export function parseModifications(rawText) {
  if (!rawText || !rawText.trim()) {
    throw new Error('AI returned empty response')
  }

  const jsonStr = extractJson(rawText)
  let parsed

  try {
    parsed = JSON.parse(jsonStr)
  } catch (err) {
    throw new Error(`Failed to parse AI response as JSON: ${err.message}`)
  }

  // Validate structure
  const result = {
    summary_he: parsed.summary_he || '',
    summary_en: parsed.summary_en || '',
    modifications: [],
  }

  if (!Array.isArray(parsed.modifications)) {
    return result // No modifications — valid "no changes needed" response
  }

  // Validate each modification
  for (const mod of parsed.modifications) {
    if (!mod.file || typeof mod.file !== 'string') {
      throw new Error('Modification missing "file" field')
    }
    if (!mod.search || typeof mod.search !== 'string') {
      throw new Error('Modification missing "search" field')
    }
    if (typeof mod.replace !== 'string') {
      throw new Error('Modification missing "replace" field')
    }
    result.modifications.push({
      file: mod.file,
      search: mod.search,
      replace: mod.replace,
    })
  }

  return result
}
