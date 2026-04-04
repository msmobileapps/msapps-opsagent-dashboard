/**
 * Discovery module — generic lead/prospect discovery logic.
 * Each client can extend with their own sources.
 */

export function filterByHeat(items, heat) {
  return items.filter(item => item.heat === heat)
}

export function findStale(items, daysThreshold = 7) {
  const threshold = Date.now() - daysThreshold * 24 * 3600 * 1000
  return items.filter(item => {
    if (!item.lastContactAt) return true
    return new Date(item.lastContactAt).getTime() < threshold
  })
}

export function prioritize(items) {
  const heatOrder = { hot: 0, warm: 1, cold: 2 }
  return [...items].sort((a, b) => {
    const heatDiff = (heatOrder[a.heat] ?? 3) - (heatOrder[b.heat] ?? 3)
    if (heatDiff !== 0) return heatDiff
    // Within same heat, sort by last contact (oldest first = needs attention)
    const aTime = a.lastContactAt ? new Date(a.lastContactAt).getTime() : 0
    const bTime = b.lastContactAt ? new Date(b.lastContactAt).getTime() : 0
    return aTime - bTime
  })
}
