/**
 * Generic matching engine — scores and ranks items against criteria.
 * Used by SocialJet for influencer matching, MSApps for lead scoring.
 */

export function score(item, criteria = {}) {
  let total = 0
  let maxScore = 0

  for (const [key, weight] of Object.entries(criteria)) {
    maxScore += weight
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
      total += weight
    }
  }

  return maxScore > 0 ? Math.round((total / maxScore) * 100) : 0
}

export function rank(items, criteria = {}, options = {}) {
  const { limit = 50, minScore = 0 } = options

  return items
    .map(item => ({ ...item, _score: score(item, criteria) }))
    .filter(item => item._score >= minScore)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
}
