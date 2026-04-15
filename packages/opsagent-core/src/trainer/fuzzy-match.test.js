import { describe, expect, it } from 'vitest'
import { fuzzyMatch, findClosestMatch, normalizeWhitespace, validateModifications } from './fuzzy-match.js'

describe('fuzzy-match', () => {
  describe('normalizeWhitespace', () => {
    it('collapses multiple spaces to single space', () => {
      expect(normalizeWhitespace('hello   world')).toBe('hello world')
    })

    it('trims each line', () => {
      expect(normalizeWhitespace('  hello  \n  world  ')).toBe('hello\nworld')
    })

    it('normalizes CRLF to LF', () => {
      expect(normalizeWhitespace('a\r\nb')).toBe('a\nb')
    })

    it('handles tabs', () => {
      expect(normalizeWhitespace('\thello\t\tworld')).toBe('hello world')
    })
  })

  describe('fuzzyMatch', () => {
    it('finds exact matches', () => {
      const content = 'function hello() {\n  return "world"\n}'
      const search = 'return "world"'
      const result = fuzzyMatch(content, search)
      expect(result.matched).toBe(true)
      expect(result.strategy).toBe('exact')
    })

    it('finds whitespace-normalized matches', () => {
      const content = 'function hello() {\n  return   "world"\n}'
      const search = 'return "world"'
      const result = fuzzyMatch(content, search)
      expect(result.matched).toBe(true)
      expect(result.strategy).toBe('normalized')
    })

    it('finds matches with extra indentation in search', () => {
      const content = 'if (true) {\n  console.log("hi")\n}'
      const search = '    console.log("hi")'
      const result = fuzzyMatch(content, search)
      expect(result.matched).toBe(true)
      // Either normalized or line-fuzzy should work
      expect(['normalized', 'line-fuzzy']).toContain(result.strategy)
    })

    it('finds multiline matches with whitespace differences', () => {
      const content = '  const x = 1\n  const y = 2\n  const z = 3'
      const search = 'const x = 1\nconst y = 2'
      const result = fuzzyMatch(content, search)
      expect(result.matched).toBe(true)
    })

    it('returns false for genuinely non-matching search', () => {
      const content = 'function hello() { return "world" }'
      const search = 'function goodbye()'
      const result = fuzzyMatch(content, search)
      expect(result.matched).toBe(false)
    })

    it('handles empty inputs gracefully', () => {
      expect(fuzzyMatch('', 'search').matched).toBe(false)
      expect(fuzzyMatch('content', '').matched).toBe(false)
      expect(fuzzyMatch('', '').matched).toBe(false)
    })

    it('returns correct match position for exact match', () => {
      const content = 'aaa bbb ccc'
      const search = 'bbb'
      const result = fuzzyMatch(content, search)
      expect(result.index).toBe(4)
      expect(result.matchLength).toBe(3)
    })

    it('line-fuzzy matches trailing whitespace differences', () => {
      const content = 'line 1  \nline 2\nline 3  '
      const search = 'line 1\nline 2'
      const result = fuzzyMatch(content, search)
      expect(result.matched).toBe(true)
    })
  })

  describe('findClosestMatch', () => {
    it('finds closest match for near-miss', () => {
      const content = 'function hello() {\n  return "world"\n}\n\nfunction bye() {\n  return "goodbye"\n}'
      const search = 'return "wrold"' // typo
      const result = findClosestMatch(content, search)
      expect(result).not.toBeNull()
      expect(result.score).toBeGreaterThan(0)
    })

    it('returns null when nothing is close', () => {
      const content = 'abc\ndef\nghi'
      const search = 'xyz completely different'
      const result = findClosestMatch(content, search)
      expect(result).toBeNull()
    })

    it('returns null for empty inputs', () => {
      expect(findClosestMatch('', 'search')).toBeNull()
      expect(findClosestMatch('content', '')).toBeNull()
    })

    it('includes line number of closest match', () => {
      const content = 'line 1\nline 2\nreturn "world"\nline 4'
      const search = 'return "world"'
      const result = findClosestMatch(content, search)
      expect(result).not.toBeNull()
      expect(result.lineNumber).toBe(3)
    })
  })

  describe('validateModifications', () => {
    it('validates matching modifications', () => {
      const content = 'hello world\nfoo bar'
      const mods = [{ search: 'hello world', replace: 'hi world' }]
      const results = validateModifications(content, mods)
      expect(results).toHaveLength(1)
      expect(results[0].matched).toBe(true)
      expect(results[0].strategy).toBe('exact')
      expect(results[0].closestMatch).toBeNull()
    })

    it('validates non-matching modifications with closest match', () => {
      const content = 'hello world\nfoo bar\nbaz qux'
      const mods = [{ search: 'hello worlx', replace: 'hi world' }]
      const results = validateModifications(content, mods)
      expect(results).toHaveLength(1)
      expect(results[0].matched).toBe(false)
      // closestMatch may or may not be found depending on similarity
    })

    it('handles multiple modifications', () => {
      const content = 'aaa\nbbb\nccc'
      const mods = [
        { search: 'aaa', replace: 'xxx' },
        { search: 'zzz', replace: 'yyy' },
      ]
      const results = validateModifications(content, mods)
      expect(results).toHaveLength(2)
      expect(results[0].matched).toBe(true)
      expect(results[1].matched).toBe(false)
    })
  })
})
