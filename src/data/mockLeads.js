/**
 * Mock lead data for the lead pipeline dashboard.
 * In production, this comes from Google Calendar events + agent output.
 */
export const LEADS = [
  { id: 1, name: 'TechVision AI', contact: 'Dan Cohen', industry: 'AI/ML Startup', budget: '$8-15k', status: 'Proposal sent', heat: 'hot', lastContact: '2 days ago', stage: 'proposal', source: 'LinkedIn' },
  { id: 2, name: 'CloudNine SaaS', contact: 'Sarah L.', industry: 'SaaS Platform', budget: '$5-10k', status: 'Meeting scheduled', heat: 'hot', lastContact: 'Today', stage: 'discovery', source: 'Referral' },
  { id: 3, name: 'FinEdge Solutions', contact: 'Yossi M.', industry: 'FinTech', budget: '$20k+', status: 'Technical review', heat: 'hot', lastContact: '1 day ago', stage: 'proposal', source: 'xplace' },
  { id: 4, name: 'GreenBot Agri', contact: 'Maya R.', industry: 'AgriTech', budget: '$3-5k', status: 'Initial call done', heat: 'warm', lastContact: '4 days ago', stage: 'lead', source: 'Website' },
  { id: 5, name: 'Urban Mobility Co', contact: 'Amit S.', industry: 'Transportation', budget: 'Unknown', status: 'Follow-up needed', heat: 'warm', lastContact: '6 days ago', stage: 'lead', source: 'LinkedIn' },
  { id: 6, name: 'HealthBridge', contact: 'Noa K.', industry: 'HealthTech', budget: '$10-15k', status: 'Proposal draft', heat: 'warm', lastContact: '3 days ago', stage: 'proposal', source: 'Conference' },
  { id: 7, name: 'EduSpark Ltd', contact: 'Ran B.', industry: 'EdTech', budget: '$2-4k', status: 'Exploring options', heat: 'cold', lastContact: '10 days ago', stage: 'lead', source: 'Cold outreach' },
  { id: 8, name: 'RetailBoost', contact: 'Lior H.', industry: 'E-commerce', budget: '$5k', status: 'Budget review', heat: 'cold', lastContact: '8 days ago', stage: 'lead', source: 'LinkedIn' },
]

export const PIPELINE_STAGES = [
  { label: 'Lead', count: 4, color: 'var(--text-muted)' },
  { label: 'Discovery', count: 1, color: 'var(--brand-400)' },
  { label: 'Proposal', count: 3, color: 'var(--warning)' },
  { label: 'Negotiation', count: 0, color: 'var(--accent-400)' },
  { label: 'Closed', count: 0, color: 'var(--success)' },
]

export const ACTIVITY = [
  { agent: 'Lead Pipeline', text: 'Daily briefing generated — 3 hot leads flagged for immediate follow-up', time: '8:04 AM', color: 'var(--brand-400)' },
  { agent: 'Lead Pipeline', text: 'FinEdge Solutions moved to HOT — $20k+ budget, technical review stage', time: '8:03 AM', color: 'var(--danger)' },
  { agent: 'Lead Pipeline', text: 'Urban Mobility Co flagged STALE — no contact in 6 days', time: '8:02 AM', color: 'var(--warning)' },
  { agent: 'Lead Pipeline', text: 'CloudNine SaaS meeting confirmed for today at 2pm', time: '8:01 AM', color: 'var(--accent-400)' },
  { agent: 'Lead Pipeline', text: 'Email report sent to michal@msapps.mobi with pipeline summary', time: '8:00 AM', color: 'var(--text-secondary)' },
]
