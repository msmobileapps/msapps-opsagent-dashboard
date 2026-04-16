import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImageGenerationAdapter } from './adapter.js'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('ImageGenerationAdapter', () => {
  it('requires baseUrl', () => {
    expect(() => new ImageGenerationAdapter({})).toThrow(/baseUrl/)
  })

  it('strips trailing slashes from baseUrl', () => {
    const adapter = new ImageGenerationAdapter({ baseUrl: 'http://img.local///' })
    expect(adapter.baseUrl).toBe('http://img.local')
  })
})

describe('generateImage', () => {
  it('sends POST to /generate', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ images: [{ base64: 'abc', seed: 42 }], meta: {} }),
    })
    const adapter = new ImageGenerationAdapter({ baseUrl: 'http://img.local' })
    const result = await adapter.generateImage({ prompt: 'cat', width: 512, height: 512 })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('http://img.local/generate')
    expect(opts.method).toBe('POST')
    expect(result.images).toHaveLength(1)
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal error',
    })
    const adapter = new ImageGenerationAdapter({ baseUrl: 'http://img.local' })
    await expect(adapter.generateImage({ prompt: 'cat' })).rejects.toThrow(/500/)
  })

  it('includes auth header when apiKey set', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ images: [], meta: {} }),
    })
    const adapter = new ImageGenerationAdapter({ baseUrl: 'http://img.local', apiKey: 'secret' })
    await adapter.generateImage({ prompt: 'cat' })

    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers.Authorization).toBe('Bearer secret')
  })

  it('merges defaultOverrides into payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ images: [], meta: {} }),
    })
    const adapter = new ImageGenerationAdapter({
      baseUrl: 'http://img.local',
      defaultOverrides: { model: 'flux-schnell' },
    })
    await adapter.generateImage({ prompt: 'cat' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.model).toBe('flux-schnell')
    expect(body.prompt).toBe('cat')
  })
})

describe('healthCheck', () => {
  it('sends GET to /health', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', provider: 'mock' }),
    })
    const adapter = new ImageGenerationAdapter({ baseUrl: 'http://img.local' })
    const result = await adapter.healthCheck()
    expect(result.status).toBe('ok')
    expect(mockFetch.mock.calls[0][0]).toBe('http://img.local/health')
  })
})

describe('listModels', () => {
  it('sends GET to /models', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: ['flux-schnell'] }),
    })
    const adapter = new ImageGenerationAdapter({ baseUrl: 'http://img.local' })
    const result = await adapter.listModels()
    expect(result.models).toEqual(['flux-schnell'])
  })
})
