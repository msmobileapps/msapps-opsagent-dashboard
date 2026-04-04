/**
 * Scheduling utilities — cron parsing, human-readable formatting, next-run calculation.
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

/**
 * Check if a cron schedule should fire now.
 */
export function isScheduleActive(cronExpression, timezone = 'Asia/Jerusalem') {
  const parsed = parseCron(cronExpression)
  if (!parsed) return false

  const now = new Date()
  const hour = parseInt(parsed.hour)
  const minute = parseInt(parsed.minute)

  // Check if current time matches the cron expression
  // This is a simplified check — assumes current minute/hour within ~1 min window
  return now.getHours() === hour && now.getMinutes() === minute
}

/**
 * Get human-readable schedule description.
 */
export function humanReadableSchedule(cronExpression) {
  return buildSchedule(cronExpression)
}

/**
 * Get the next N run dates for a cron expression.
 */
export function getNextRuns(cronExpression, count = 5, timezone = 'Asia/Jerusalem') {
  const parsed = parseCron(cronExpression)
  if (!parsed) return []

  const runs = []
  const hour = parseInt(parsed.hour)
  const minute = parseInt(parsed.minute)
  const dayOfWeek = parsed.dayOfWeek

  // Parse day-of-week spec
  const allowedDays = parseDayOfWeek(dayOfWeek)

  let current = new Date()
  // Reset to start of today
  current.setHours(hour, minute, 0, 0)

  // If we've already passed the run time today, start from tomorrow
  if (current <= new Date()) {
    current.setDate(current.getDate() + 1)
  }

  while (runs.length < count) {
    const dow = current.getDay()
    if (allowedDays.includes(dow)) {
      runs.push(current.toISOString())
    }
    current.setDate(current.getDate() + 1)
  }

  return runs
}

// Helper: parse day-of-week specification
function parseDayOfWeek(spec) {
  if (spec === '*') return [0, 1, 2, 3, 4, 5, 6]
  if (spec === '0-4') return [0, 1, 2, 3, 4]
  if (spec === '1-5') return [1, 2, 3, 4, 5]

  const days = []
  for (const part of spec.split(',')) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number)
      for (let i = start; i <= end; i++) {
        days.push(i)
      }
    } else {
      days.push(Number(part))
    }
  }
  return days
}
