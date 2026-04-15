/**
 * fuzzy-match.js — Fuzzy search/replace matching for AI-generated modifications.
 *
 * AI models (especially smaller ones like gemma3:4b) often generate search strings
 * with subtle differences from the actual source: extra/missing whitespace, slightly
 * different indentation, trailing spaces, or partial line matches.
 *
 * This module provides a cascade of matching strategies:
 * 1. Exact match (fastest)
 * 2. Whitespace-normalized match (handles extra spaces, tabs, trailing whitespace)
 * 3. Line-by-line fuzzy match (handles partial/shifted matches)
 *
 * Also provides `findClosestMatch` for helpful error messages when all strategies fail.
 *
 * @example
 *   import { fuzzyMatch, findClosestMatch, validateModifications } from 'opsagent-core/trainer'
 *
 *   const result = fuzzyMatch(fileContent, searchString)
 *   if (result.matched) {
 *     const newContent = fileContent.slice(0, result.index)
 *       + replacement + fileContent.slice(result.index + result.matchLength)
 *   }
 */

/**
 * Normalize whitespace in text: collapse runs of spaces/tabs to single space,
 * trim each line, normalize line endings.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeWhitespace(text) {
  return text
    .replace(/\r\n/g, '\n')        // Normalize line endings
    .split('\n')
    .map(line => line.trim().replace(/\s+/g, ' '))
    .join('\n')
}

/**
 * @typedef {object} MatchResult
 * @property {boolean} matched    - Whether a match was found
 * @property {'exact'|'normalized'|'line-fuzzy'|null} strategy - Which strategy matched
 * @property {number} index       - Start index in original content (-1 if no match)
 * @property {number} matchLength - Length of matched substring in original content
 */

/**
 * Try to match a search string against file content using cascading strategies.
 *
 * Strategy cascade:
 * 1. **Exact** — `content.indexOf(search)`
 * 2. **Normalized** — Both sides whitespace-normalized, then map back to original position
 * 3. **Line-fuzzy** — Match search lines against content lines with whitespace tolerance
 *
 * @param {string} content - Full file content
 * @param {string} search  - Search string from AI
 * @returns {MatchResult}
 */
export function fuzzyMatch(content, search) {
  if (!content || !search) {
    return { matched: false, strategy: null, index: -1, matchLength: 0 }
  }

  // Strategy 1: Exact match
  const exactIdx = content.indexOf(search)
  if (exactIdx !== -1) {
    return { matched: true, strategy: 'exact', index: exactIdx, matchLength: search.length }
  }

  // Strategy 2: Whitespace-normalized match
  const normResult = normalizedMatch(content, search)
  if (normResult.matched) {
    return normResult
  }

  // Strategy 3: Line-by-line fuzzy match
  const lineResult = lineFuzzyMatch(content, search)
  if (lineResult.matched) {
    return lineResult
  }

  return { matched: false, strategy: null, index: -1, matchLength: 0 }
}

/**
 * Match after normalizing whitespace on both sides.
 * Maps the match position back to the original content.
 *
 * @param {string} content
 * @param {string} search
 * @returns {MatchResult}
 */
function normalizedMatch(content, search) {
  const normContent = normalizeWhitespace(content)
  const normSearch = normalizeWhitespace(search)

  const normIdx = normContent.indexOf(normSearch)
  if (normIdx === -1) {
    return { matched: false, strategy: null, index: -1, matchLength: 0 }
  }

  // Map normalized position back to original content position
  // Walk through original content, tracking normalized position
  const origStart = mapNormToOrig(content, normContent, normIdx)
  const normEnd = normIdx + normSearch.length
  const origEnd = mapNormToOrig(content, normContent, normEnd)

  if (origStart === -1 || origEnd === -1) {
    return { matched: false, strategy: null, index: -1, matchLength: 0 }
  }

  return {
    matched: true,
    strategy: 'normalized',
    index: origStart,
    matchLength: origEnd - origStart,
  }
}

/**
 * Map a position in normalized text back to the original text.
 * Walks character by character, skipping collapsed whitespace.
 *
 * @param {string} orig
 * @param {string} norm
 * @param {number} normPos
 * @returns {number} Position in original text, or -1 if mapping fails
 */
function mapNormToOrig(orig, norm, normPos) {
  const origLines = orig.replace(/\r\n/g, '\n').split('\n')
  const normLines = norm.split('\n')

  let origOffset = 0
  let normOffset = 0

  for (let i = 0; i < normLines.length; i++) {
    const origLine = origLines[i] || ''
    const normLine = normLines[i] || ''

    // If target is within this line (in normalized space)
    if (normPos >= normOffset && normPos <= normOffset + normLine.length) {
      const posInNormLine = normPos - normOffset
      // Map position within line: account for leading whitespace
      const leadingWs = origLine.length - origLine.trimStart().length
      if (posInNormLine === 0) {
        return origOffset + leadingWs
      }
      // Walk through the original line to find corresponding position
      return mapLinePosition(origLine, normLine, posInNormLine) + origOffset
    }

    normOffset += normLine.length + 1 // +1 for \n
    origOffset += origLine.length + 1
  }

  return -1
}

/**
 * Map a position within a normalized line back to the original line.
 *
 * @param {string} origLine
 * @param {string} normLine
 * @param {number} normPos
 * @returns {number}
 */
function mapLinePosition(origLine, normLine, normPos) {
  let oi = 0
  let ni = 0

  // Skip leading whitespace in original
  while (oi < origLine.length && /\s/.test(origLine[oi])) oi++

  while (ni < normPos && oi < origLine.length) {
    if (/\s/.test(origLine[oi])) {
      // In normalized, this is a single space
      ni++ // count the single space in norm
      oi++ // skip first ws char in orig
      // Skip remaining ws chars in orig
      while (oi < origLine.length && /\s/.test(origLine[oi])) oi++
    } else {
      ni++
      oi++
    }
  }

  return oi
}

/**
 * Line-by-line fuzzy matching.
 * Splits both content and search into lines, finds where the search lines
 * appear in content lines (with whitespace tolerance per line).
 *
 * @param {string} content
 * @param {string} search
 * @returns {MatchResult}
 */
function lineFuzzyMatch(content, search) {
  const contentLines = content.replace(/\r\n/g, '\n').split('\n')
  const searchLines = search.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim())

  if (searchLines.length === 0) {
    return { matched: false, strategy: null, index: -1, matchLength: 0 }
  }

  const normSearchLines = searchLines.map(l => l.trim().replace(/\s+/g, ' '))

  // Slide window of searchLines.length over contentLines
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let allMatch = true
    for (let j = 0; j < normSearchLines.length; j++) {
      const contentLineNorm = contentLines[i + j].trim().replace(/\s+/g, ' ')
      if (contentLineNorm !== normSearchLines[j]) {
        allMatch = false
        break
      }
    }

    if (allMatch) {
      // Calculate original positions
      let startIdx = 0
      for (let k = 0; k < i; k++) {
        startIdx += contentLines[k].length + 1 // +1 for \n
      }
      let endIdx = startIdx
      for (let k = i; k < i + searchLines.length; k++) {
        endIdx += contentLines[k].length + 1
      }
      // Don't include trailing \n
      endIdx -= 1

      return {
        matched: true,
        strategy: 'line-fuzzy',
        index: startIdx,
        matchLength: endIdx - startIdx,
      }
    }
  }

  return { matched: false, strategy: null, index: -1, matchLength: 0 }
}

/**
 * Find the closest matching substring in content for error display.
 * Uses a simple line-overlap scoring approach.
 *
 * @param {string} content - Full file content
 * @param {string} search  - Failed search string
 * @param {number} [contextLines=3] - Lines of context around best match
 * @returns {{ score: number, snippet: string, lineNumber: number } | null}
 */
export function findClosestMatch(content, search, contextLines = 3) {
  if (!content || !search) return null

  const contentLines = content.replace(/\r\n/g, '\n').split('\n')
  const searchLines = search.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim())

  if (searchLines.length === 0) return null

  const normSearchLines = searchLines.map(l => l.trim().replace(/\s+/g, ' ').toLowerCase())

  let bestScore = 0
  let bestLineIdx = 0

  // Score each position
  for (let i = 0; i <= contentLines.length - 1; i++) {
    let score = 0
    for (let j = 0; j < normSearchLines.length && (i + j) < contentLines.length; j++) {
      const contentLineNorm = contentLines[i + j].trim().replace(/\s+/g, ' ').toLowerCase()
      if (contentLineNorm === normSearchLines[j]) {
        score += 2 // exact line match (normalized)
      } else if (contentLineNorm.includes(normSearchLines[j]) || normSearchLines[j].includes(contentLineNorm)) {
        score += 1 // partial line match
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestLineIdx = i
    }
  }

  if (bestScore === 0) return null

  // Extract snippet with context
  const start = Math.max(0, bestLineIdx - contextLines)
  const end = Math.min(contentLines.length, bestLineIdx + searchLines.length + contextLines)
  const snippet = contentLines.slice(start, end).join('\n')

  return {
    score: bestScore / (normSearchLines.length * 2), // Normalize to 0-1
    snippet,
    lineNumber: bestLineIdx + 1, // 1-indexed
  }
}

/**
 * Validate modifications against file content without applying them.
 * Returns detailed match status per modification.
 *
 * @param {string} content - File content
 * @param {Array<{search: string, replace: string}>} mods - Modifications to validate
 * @returns {Array<{search: string, replace: string, matched: boolean, strategy: string|null, closestMatch: object|null}>}
 */
export function validateModifications(content, mods) {
  return mods.map(mod => {
    const result = fuzzyMatch(content, mod.search)

    return {
      search: mod.search,
      replace: mod.replace,
      matched: result.matched,
      strategy: result.strategy,
      closestMatch: result.matched ? null : findClosestMatch(content, mod.search),
    }
  })
}
