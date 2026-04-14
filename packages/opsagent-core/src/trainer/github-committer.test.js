import { describe, expect, it } from 'vitest'
import { applyModifications } from './github-committer.js'

describe('github-committer', () => {
  describe('applyModifications', () => {
    it('applies a single modification', () => {
      const content = 'hello world, this is a test'
      const mods = [{ search: 'hello world', replace: 'goodbye world' }]
      const result = applyModifications(content, mods)
      expect(result.modified).toBe('goodbye world, this is a test')
      expect(result.applied).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('applies multiple modifications', () => {
      const content = 'line1\nline2\nline3'
      const mods = [
        { search: 'line1', replace: 'first' },
        { search: 'line3', replace: 'third' },
      ]
      const result = applyModifications(content, mods)
      expect(result.modified).toBe('first\nline2\nthird')
      expect(result.applied).toBe(2)
    })

    it('reports errors for unmatched search strings', () => {
      const content = 'hello world'
      const mods = [{ search: 'not found text', replace: 'replacement' }]
      const result = applyModifications(content, mods)
      expect(result.modified).toBe('hello world') // unchanged
      expect(result.applied).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('not found')
    })

    it('handles mixed success and failure', () => {
      const content = 'const x = 1;\nconst y = 2;'
      const mods = [
        { search: 'const x = 1', replace: 'const x = 10' },
        { search: 'const z = 3', replace: 'const z = 30' }, // doesn't exist
      ]
      const result = applyModifications(content, mods)
      expect(result.modified).toContain('const x = 10')
      expect(result.applied).toBe(1)
      expect(result.errors).toHaveLength(1)
    })

    it('handles empty modification list', () => {
      const content = 'hello'
      const result = applyModifications(content, [])
      expect(result.modified).toBe('hello')
      expect(result.applied).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('preserves multiline content and whitespace', () => {
      const content = '  function greeting() {\n    return "שלום";\n  }'
      const mods = [{ search: 'return "שלום"', replace: 'return "היי"' }]
      const result = applyModifications(content, mods)
      expect(result.modified).toContain('return "היי"')
      expect(result.modified).toContain('  function greeting()') // indentation preserved
    })

    it('replaces only the first occurrence', () => {
      const content = 'abc abc abc'
      const mods = [{ search: 'abc', replace: 'xyz' }]
      const result = applyModifications(content, mods)
      expect(result.modified).toBe('xyz abc abc')
      expect(result.applied).toBe(1)
    })
  })
})
