import React from 'react'
import { LEADS, PIPELINE_STAGES, ACTIVITY } from '../data/mockLeads'
import { Target, Users, TrendingUp, AlertTriangle, Clock, Zap, ArrowRight } from 'lucide-react'

function StatCard({ label, value, sublabel, tone, icon: Icon }) {
  const tones = {
    brand:  'from-[var(--brand-500)]/15 via-[var(--brand-400)]/5 to-transparent',
    accent: 'from-[var(--accent-500)]/15 via-[var(--accent-400)]/5 to-transparent',
    blue:   'from-sky-400/15 via-indigo-400/5 to-transparent',
    violet: 'from-violet-400/15 via-fuchsia-400/5 to-transparent',
    amber:  'from-amber-400/15 via-amber-300/5 to-transparent',
  }

  return (
    <div className="surface-panel relative overflow-hidden rounded-xl p-5">
      <div className={`absolute inset-0 bg-gradient-to-br ${tones[tone] || tones.brand}`} />
      <div className="absolute inset-x-0 top-0 h-px bg-white/8" />
      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
            <p className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-white">{value}</p>
          </div>
          <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--brand-500)]/10 p-2.5 text-[var(--brand-400)]">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {sublabel && <p className="text-sm text-[var(--text-secondary)]">{sublabel}</p>}
      </div>
    </div>
  )
}

function PipelineBar() {
  return (
    <div className="flex gap-1">
      {PIPELINE_STAGES.map(stage => (
        <div
          key={stage.label}
          className="flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3 text-center"
        >
          <p className="text-xl font-extrabold" style={{ color: stage.color }}>{stage.count}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{stage.label}</p>
        </div>
      ))}
    </div>
  )
}

function LeadRow({ lead, onClick }) {
  const heatColors = {
    hot: 'bg-red-400',
    warm: 'bg-amber-300',
    cold: 'bg-slate-400',
  }

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--brand-500)]/30"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${heatColors[lead.heat]}`} />
          <p className="truncate text-sm font-semibold text-white">{lead.name}</p>
          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-bold uppercase text-white/70">
            {lead.heat}
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{lead.contact} · {lead.industry}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold text-[var(--accent-400)]">{lead.budget}</p>
        <p className="text-[11px] text-[var(--text-muted)]">{lead.lastContact}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
    </button>
  )
}

function ActivityFeed() {
  return (
    <div className="space-y-0">
      {ACTIVITY.map((item, i) => (
        <div key={i} className="flex gap-3 py-3 border-b border-[var(--surface-border)] last:border-b-0">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: item.color }}>{item.agent}</p>
            <p className="mt-0.5 text-sm leading-6 text-[var(--text-primary)]">{item.text}</p>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{item.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ store }) {
  const { identity, openTask, tasks } = store
  const hotLeads = LEADS.filter(l => l.heat === 'hot')
  const warmLeads = LEADS.filter(l => l.heat === 'warm')
  const staleLeads = LEADS.filter(l => l.heat === 'cold')
  const leadPipelineTask = tasks.find(t => t.taskId === 'lead-pipeline-daily')

  return (
    <div className="animate-fade-in pb-10">
      {/* Hero */}
      <section className="surface-panel-strong rounded-xl px-6 py-6 md:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="section-kicker">Operations Overview</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-white md:text-4xl">
              {identity.clientName} AI ops cockpit for leads, outreach, and operations.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              OpsAgent runs your lead pipeline daily — scanning Google Calendar, prioritizing leads, flagging follow-ups, and delivering actionable briefings.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <div className="live-pill">
              <span className="live-dot" />
              <span>Lead pipeline active</span>
            </div>
            <p className="text-sm text-[var(--text-muted)]">{identity.timezone} · {LEADS.length} leads tracked</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Active Leads" value={LEADS.length} sublabel={`${hotLeads.length} hot, ${warmLeads.length} warm`} tone="brand" icon={Target} />
        <StatCard label="Hot Pipeline" value={hotLeads.length} sublabel="Needs immediate follow-up" tone="amber" icon={TrendingUp} />
        <StatCard label="At Risk" value={staleLeads.length} sublabel="No contact in 7+ days" tone="violet" icon={AlertTriangle} />
        <StatCard label="Agents Running" value="1" sublabel="Lead Pipeline (daily, Sun-Thu)" tone="accent" icon={Zap} />
      </section>

      {/* Pipeline Bar */}
      <section className="mt-5">
        <PipelineBar />
      </section>

      {/* Main Grid */}
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Left Column */}
        <div className="space-y-5">
          {/* Hot Actions */}
          <div className="surface-panel rounded-xl p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="section-kicker">Hot Actions Today</p>
                <h3 className="mt-2 text-xl font-extrabold tracking-[-0.03em] text-white">Priority leads to act on now</h3>
              </div>
              <button
                onClick={() => leadPipelineTask && openTask(leadPipelineTask)}
                className="rounded-xl bg-[var(--brand-500)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--brand-600)]"
              >
                View full briefing
              </button>
            </div>
            <div className="space-y-2">
              {hotLeads.map(lead => (
                <div key={lead.id} className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{lead.name}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{lead.contact} · {lead.status}</p>
                    </div>
                    <span className="text-xs font-bold text-[var(--accent-400)]">{lead.budget}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Pipeline */}
          <div className="surface-panel rounded-xl p-5 md:p-6">
            <div className="mb-5">
              <p className="section-kicker">Full Pipeline</p>
              <h3 className="mt-2 text-xl font-extrabold tracking-[-0.03em] text-white">All active leads</h3>
            </div>
            <div className="space-y-2">
              {LEADS.map(lead => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onClick={() => leadPipelineTask && openTask(leadPipelineTask)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Agent Activity */}
          <div className="surface-panel rounded-xl p-5 md:p-6">
            <div className="mb-5">
              <p className="section-kicker">Agent Activity</p>
              <h3 className="mt-2 text-xl font-extrabold tracking-[-0.03em] text-white">Latest from Lead Pipeline</h3>
            </div>
            <ActivityFeed />
          </div>

          {/* Pipeline Health */}
          <div className="surface-panel rounded-xl p-5 md:p-6">
            <div className="mb-5">
              <p className="section-kicker">Pipeline Health</p>
              <h3 className="mt-2 text-xl font-extrabold tracking-[-0.03em] text-white">Heat distribution</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Hot', leads: hotLeads, color: '#f87171', emoji: '' },
                { label: 'Warm', leads: warmLeads, color: '#facc15', emoji: '' },
                { label: 'Cold / Stale', leads: staleLeads, color: '#60a5fa', emoji: '' },
              ].map(group => (
                <div key={group.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: group.color }}>{group.emoji} {group.label}</span>
                    <span className="text-sm font-bold" style={{ color: group.color }}>{group.leads.length}</span>
                  </div>
                  {group.leads.map(l => (
                    <p key={l.id} className="py-1 text-xs text-[var(--text-secondary)]">
                      {l.name} — {l.budget}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Next Run */}
          <div className="surface-panel rounded-xl p-5 md:p-6">
            <div className="mb-3">
              <p className="section-kicker">Schedule</p>
              <h3 className="mt-2 text-xl font-extrabold tracking-[-0.03em] text-white">Lead Pipeline agent</h3>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-[var(--brand-400)]" />
              <div>
                <p className="text-sm font-semibold text-white">Sun-Thu at 8:00 AM</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {leadPipelineTask?.lastRunAt
                    ? `Last run: ${new Date(leadPipelineTask.lastRunAt).toLocaleString('en-IL', { timeZone: 'Asia/Jerusalem' })}`
                    : 'Waiting for first run'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
