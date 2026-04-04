/**
 * Outreach module — generic outreach tracking and templating.
 */

export function buildOutreachRecord(contactId, method, status = 'sent') {
  return {
    contactId,
    method,
    status,
    sentAt: new Date().toISOString(),
  }
}

export function isFollowUpDue(record, daysSinceSent = 3) {
  if (!record.sentAt) return false
  const elapsed = Date.now() - new Date(record.sentAt).getTime()
  return elapsed > daysSinceSent * 24 * 3600 * 1000 && record.status === 'sent'
}
