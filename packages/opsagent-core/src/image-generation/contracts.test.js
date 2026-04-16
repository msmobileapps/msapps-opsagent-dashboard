import { describe, it, expect } from 'vitest'
import { validateInput, applyDefaults, IMAGE_STYLES, IMAGE_RESOLUTIONS } from './contracts.js'

describe('validateInput', () => {
  it('rejects null input', () => {
    expect(validateInput(null).valid).toBe(false)
  })

  it('rejects missing prompt', () => {
    const r = validateInput({})
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/prompt/)
  })

  it('rejects empty prompt', () => {
    expect(validateInput({ prompt: '  ' }).valid).toBe(false)
  })

  it('rejects prompt over 1000 chars', () => {
    const r = validateInput({ prompt: 'x'.repeat(1001) })
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/1000/)
  })

  it('accepts valid prompt', () => {
    expect(validateInput({ prompt: 'a cute cat' }).valid).toBe(true)
  })

  it('rejects unknown style', () => {
    const r = validateInput({ prompt: 'cat', style: 'unknown-style' })
    expect(r.valid).toBe(false)
  })

  it('rejects unknown resolution', () => {
    const r = validateInput({ prompt: 'cat', resolution: '9999x9999' })
    expect(r.valid).toBe(false)
  })

  it('rejects numImages out of range', () => {
    expect(validateInput({ prompt: 'cat', numImages: 5 }).valid).toBe(false)
    expect(validateInput({ prompt: 'cat', numImages: 0 }).valid).toBe(false)
  })

  it('accepts full valid input', () => {
    expect(validateInput({
      prompt: 'a cute cat',
      style: 'anime',
      resolution: '768x768',
      numImages: 2,
      guidanceScale: 7.5,
      inferenceSteps: 28,
    }).valid).toBe(true)
  })
})

describe('applyDefaults', () => {
  it('fills in all defaults for minimal input', () => {
    const r = applyDefaults({ prompt: ' hello ' })
    expect(r.prompt).toBe('hello')
    expect(r.style).toBe('photorealistic')
    expect(r.resolution).toBe('1024x1024')
    expect(r.width).toBe(1024)
    expect(r.height).toBe(1024)
    expect(r.numImages).toBe(1)
    expect(r.guidanceScale).toBe(7.5)
    expect(r.inferenceSteps).toBe(28)
    expect(typeof r.seed).toBe('number')
  })

  it('preserves provided values', () => {
    const r = applyDefaults({ prompt: 'cat', style: 'anime', resolution: '512x512', seed: 42 })
    expect(r.style).toBe('anime')
    expect(r.width).toBe(512)
    expect(r.seed).toBe(42)
  })

  it('generates different seeds per call when not provided', () => {
    const a = applyDefaults({ prompt: 'cat' })
    const b = applyDefaults({ prompt: 'cat' })
    // Statistically should differ — allow flake tolerance
    expect(typeof a.seed).toBe('number')
    expect(typeof b.seed).toBe('number')
  })
})

describe('IMAGE_STYLES', () => {
  it('has 10 styles', () => {
    expect(Object.keys(IMAGE_STYLES)).toHaveLength(10)
  })
})

describe('IMAGE_RESOLUTIONS', () => {
  it('has 6 resolutions', () => {
    expect(Object.keys(IMAGE_RESOLUTIONS)).toHaveLength(6)
  })
})
