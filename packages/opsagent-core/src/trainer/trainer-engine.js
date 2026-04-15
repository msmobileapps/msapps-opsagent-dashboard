/**
 * trainer-engine.js — Core orchestration for the OpsAgent Trainer.
 *
 * Creates a trainer engine from a configuration object. The engine
 * runs the full pipeline: build prompt → stream AI → parse response
 * → commit to GitHub. Generic — any app can use it by providing config.
 *
 * @example
 *   import { createTrainerEngine } from 'opsagent-core/trainer'
 *   import { ilcfConfig } from './trainer-config.js'
 *
 *   const engine = createTrainerEngine(ilcfConfig)
 *
 *   // Server-side: full pipeline with commit
 *   const result = await engine.processInstruction(instruction, sections, chatJs, {
 *     commit: true,
 *     onStatus: (msg) => console.log(msg),
 *   })
 *
 *   // Client-side: prompt + stream only (commit handled separately)
 *   const aiResult = await engine.generateModifications(instruction, sections, chatJs, {
 *     onToken: (token, count, elapsed) => updateUI(count, elapsed),
 *   })
 */

import { buildTrainerPrompt, chooseNumCtx, estimateTokens } from './prompt-builder.js'
import { streamChatToString } from './streaming-client.js'
import { parseModifications } from './response-parser.js'
import { commitModifications } from './github-committer.js'
import { validateModifications, fuzzyMatch, findClosestMatch } from './fuzzy-match.js'

/**
 * @typedef {object} TrainerConfig
 * @property {string} appName           - Display name (e.g. 'ILCF MedInfo')
 * @property {string} appDescription    - Brief description
 * @property {string} mainFilePath      - Primary file path in repo
 * @property {string} [backendFilePath] - Backend file path in repo
 * @property {string[]} [extraRules]    - Additional AI rules
 * @property {Record<string, string[]>} sectionKeywords - Section → keyword mapping
 * @property {string[]} [backendKeywords] - Keywords triggering backend inclusion
 * @property {Record<string, string[]>} [coupledSections] - Sections included together
 * @property {Array<{trigger: string, keywords: string[], include: string}>} [conditionalIncludes]
 * @property {object} ai                - AI endpoint configuration
 * @property {string} ai.endpoint       - Ollama-compatible endpoint URL
 * @property {string} ai.model          - Model name
 * @property {number} [ai.temperature]  - Sampling temperature (default 0.1)
 * @property {number} [ai.timeout]      - Streaming timeout (default 300000)
 * @property {object} [github]          - GitHub commit configuration
 * @property {string} github.token      - GitHub PAT
 * @property {string} github.owner      - Repo owner
 * @property {string} github.repo       - Repo name
 * @property {string} github.branch     - Target branch
 */

/**
 * @typedef {object} PromptInfo
 * @property {string} prompt            - Full user prompt
 * @property {string} systemMessage     - System message
 * @property {number} sectionCount      - Number of sections included
 * @property {boolean} includeBackend   - Whether backend code is included
 * @property {number} num_ctx           - Context window size
 * @property {number} estimatedTokens   - Estimated token count
 */

/**
 * @typedef {object} GenerateResult
 * @property {string} summary_he
 * @property {string} summary_en
 * @property {Array<{file: string, search: string, replace: string}>} modifications
 * @property {number} tokenCount
 * @property {number} elapsed          - Time in milliseconds
 * @property {PromptInfo} promptInfo
 */

/**
 * @typedef {object} ProcessResult
 * @property {GenerateResult} ai       - AI generation result
 * @property {object} [commit]         - Commit result (if commit: true)
 * @property {string} commit.sha
 * @property {string} commit.html_url
 * @property {string[]} [changed_files]
 * @property {string[]} [errors]
 */

/**
 * Create a trainer engine with the given configuration.
 *
 * @param {TrainerConfig} config
 * @returns {{ generateModifications: Function, processInstruction: Function, buildPromptInfo: Function }}
 */
export function createTrainerEngine(config) {
  /**
   * Build prompt info without calling AI — useful for token estimation and UI display.
   *
   * @param {string} instruction
   * @param {Record<string, string>} sections
   * @param {string|null} backendCode
   * @returns {PromptInfo}
   */
  function buildPromptInfo(instruction, sections, backendCode = null) {
    const promptResult = buildTrainerPrompt(instruction, sections, backendCode, config)
    const fullText = promptResult.systemMessage + '\n' + promptResult.prompt
    const { num_ctx, estimatedTokens: tokens } = chooseNumCtx(fullText)

    return {
      ...promptResult,
      num_ctx,
      estimatedTokens: tokens,
    }
  }

  /**
   * Generate modifications from AI without committing.
   * Works in both browser and Node.js.
   *
   * @param {string} instruction - User instruction
   * @param {Record<string, string>} sections - Code sections
   * @param {string|null} backendCode - Optional backend code
   * @param {object} [options]
   * @param {function} [options.onToken] - Token progress callback (token, count, elapsed)
   * @param {AbortSignal} [options.signal] - Abort signal
   * @returns {Promise<GenerateResult>}
   */
  async function generateModifications(instruction, sections, backendCode = null, options = {}) {
    const info = buildPromptInfo(instruction, sections, backendCode)

    const messages = [
      { role: 'system', content: info.systemMessage },
      { role: 'user', content: info.prompt },
    ]

    const { text, tokenCount, elapsed } = await streamChatToString(
      config.ai.endpoint,
      config.ai.model,
      messages,
      {
        num_ctx: info.num_ctx,
        temperature: config.ai.temperature || 0.1,
        timeout: config.ai.timeout || 300_000,
        onToken: options.onToken,
        signal: options.signal,
      }
    )

    const parsed = parseModifications(text)

    return {
      ...parsed,
      tokenCount,
      elapsed,
      promptInfo: info,
    }
  }

  /**
   * Full pipeline: generate modifications and optionally commit to GitHub.
   *
   * @param {string} instruction
   * @param {Record<string, string>} sections
   * @param {string|null} backendCode
   * @param {object} [options]
   * @param {boolean} [options.commit=true] - Whether to commit changes
   * @param {function} [options.onStatus] - Status callback (message)
   * @param {function} [options.onToken] - Token progress callback
   * @param {AbortSignal} [options.signal] - Abort signal
   * @returns {Promise<ProcessResult>}
   */
  async function processInstruction(instruction, sections, backendCode = null, options = {}) {
    const { commit: shouldCommit = true, onStatus, ...genOptions } = options

    if (onStatus) onStatus('Building prompt...')
    const aiResult = await generateModifications(instruction, sections, backendCode, genOptions)

    if (!aiResult.modifications.length) {
      return { ai: aiResult, changed_files: [], errors: [] }
    }

    if (!shouldCommit || !config.github) {
      return { ai: aiResult, changed_files: [], errors: [] }
    }

    if (onStatus) onStatus('Committing changes...')
    const commitResult = await commitModifications({
      token: config.github.token,
      owner: config.github.owner,
      repo: config.github.repo,
      branch: config.github.branch,
      modifications: aiResult.modifications,
      message: `Trainer: ${aiResult.summary_en || instruction.slice(0, 60)}`,
    })

    return {
      ai: aiResult,
      commit: commitResult.commit,
      changed_files: commitResult.changed_files,
      errors: commitResult.errors,
    }
  }

  /**
   * Validate AI-generated modifications against file content without committing.
   * Returns match status per modification with helpful error info for failed matches.
   *
   * @param {Array<{file: string, search: string, replace: string}>} modifications
   * @param {Record<string, string>} fileContents - Map of file path → file content
   * @returns {Array<{file: string, search: string, replace: string, matched: boolean, strategy: string|null, closestMatch: object|null}>}
   */
  function validateBeforeCommit(modifications, fileContents) {
    return modifications.map(mod => {
      const content = fileContents[mod.file]
      if (!content) {
        return { ...mod, matched: false, strategy: null, closestMatch: null }
      }
      const validations = validateModifications(content, [{ search: mod.search, replace: mod.replace }])
      return { file: mod.file, ...validations[0] }
    })
  }

  return {
    buildPromptInfo,
    generateModifications,
    processInstruction,
    validateBeforeCommit,
  }
}
