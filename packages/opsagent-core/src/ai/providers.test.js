import { describe, expect, it, vi } from 'vitest'
import {
  createCascadingProvider,
  WorkersAIProvider,
  OllamaProvider,
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
        aiBinding: {},
        ollamaBaseUrl: 'http://localhost:11434',
      })
      const available = provider.getAvailableProviders()
      expect(available).toContain('workers-ai')
      expect(available).toContain('ollama')
      expect(available).toHaveLength(2)
    })

    it('returns correct cascade for code-generation', () => {
      const provider = createCascadingProvider({})
      const cascade = provider.getCascade('code-generation')
      expect(cascade[0]).toBe('workers-ai')
      expect(cascade).toContain('ollama')
      expect(cascade).not.toContain('groq')
      expect(cascade).not.toContain('gemini')
    })

    it('returns correct cascade for classification', () => {
      const provider = createCascadingProvider({})
      const cascade = provider.getCascade('classification')
      expect(cascade[0]).toBe('workers-ai')
      expect(cascade).toHaveLength(1)
    })

    it('returns correct cascade for embedding', () => {
      const provider = createCascadingProvider({})
      const cascade = provider.getCascade('embedding')
      expect(cascade).toEqual(['workers-ai'])
    })

    it('returns correct cascade for trainer', () => {
      const provider = createCascadingProvider({})
      const cascade = provider.getCascade('trainer')
      expect(cascade).toEqual(['workers-ai', 'ollama'])
    })

    it('all cascades use only workers-ai and ollama', () => {
      const provider = createCascadingProvider({})
      const s = provider.status()
      for (const [, cascade] of Object.entries(s.cascades)) {
        for (const p of cascade) {
          expect(['workers-ai', 'ollama']).toContain(p)
        }
      }
    })

    it('allows custom cascade overrides', () => {
      const provider = createCascadingProvider({
        cascades: { 'code-generation': ['ollama', 'workers-ai'] },
      })
      expect(provider.getCascade('code-generation')).toEqual(['ollama', 'workers-ai'])
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

    it('status() returns only workers-ai and ollama providers', () => {
      const provider = createCascadingProvider({ ollamaBaseUrl: 'http://localhost:11434' })
      const s = provider.status()
      expect(Object.keys(s.providers)).toEqual(['workers-ai', 'ollama'])
      expect(s.providers['workers-ai'].available).toBe(false)
      expect(s.providers.ollama.available).toBe(true)
      expect(s.cascades).toBeDefined()
    })

    it('cascades to ollama when workers-ai fails', async () => {
      const mockAiBinding = {
        run: vi.fn().mockRejectedValue(new Error('Workers AI overloaded')),
      }
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn(async (url) => {
        if (url.includes('/api/chat')) {
          return {
            ok: true,
            json: async () => ({
              message: { content: 'Hello from Ollama' },
            }),
          }
        }
        return { ok: false, status: 404, text: async () => 'Not found' }
      })

      try {
        const provider = createCascadingProvider({
          aiBinding: mockAiBinding,
          ollamaBaseUrl: 'http://localhost:11434',
        })
        const result = await provider.chat(
          [{ role: 'user', content: 'hello' }],
          { taskType: 'chat' },
        )
        expect(result.content).toBe('Hello from Ollama')
        expect(result.provider).toBe('ollama')
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].provider).toBe('workers-ai')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('returns all errors when every provider fails', async () => {
      const mockAiBinding = {
        run: vi.fn().mockRejectedValue(new Error('Workers AI down')),
      }
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 503,
        text: async () => 'Service unavailable',
      }))

      try {
        const provider = createCascadingProvider({
          aiBinding: mockAiBinding,
          ollamaBaseUrl: 'http://localhost:11434',
        })
        const result = await provider.chat(
          [{ role: 'user', content: 'hello' }],
          { taskType: 'code-generation' },
        )
        expect(result.content).toBe('')
        expect(result.error).toMatch(/All providers failed/)
        expect(result.errors).toHaveLength(2)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('embed throws without workers-ai configured', async () => {
      const provider = createCascadingProvider({ ollamaBaseUrl: 'http://localhost:11434' })
      await expect(provider.embed('hello')).rejects.toThrow(/Workers AI/)
    })
  })
})
