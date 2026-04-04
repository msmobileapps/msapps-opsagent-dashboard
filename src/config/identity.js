/**
 * MSApps client identity — all client-specific branding and config in one place.
 * When we add more clients, each gets their own identity file.
 */
export const identity = {
  clientId: 'msapps',
  clientName: 'MSApps',
  subtitle: 'AI Operations Platform',
  operatorName: 'Michal Shatz',
  operatorEmail: 'michal@msapps.mobi',
  operatorInitials: 'MS',
  timezone: 'Asia/Jerusalem',
  industry: 'Tech / AI Consulting',

  // Agents enabled for this client
  agents: [
    {
      id: 'lead-pipeline-daily',
      name: 'Lead Pipeline',
      description: 'Daily sales pipeline briefing — scans calendar, prioritizes leads, sends report via email, WhatsApp reminder',
      schedule: 'Sun-Thu 8:00 AM',
      cronExpression: '0 8 * * 0-4',
      icon: 'Target',
      color: 'brand',
    },
    // Future agents will be added here:
    // { id: 'linkedin-outreach-messages', name: 'LinkedIn Outreach', ... },
    // { id: 'receipts-collection', name: 'Receipts', ... },
    // { id: 'monthly-invoicing', name: 'Invoicing', ... },
  ],
}
