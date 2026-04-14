import { describe, expect, it } from 'vitest'
import { extractJson, parseModifications } from './response-parser.js'

describe('response-parser', () => {
  describe('extractJson', () => {
    it('extracts from ```json fences', () => {
      const raw = 'Some text\n```json\n{"key": "value"}\n```\nMore text'
      expect(extractJson(raw)).toBe('{"key": "value"}')
    })

    it('extracts from generic ``` fences', () => {
      const raw = '```\n{"key": "value"}\n```'
      expect(extractJson(raw)).toBe('{"key": "value"}')
    })

    it('extracts raw JSON from mixed text', () => {
      const raw = 'Here is the result: {"key": "value"} done.'
      expect(extractJson(raw)).toBe('{"key": "value"}')
    })

    it('handles multiline JSON in fences', () => {
      const raw = '```json\n{\n  "summary_he": "test",\n  "modifications": []\n}\n```'
      const result = JSON.parse(extractJson(raw))
      expect(result.summary_he).toBe('test')
    })

    it('returns raw text when no JSON found', () => {
      expect(extractJson('no json here')).toBe('no json here')
    })
  })

  describe('parseModifications', () => {
    it('parses valid trainer response', () => {
      const raw = JSON.stringify({
        summary_he: 'עדכון',
        summary_en: 'Update',
        modifications: [
          { file: 'index.html', search: 'old text', replace: 'new text' },
        ],
      })
      const result = parseModifications(raw)
      expect(result.summary_he).toBe('עדכון')
      expect(result.summary_en).toBe('Update')
      expect(result.modifications).toHaveLength(1)
      expect(result.modifications[0]).toEqual({
        file: 'index.html',
        search: 'old text',
        replace: 'new text',
      })
    })

    it('handles response with no modifications', () => {
      const raw = JSON.stringify({ summary_he: 'אין שינויים' })
      const result = parseModifications(raw)
      expect(result.modifications).toHaveLength(0)
    })

    it('handles response wrapped in markdown fences', () => {
      const raw = '```json\n{"summary_he": "test", "modifications": [{"file": "a.js", "search": "x", "replace": "y"}]}\n```'
      const result = parseModifications(raw)
      expect(result.modifications).toHaveLength(1)
    })

    it('throws on empty input', () => {
      expect(() => parseModifications('')).toThrow('empty response')
    })

    it('throws on invalid JSON', () => {
      expect(() => parseModifications('not json at all {')).toThrow('Failed to parse')
    })

    it('throws on modification missing file', () => {
      const raw = JSON.stringify({
        modifications: [{ search: 'x', replace: 'y' }],
      })
      expect(() => parseModifications(raw)).toThrow('missing "file"')
    })

    it('throws on modification missing search', () => {
      const raw = JSON.stringify({
        modifications: [{ file: 'a.js', replace: 'y' }],
      })
      expect(() => parseModifications(raw)).toThrow('missing "search"')
    })

    it('throws on modification missing replace', () => {
      const raw = JSON.stringify({
        modifications: [{ file: 'a.js', search: 'x' }],
      })
      expect(() => parseModifications(raw)).toThrow('missing "replace"')
    })

    it('accepts empty string as valid replace value', () => {
      const raw = JSON.stringify({
        modifications: [{ file: 'a.js', search: 'remove me', replace: '' }],
      })
      const result = parseModifications(raw)
      expect(result.modifications[0].replace).toBe('')
    })
  })
})
