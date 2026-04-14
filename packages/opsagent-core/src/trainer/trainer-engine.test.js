import { describe, expect, it } from 'vitest'
import { createTrainerEngine } from './trainer-engine.js'

const MOCK_CONFIG = {
  appName: 'Test App',
  appDescription: 'Test description',
  mainFilePath: 'test/index.html',
  sectionKeywords: {
    greeting: ['hello', 'שלום'],
    responses: ['response', 'תשובה'],
  },
  backendKeywords: ['backend'],
  coupledSections: {},
  conditionalIncludes: [],
  ai: {
    endpoint: 'http://localhost:11434',
    model: 'test-model',
  },
}

const MOCK_SECTIONS = {
  greeting: 'function greeting() { return "hello" }',
  responses: 'const responses = {}',
}

describe('trainer-engine', () => {
  describe('createTrainerEngine', () => {
    it('returns an object with the expected methods', () => {
      const engine = createTrainerEngine(MOCK_CONFIG)
      expect(engine).toHaveProperty('buildPromptInfo')
      expect(engine).toHaveProperty('generateModifications')
      expect(engine).toHaveProperty('processInstruction')
      expect(typeof engine.buildPromptInfo).toBe('function')
      expect(typeof engine.generateModifications).toBe('function')
      expect(typeof engine.processInstruction).toBe('function')
    })
  })

  describe('buildPromptInfo', () => {
    it('returns prompt info with token estimates', () => {
      const engine = createTrainerEngine(MOCK_CONFIG)
      const info = engine.buildPromptInfo('change the שלום', MOCK_SECTIONS)
      expect(info).toHaveProperty('prompt')
      expect(info).toHaveProperty('systemMessage')
      expect(info).toHaveProperty('sectionCount')
      expect(info).toHaveProperty('num_ctx')
      expect(info).toHaveProperty('estimatedTokens')
      expect(info.sectionCount).toBe(1) // only greeting matched
      expect(info.num_ctx).toBeGreaterThanOrEqual(4096)
      expect(info.estimatedTokens).toBeGreaterThan(0)
    })

    it('selects all sections on fallback', () => {
      const engine = createTrainerEngine(MOCK_CONFIG)
      const info = engine.buildPromptInfo('do something unrelated', MOCK_SECTIONS)
      expect(info.sectionCount).toBe(Object.keys(MOCK_SECTIONS).length)
    })

    it('includes app name in prompt', () => {
      const engine = createTrainerEngine(MOCK_CONFIG)
      const info = engine.buildPromptInfo('change שלום', MOCK_SECTIONS)
      expect(info.prompt).toContain('Test App')
    })
  })

  // Note: generateModifications and processInstruction require a live AI endpoint
  // and are tested via integration tests or E2E. Unit tests verify the orchestration
  // plumbing through buildPromptInfo which exercises the same code paths.
})
