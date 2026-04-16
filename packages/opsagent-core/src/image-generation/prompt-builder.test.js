import { describe, it, expect } from 'vitest'
import { enhancePrompt, mergeNegativePrompts, buildGenerationPayload } from './prompt-builder.js'

describe('enhancePrompt', () => {
  it('adds photorealistic modifiers by default', () => {
    const result = enhancePrompt('a sunset')
    expect(result).toContain('RAW photo')
    expect(result).toContain('a sunset')
    expect(result).toContain('8K UHD')
  })

  it('adds anime modifiers', () => {
    const result = enhancePrompt('a warrior', 'anime')
    expect(result).toContain('anime artwork')
    expect(result).toContain('cel-shaded')
  })

  it('returns raw prompt for unknown style', () => {
    expect(enhancePrompt('hello', 'nonexistent')).toBe('hello')
  })

  it('handles all 10 styles without error', () => {
    const styles = ['photorealistic', 'anime', 'digital-art', 'oil-painting', 'watercolor',
      '3d-render', 'pixel-art', 'sketch', 'cyberpunk', 'minimalist']
    for (const s of styles) {
      const r = enhancePrompt('test', s)
      expect(r.length).toBeGreaterThan(4)
    }
  })
})

describe('mergeNegativePrompts', () => {
  it('returns style negative when user has none', () => {
    const result = mergeNegativePrompts('', 'anime')
    expect(result).toContain('photo')
  })

  it('merges user negative with style negative', () => {
    const result = mergeNegativePrompts('ugly', 'anime')
    expect(result).toContain('ugly')
    expect(result).toContain('photo')
  })

  it('returns empty for unknown style and no user input', () => {
    expect(mergeNegativePrompts('', 'nonexistent')).toBe('')
  })
})

describe('buildGenerationPayload', () => {
  it('builds a complete payload', () => {
    const resolved = {
      prompt: 'a cat',
      negativePrompt: 'ugly',
      style: 'anime',
      width: 512,
      height: 512,
      numImages: 2,
      guidanceScale: 7.5,
      inferenceSteps: 28,
      seed: 42,
    }
    const payload = buildGenerationPayload(resolved)
    expect(payload.prompt).toContain('anime artwork')
    expect(payload.prompt).toContain('a cat')
    expect(payload.negativePrompt).toContain('ugly')
    expect(payload.negativePrompt).toContain('photo')
    expect(payload.width).toBe(512)
    expect(payload.numImages).toBe(2)
    expect(payload.seed).toBe(42)
  })
})
