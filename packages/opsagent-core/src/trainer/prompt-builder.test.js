import { describe, expect, it } from 'vitest'
import {
  estimateTokens,
  chooseNumCtx,
  selectRelevantSections,
  buildTrainerPrompt,
} from './prompt-builder.js'
import { ILCF_SECTION_KEYWORDS, ILCF_BACKEND_KEYWORDS } from './trainer-config.ilcf.js'

const SAMPLE_CONFIG = {
  appName: 'Test App',
  appDescription: 'Test description',
  mainFilePath: 'test/index.html',
  backendFilePath: 'test/chat.js',
  sectionKeywords: {
    greeting: ['hello', 'welcome', 'שלום'],
    responses: ['response', 'answer', 'תשובה'],
    style: ['tone', 'style', 'טון'],
  },
  backendKeywords: ['backend', 'server', 'api'],
  coupledSections: { responses: ['aliases'] },
  conditionalIncludes: [
    { trigger: 'style', keywords: ['tone', 'טון'], include: 'emotionalTokens' },
  ],
}

const SAMPLE_SECTIONS = {
  greeting: 'function greeting() { return "hello" }',
  responses: 'const responses = { q1: "answer1" }',
  aliases: 'const aliases = { doc: "doctor" }',
  style: 'const systemPrompt = "be helpful"',
  emotionalTokens: 'const emotions = ["empathy"]',
}

describe('prompt-builder', () => {
  describe('estimateTokens', () => {
    it('estimates ~1 token per 3.5 chars', () => {
      const text = 'a'.repeat(350)
      expect(estimateTokens(text)).toBe(100)
    })

    it('rounds up', () => {
      expect(estimateTokens('hello')).toBe(2) // 5/3.5 = 1.43 → 2
    })
  })

  describe('chooseNumCtx', () => {
    it('returns 4096 for small prompts', () => {
      const text = 'a'.repeat(5000) // ~1428 tokens
      expect(chooseNumCtx(text).num_ctx).toBe(4096)
    })

    it('returns 8192 for medium prompts', () => {
      const text = 'a'.repeat(15000) // ~4286 tokens
      expect(chooseNumCtx(text).num_ctx).toBe(8192)
    })

    it('caps at 8192 for large prompts', () => {
      const text = 'a'.repeat(50000)
      expect(chooseNumCtx(text).num_ctx).toBe(8192)
    })
  })

  describe('selectRelevantSections', () => {
    it('selects matching sections by keyword', () => {
      const result = selectRelevantSections('change the שלום message', SAMPLE_SECTIONS, null, SAMPLE_CONFIG)
      expect(result.sections).toHaveProperty('greeting')
      expect(result.sections).not.toHaveProperty('responses')
    })

    it('includes coupled sections', () => {
      const result = selectRelevantSections('update the response for תשובה', SAMPLE_SECTIONS, null, SAMPLE_CONFIG)
      expect(result.sections).toHaveProperty('responses')
      expect(result.sections).toHaveProperty('aliases') // coupled
    })

    it('includes conditional sections when trigger keywords match', () => {
      const result = selectRelevantSections('change the tone of style', SAMPLE_SECTIONS, null, SAMPLE_CONFIG)
      expect(result.sections).toHaveProperty('style')
      expect(result.sections).toHaveProperty('emotionalTokens') // conditional
    })

    it('falls back to all sections when no keyword matches', () => {
      const result = selectRelevantSections('do something completely random', SAMPLE_SECTIONS, null, SAMPLE_CONFIG)
      expect(Object.keys(result.sections)).toHaveLength(Object.keys(SAMPLE_SECTIONS).length)
      expect(result.includeBackend).toBe(true)
    })

    it('includes backend only when backend keywords present', () => {
      const result = selectRelevantSections('update the api server hello', SAMPLE_SECTIONS, 'code', SAMPLE_CONFIG)
      expect(result.includeBackend).toBe(true)
    })

    it('excludes backend when no backend keywords', () => {
      const result = selectRelevantSections('change the שלום', SAMPLE_SECTIONS, 'code', SAMPLE_CONFIG)
      expect(result.includeBackend).toBe(false)
    })
  })

  describe('buildTrainerPrompt', () => {
    it('returns prompt, systemMessage, sectionCount, includeBackend', () => {
      const result = buildTrainerPrompt('change שלום', SAMPLE_SECTIONS, null, SAMPLE_CONFIG)
      expect(result).toHaveProperty('prompt')
      expect(result).toHaveProperty('systemMessage')
      expect(result).toHaveProperty('sectionCount')
      expect(result).toHaveProperty('includeBackend')
      expect(result.prompt).toContain('Test App')
      expect(result.prompt).toContain('<instruction>')
      expect(result.prompt).toContain('change שלום')
    })

    it('includes backend file when keywords match', () => {
      const result = buildTrainerPrompt('update the backend api', SAMPLE_SECTIONS, 'server code', SAMPLE_CONFIG)
      expect(result.prompt).toContain('test/chat.js')
      expect(result.includeBackend).toBe(true)
    })

    it('excludes backend file when no keywords match', () => {
      const result = buildTrainerPrompt('change שלום', SAMPLE_SECTIONS, 'server code', SAMPLE_CONFIG)
      expect(result.prompt).not.toContain('test/chat.js')
    })
  })

  describe('acceptance criteria — token budgets', () => {
    // Realistic ILCF section sizes (approximate character counts from production)
    const REALISTIC_SECTIONS = {
      cr: 'x'.repeat(4200),              // ~1200 tokens — canned responses are the largest
      matchResponse: 'x'.repeat(2100),   // ~600 tokens
      greeting: 'x'.repeat(350),         // ~100 tokens
      quickButtons: 'x'.repeat(420),     // ~120 tokens
      buildPrompt: 'x'.repeat(1400),     // ~400 tokens
      aliases: 'x'.repeat(700),          // ~200 tokens
      emotionalTokens: 'x'.repeat(280),  // ~80 tokens
    }
    const REALISTIC_CHATJS = 'x'.repeat(3500) // ~1000 tokens

    const ILCF_CONFIG = {
      appName: 'ILCF MedInfo',
      appDescription: 'Hebrew medical info chatbot for lung cancer patients in Israel',
      mainFilePath: 'clients/ilcf/index.html',
      backendFilePath: 'clients/ilcf/netlify/functions/chat.js',
      sectionKeywords: ILCF_SECTION_KEYWORDS,
      backendKeywords: ILCF_BACKEND_KEYWORDS,
      coupledSections: { cr: ['matchResponse', 'aliases'] },
      conditionalIncludes: [
        { trigger: 'buildPrompt', keywords: ['tone', 'טון'], include: 'emotionalTokens' },
      ],
      extraRules: [
        'All user-facing text must be in Hebrew. Drug names stay in English.',
        'Medical info must be accurate and up to date.',
        'If adding to CR, also add keywords to matchResponse() and ALIASES.',
        'Do NOT modify CSS, HTML structure, RAG pipeline, or event listeners.',
      ],
    }

    it('greeting-only prompt uses num_ctx 4096', () => {
      const result = buildTrainerPrompt('שנה את הודעת הפתיחה', REALISTIC_SECTIONS, REALISTIC_CHATJS, ILCF_CONFIG)
      const fullText = result.systemMessage + '\n' + result.prompt
      const { num_ctx, estimatedTokens } = chooseNumCtx(fullText)
      expect(result.sectionCount).toBe(1) // greeting only
      expect(num_ctx).toBe(4096)
      expect(estimatedTokens).toBeLessThan(2800) // well under 4096 budget
    })

    it('tone/style prompt stays under 4096 tokens', () => {
      const result = buildTrainerPrompt('שפרי את הטון', REALISTIC_SECTIONS, REALISTIC_CHATJS, ILCF_CONFIG)
      const fullText = result.systemMessage + '\n' + result.prompt
      const { num_ctx, estimatedTokens } = chooseNumCtx(fullText)
      expect(result.sectionCount).toBeLessThanOrEqual(2) // buildPrompt + emotionalTokens
      expect(num_ctx).toBe(4096)
      expect(estimatedTokens).toBeLessThan(2800)
    })

    it('button-only prompt stays under 4096 tokens', () => {
      const result = buildTrainerPrompt('change the quick כפתור', REALISTIC_SECTIONS, REALISTIC_CHATJS, ILCF_CONFIG)
      const fullText = result.systemMessage + '\n' + result.prompt
      const { num_ctx, estimatedTokens } = chooseNumCtx(fullText)
      expect(result.sectionCount).toBe(1) // quickButtons only
      expect(num_ctx).toBe(4096)
      expect(estimatedTokens).toBeLessThan(2800)
    })

    it('topic (cr) prompt includes coupled sections but stays manageable', () => {
      const result = buildTrainerPrompt('תוסיפי נושא חדש: הקרנות', REALISTIC_SECTIONS, REALISTIC_CHATJS, ILCF_CONFIG)
      const fullText = result.systemMessage + '\n' + result.prompt
      const { num_ctx, estimatedTokens } = chooseNumCtx(fullText)
      expect(result.sectionCount).toBe(3) // cr + matchResponse + aliases
      expect(result.includeBackend).toBe(false) // no backend keywords
      // cr+matchResponse+aliases is the largest combo, may need 8192
      expect(estimatedTokens).toBeLessThan(6500)
    })

    it('fallback (all sections + chat.js) stays under 8192 tokens', () => {
      const result = buildTrainerPrompt('do something completely unrelated', REALISTIC_SECTIONS, REALISTIC_CHATJS, ILCF_CONFIG)
      const fullText = result.systemMessage + '\n' + result.prompt
      const { estimatedTokens } = chooseNumCtx(fullText)
      expect(result.sectionCount).toBe(Object.keys(REALISTIC_SECTIONS).length)
      expect(result.includeBackend).toBe(true) // fallback includes everything
      expect(estimatedTokens).toBeLessThan(6500)
    })

    it('backend code excluded unless backend keywords present', () => {
      const greeting = buildTrainerPrompt('change greeting שלום', REALISTIC_SECTIONS, REALISTIC_CHATJS, ILCF_CONFIG)
      expect(greeting.includeBackend).toBe(false)
      expect(greeting.prompt).not.toContain('chat.js')

      const backend = buildTrainerPrompt('fix the backend api server', REALISTIC_SECTIONS, REALISTIC_CHATJS, ILCF_CONFIG)
      expect(backend.includeBackend).toBe(true)
      expect(backend.prompt).toContain('chat.js')
    })
  })

  describe('ILCF section keywords coverage', () => {
    it('has all expected ILCF sections', () => {
      const expected = ['cr', 'matchResponse', 'greeting', 'quickButtons', 'buildPrompt', 'aliases', 'emotionalTokens']
      for (const section of expected) {
        expect(ILCF_SECTION_KEYWORDS).toHaveProperty(section)
        expect(ILCF_SECTION_KEYWORDS[section].length).toBeGreaterThan(0)
      }
    })

    it('has backend keywords', () => {
      expect(ILCF_BACKEND_KEYWORDS.length).toBeGreaterThan(0)
      expect(ILCF_BACKEND_KEYWORDS).toContain('chat.js')
    })
  })
})
