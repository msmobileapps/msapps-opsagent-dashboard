import React, { useState, useEffect } from 'react'
import { ArrowLeft, Play, Clock, CheckCircle, AlertTriangle, FileText, RefreshCw, Calendar, Mail, Inbox, ExternalLink } from 'lucide-react'
import { triggerTask, fetchTaskOutput } from '../services/api'
import { getPipelineStats, getStaleLeads } from 'opsagent-core/state'

function StatusBadge({ enabled, lastRunAt }) {
  if (!lastRunAt) {
    return <span className="status-badge bg-slate-500/15 text-slate-400">Never run</span>
  }
  const ago = Date.now() - new Date(lastRunAt).getTime()
  const hours = Math.floor(ago / 3600000)

  if (hours < 24) {
    return <span className="status-badge bg-[var(--accent-500)]/15 text-[var(--accent-400)]"><CheckCircle className="h-3 w-3" /> Ran {hours}h ago</span>
  }
  if (hours < 72) {
    return <span className="status-badge bg-amber-400/15 text-amber-300"><Clock className="h-3 w-3" /> {hours}h since last run</span>
  }
  return <span className="status-badge bg-red-400/15 text-red-300"><AlertTriangle className="h-3 w-3" /> Stale ({Math.floor(hours/24)}d)</span>
}

function OutputSection({ title, content }) {
  if (!content) return null
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-5">
      <h4 className="mb-3 text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--brand-400)]">{title}</h4>
      <div className="prose prose-invert prose-sm max-w-none text-sm leading-7 text-[var(--text-primary)]">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-7">{content}</pre>
      </div>
    </div>
  )
}

function daysSinceContact(lead) {
  if (!lead.lastContactAt) return 'No contact'
  const days = Math.floor((Date.now() - new Date(lead.lastContactAt).getTime()) / (24 * 3600 * 1000))
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

function formatValue(v) {
  if (!v) return '-'
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
  return `$${v}`
}

function LeadTable({ leads }) {
  const stageBadge = {
    new: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
    contacted: 'border-violet-400/30 bg-violet-400/15 text-violet-200',
    discovery: 'border-amber-400/30 bg-amber-400/15 text-amber-200',
    proposal: 'border-orange-400/30 bg-orange-400/15 text-orange-200',
    negotiation: 'border-red-500/30 bg-red-500/15 text-red-300',
    won: 'border-green-500/30 bg-green-500/15 text-green-300',
    lost: 'border-slate-500/30 bg-slate-500/15 text-slate-400',
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Inbox className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
        <p className="mt-3 text-sm text-[var(--text-secondary)]">No leads in pipeline yet</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Run the agent or add leads manually to see them here</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-[var(--surface-border)]">
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Lead</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Company</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Source</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Value</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Stage</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Last Contact</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Next Action</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">GCal</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.id} className="border-b border-[var(--surface-border)]/50 transition hover:bg-white/[0.02]">
              <td className="py-3 text-sm font-semibold text-white">{lead.name}</td>
              <td className="py-3 text-sm text-[var(--text-secondary)]">{lead.company || '-'}</td>
              <td className="py-3 text-sm text-[var(--text-secondary)]">{lead.source || '-'}</td>
              <td className="py-3 text-sm font-semibold text-[var(--accent-400)]">{formatValue(lead.dealValue)}</td>
              <td className="py-3">
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${stageBadge[lead.stage] || stageBadge.new}`}>
                  {lead.stage}
                </span>
              </td>
              <td className="py-3 text-sm text-[var(--text-muted)]">{daysSinceContact(lead)}</td>
              <td className="py-3 text-sm text-[var(--text-secondary)]">{lead.nextAction || '-'}</td>
              <td className="py-3">
                {lead.gcalEventUrl ? (
                  <a
                    href={lead.gcalEventUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[11px] font-bold text-sky-300 transition hover:bg-sky-500/20"
                  >
                    <Calendar className="h-3 w-3" />
                    Event
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TaskDetailView({ store }) {
  const { selectedTask, goBack, identity, taskOutputs, loadTaskOutput, addNotification, leads } = store
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState(null)

  const task = selectedTask
  const taskId = task?.taskId

  useEffect(() => {
    if (taskId && taskOutputs[taskId]) {
      setOutput(taskOutputs[taskId])
    }
  }, [taskId, taskOutputs])

  const handleRunNow = async () => {
    setRunning(true)
    addNotification(`Triggering ${task.name || taskId}...`, 'info')
    const result = await triggerTask(taskId)
    if (result.success !== false) {
      addNotification('Task triggered! Output will appear shortly.', 'success')
      setTimeout(() => loadTaskOutput(taskId), 5000)
    } else {
      addNotification(`Failed to trigger: ${result.error}`, 'error')
    }
    setRunning(false)
  }

  const handleRefreshOutput = async () => {
    const result = await loadTaskOutput(taskId)
    if (result) {
      setOutput(result)
      addNotification('Output refreshed', 'success')
    }
  }

  const isLeadPipeline = taskId === 'lead-pipeline-daily'
  const stats = getPipelineStats(leads)
  const staleLeads = getStaleLeads(leads, 7)
  const steps = task?.steps || []

  return (
    <div className="animate-fade-in pb-10">
      {/* Back nav */}
      <button
        onClick={goBack}
        className="mb-5 flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to overview
      </button>

      {/* Task Header */}
      <section className="surface-panel-strong rounded-xl px-6 py-6 md:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="section-kicker">Task Detail</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-white">
              {task.name || taskId}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              {task.description || 'No description available'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusBadge enabled={task.enabled} lastRunAt={task.lastRunAt} />
              {task.schedule && (
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Clock className="h-3 w-3" /> {task.schedule}
                </span>
              )}
              {task.cronExpression && (
                <span className="rounded border border-[var(--surface-border)] bg-[var(--surface-overlay)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                  {task.cronExpression}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRunNow}
              disabled={running}
              className="flex items-center gap-2 rounded-xl bg-[var(--brand-500)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--brand-600)] disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {running ? 'Running...' : 'Run Now'}
            </button>
            <button
              onClick={handleRefreshOutput}
              className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-overlay)] px-4 py-3 text-sm font-bold text-[var(--text-secondary)] transition hover:bg-[var(--surface-overlay)]/80"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {/* Lead Pipeline Specific Content */}
      {isLeadPipeline && (
        <>
          {/* Quick Stats */}
          <section className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              { icon: Calendar, label: 'Next Run', value: task.nextRunAt ? new Date(task.nextRunAt).toLocaleString('en-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', weekday: 'short' }) : 'Pending', color: 'var(--brand-400)' },
              { icon: FileText, label: 'Total Leads', value: stats.total, color: 'var(--text-primary)' },
              { icon: AlertTriangle, label: 'At Risk', value: staleLeads.length, color: 'var(--danger)' },
              { icon: Mail, label: 'Pipeline Value', value: formatValue(stats.totalValue), color: 'var(--accent-400)' },
            ].map(stat => (
              <div key={stat.label} className="surface-panel rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">{stat.label}</p>
                </div>
                <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em]" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </section>

          {/* Workflow Steps */}
          {steps.length > 0 && (
            <section className="mt-5 surface-panel rounded-xl p-5 md:p-6">
              <p className="section-kicker">Execution Flow</p>
              <h3 className="mt-2 mb-5 text-xl font-extrabold tracking-[-0.03em] text-white">What this agent does each run</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {steps.map(item => (
                  <div key={item.step} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--brand-400)]">{item.step}</p>
                    <h4 className="mt-2 text-base font-bold text-white">{item.title}</h4>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Lead Table */}
          <section className="mt-5 surface-panel rounded-xl p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="section-kicker">Pipeline Data</p>
                <h3 className="mt-2 text-xl font-extrabold tracking-[-0.03em] text-white">All tracked leads</h3>
              </div>
              {leads.length > 0 && (
                <span className="rounded-full border border-[var(--brand-500)]/20 bg-[var(--brand-500)]/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand-300)]">
                  {leads.length} leads
                </span>
              )}
            </div>
            <LeadTable leads={leads} />
          </section>
        </>
      )}

      {/* Agent Output */}
      <section className="mt-5 surface-panel rounded-xl p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="section-kicker">Last Output</p>
            <h3 className="mt-2 text-xl font-extrabold tracking-[-0.03em] text-white">Most recent agent briefing</h3>
          </div>
          {task.lastRunAt && (
            <p className="text-xs text-[var(--text-muted)]">
              {new Date(task.lastRunAt).toLocaleString('en-IL', { timeZone: 'Asia/Jerusalem' })}
            </p>
          )}
        </div>
        {output?.files ? (
          Object.entries(output.files).map(([filename, content]) => (
            <OutputSection key={filename} title={filename} content={content} />
          ))
        ) : (
          <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-6 text-center">
            <FileText className="mx-auto h-8 w-8 text-[var(--text-muted)] opacity-50" />
            <p className="mt-3 text-sm text-[var(--text-secondary)]">No output available yet</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Run the task or wait for the next scheduled execution</p>
          </div>
        )}
      </section>
    </div>
  )
}
