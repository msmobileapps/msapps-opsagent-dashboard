import { describe, expect, it, vi } from 'vitest'
import {
  createCascadingProvider,
  WorkersAIProvider,
  GroqProvider,
  OllamaProvider,
  GeminiProvider,
  TASK_TYPES,
} from './providers.js'

describe('providers', () => {
  describe('TASK_TYPES', () => {
    it('exports expected task type constants', () => {
      expect(TASK_TYPES.CODE_GENERATION).toBe('code-generation')
      expect(TASK_TYPES.CLASSIFICATION).toBe('classification')
      expect(TASK_TYPES.EXTRACTION).toBe('extraction')
      expect(TASK_TYPES.EMBEDDING).toBe('embedding')
      expect(TASK_TYPES.CHAT).toBe('chat')
      expect(TASK_TYPES.TRAINER).toBe('trainer')
    })
  })

  describe('WorkersAIProvider', () => {
    it('is not available without config', () => {
      expect(WorkersAIProvider.isAvailable({})).toBe(false)
    })

    it('is available with AI binding', () => {
      expect(WorkersAIProvider.isAvailable({ aiBinding: {} })).toBe(true)
    })

    it('is available with accountId + apiToken', () => {
      expect(
        WorkersAIProvider.isAvailable({ accountId: 'abc', apiToken: 'xyz' }),
      ).toBe(true)
    })

    it('supports expected task types', () => {
      expect(WorkersAIProvider.supportedTasks).toContain('classification')
      expect(WorkersAIProvider.supportedTasks).toContain('extraction')
      expect(WorkersAIProvider.supportedTasks).toContain('embedding')
      expect(WorkersAIProvider.supportedTasks).not.toContain('code-generation')
    })
  })

  describe('GroqProvider', () => {
    it('is not available without API key', () => {
      expect(GroqProvider.isAvailable({})).toBe(false)
    })

    it('is available with API key', () => {
      expect(GroqProvider.isAvailable({ groqApiKey: 'test' })).toBe(true)
    })

    it('supports code generation', () => {
      expect(GroqProvider.supportedTasks).toContain('code-generation')
      expect(GroqProvider.supportedTasks).toContain('trainer')
    })
  })

  describe('OllamaProvider', () => {
    it('is not available without base URL', () => {
      expect(OllamaProvider.isAvailable({})).toBe(false)
    })

    it('is available with base URL', () => {
      expect(OllamaProvider.isAvailable({ ollamaBaseUrl: 'http://localhost:11434' })).toBe(true)
    })

    it('supports code generation and trainer', () => {
      expect(OllamaProvider.supportedTasks).toContain('code-generation')
      expect(OllamaProvider.supportedTasks).toContain('trainer')
    })
  })

  describe('GeminiProvider', () => {
    it('is not available without API key', () => {
      expect(GeminiProvider.isAvailable({})).toBe(false)
    })

    it('is available with API key', () => {
      expect(GeminiProvider.isAvailable({ geminiApiKey: 'test' })).toBe(true)
    })

    it('supports all main task types', () => {
      expect(GeminiProvider.supportedTasks).toContain('code-generation')
      expect(GeminiProvider.supportedTasks).toContain('classification')
      expect(GeminiProvider.supportedTasks).toContain('trainer')
    })
  })

  describe('createCascadingProvider', () => {
    it('returns provider with expected API', () => {
      const provider = createCascadingProvider({})
      expect(typeof provider.chat).toBe('function')
      expect(typeof provider.embed).toBe('function')
      expect(typeof provider.status).toBe('function')
      expect(typeof provider.getAvailableProviders).toBe('function')
      expect(typeof provider.getCascade).toBe('function')
      expect(provider.TASK_TYPES).toBe(TASK_TYPES)
    })

    it('reports no providers when none configured', () => {
      const provider = createCascadingProvider({})
      expect(provider.getAvailableProviders()).toHaveLength(0)
    })

    it('reports available providers based on config', () => {
      const provider = createCascadingProvider({
        groqApiKey: 'test',
        ollamaBaseUrl: 'http://localhost:11434',
      })
      const available = provider.getAvailableProviders()
      expect(available).toContain('groq')
      expect(available).toContain('ollama')
      expect(available).not.toContain('workers-ai')
    })

    it('returns correct cascade for code-generation', () => {
      const provider = createCascadingProvider({})
      const cascade = provider.getCascade('code-generation')
      expect(cascade[0]).toBe('groq')
      expect(cascade).not.toContain('workers-ai')
    })

    it('returns correct cascade for classification', () => {
      const provider = createCascadingProvider({})
      const cascade = provider.getCascade('classification')
      expect(cascade[0]).toBe('workers-ai')
      expect(cascade[1]).toBe('groq')
    })

    it('returns correct cascade for embedding', () => {
      const provider = createCascadingProvider({})
      const cascade = provider.getCascade('embedding')
      expect(cascade).toEqual(['workers-ai'])
    })

    it('allows custom cascade overrides', () => {
      const provider = createCascadingProvider({
        cascades: { 'code-generation': ['gemini', 'groq'] },
      })
      expect(provider.getCascade('code-generation')).toEqual(['gemini', 'groq'])
      // Default cascade unchanged
      expect(provider.getCascade('classification')[0]).toBe('workers-ai')
    })

    it('returns error when no providers configured', async () => {
      const provider = createCascadingProvider({})
      const result = await provider.chat([{ role: 'user', content: 'hello' }])
      expect(result.content).toBe('')
      expect(result.provider).toBeNull()
      expect(result.error).toMatch(/No AI provider configured/)
    })

    it('status() returns all providers with availability', () => {
      const provider = createCascadingProvider({ groqApiKey: 'test' })
      const s = provider.status()
      expect(s.providers.groq.available).toBe(true)
      expect(s.providers['workers-ai'].available).toBe(false)
      expect(s.providers.ollama.available).toBe(false)
      expect(s.cascades).toBeDefined()
    })

    it('cascades to next provider on failure', async () => {
      // Mock fetch to fail for groq, succeed for gemini
      const originalFetch = globalThis.fetch
      let callCount = 0
      globalThis.fetch = vi.fn(async (url) => {
        callCount++
        if (url.includes('groq.com')) {
          return { ok: false, status: 500, text: async () => 'Internal error' }
        }
        if (url.includes('googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: 'Hello from Gemini' } }],
              usage: { total_tokens: 10 },
            }),
          }
        }
        return { ok: false, status: 404, text: async () => 'Not found' }
      })

      try {
        const provider = createCascadingProvider({
          groqApiKey: 'test',
          geminiApiKey: 'test',
        })
        const result = await provider.chat(
          [{ role: 'user', content: 'hello' }],
          { taskType: 'chat' },
        )
        expect(result.content).toBe('Hello from Gemini')
        expect(result.provider).toBe('gemini')
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].provider).toBe('groq')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('returns all errors when every provider fails', async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 503,
        text: async () => 'Service unavailable',
      }))

      try {
        const provider = createCascadingProvider({
          groqApiKey: 'test',
          geminiApiKey: 'test',
        })
        const result = await provider.chat(
          [{ role: 'user', content: 'hello' }],
          { taskType: 'code-generation' },
        )
        expect(result.content).toBe('')
        expect(result.error).toMatch(/All providers failed/)
        expect(result.errors.length).toBeGreaterThanOrEqual(2)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('embed throws without workers-ai configured', async () => {
      const provider = createCascadingProvider({ groqApiKey: 'test' })
      await expect(provider.embed('hello')).rejects.toThrow(/Workers AI/)
    })
  })
})
