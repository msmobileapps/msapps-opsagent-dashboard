/**
 * Scheduling utilities — cron parsing, next-run calculation.
 * Shared across all OpsAgent client dashboards.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function parseCron(expression) {
  if (!expression) return null
  const parts = expression.split(' ')
  if (parts.length < 5) return null

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  return { minute, hour, dayOfMonth, month, dayOfWeek }
}

export function buildSchedule(cronExpression) {
  const parsed = parseCron(cronExpression)
  if (!parsed) return 'Manual only'

  const { minute, hour, dayOfWeek } = parsed
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`

  if (dayOfWeek === '*') return `Daily at ${time}`
  if (dayOfWeek === '0-4') return `Sun-Thu at ${time}`
  if (dayOfWeek === '1-5') return `Mon-Fri at ${time}`

  const days = dayOfWeek.split(',').map(d => DAYS[parseInt(d)] || d).join(', ')
  return `${days} at ${time}`
}

export function nextRunTime(cronExpression, timezone = 'Asia/Jerusalem') {
  // Simplified — in production, use a proper cron library
  const parsed = parseCron(cronExpression)
  if (!parsed) return null

  const now = new Date()
  const next = new Date(now)
  next.setHours(parseInt(parsed.hour), parseInt(parsed.minute), 0, 0)

  if (next <= now) next.setDate(next.getDate() + 1)
  return next.toISOString()
}
