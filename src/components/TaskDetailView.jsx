import React, { useState, useEffect } from 'react'
import { ArrowLeft, Play, Clock, CheckCircle, AlertTriangle, FileText, RefreshCw, Calendar, Mail, MessageSquare } from 'lucide-react'
import { triggerTask, fetchTaskOutput } from '../services/api'
import { LEADS } from '../data/mockLeads'

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

function LeadTable({ leads }) {
  const heatBadge = {
    hot: 'border-red-500/30 bg-red-500/15 text-red-300',
    warm: 'border-amber-400/30 bg-amber-400/15 text-amber-200',
    cold: 'border-slate-500/30 bg-slate-500/15 text-slate-300',
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-[var(--surface-border)]">
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Lead</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Contact</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Industry</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Budget</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Status</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Heat</th>
            <th className="pb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Last Contact</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.id} className="border-b border-[var(--surface-border)]/50 transition hover:bg-white/[0.02]">
              <td className="py-3 text-sm font-semibold text-white">{lead.name}</td>
              <td className="py-3 text-sm text-[var(--text-secondary)]">{lead.contact}</td>
              <td className="py-3 text-sm text-[var(--text-secondary)]">{lead.industry}</td>
              <td className="py-3 text-sm font-semibold text-[var(--accent-400)]">{lead.budget}</td>
              <td className="py-3 text-sm text-[var(--text-secondary)]">{lead.status}</td>
              <td className="py-3">
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${heatBadge[lead.heat]}`}>
                  {lead.heat}
                </span>
              </td>
              <td className="py-3 text-sm text-[var(--text-muted)]">{lead.lastContact}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TaskDetailView({ store }) {
  const { selectedTask, goBack, identity, taskOutputs, loadTaskOutput, addNotification } = store
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
      // Poll for output after a delay
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
              { icon: FileText, label: 'Total Leads', value: LEADS.length, color: 'var(--text-primary)' },
              { icon: AlertTriangle, label: 'Hot Leads', value: LEADS.filter(l => l.heat === 'hot').length, color: 'var(--danger)' },
              { icon: Mail, label: 'Reports Sent', value: task.lastRunAt ? '1 today' : '0', color: 'var(--accent-400)' },
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
          <section className="mt-5 surface-panel rounded-xl p-5 md:p-6">
            <p className="section-kicker">Execution Flow</p>
            <h3 className="mt-2 mb-5 text-xl font-extrabold tracking-[-0.03em] text-white">What this agent does each run</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {[
                { step: '01', title: 'Scan Calendar', body: 'Reads Google Calendar events for lead status, meetings, and follow-up dates.' },
                { step: '02', title: 'Prioritize', body: 'Ranks leads by urgency, deal size, and days since last contact.' },
                { step: '03', title: 'Flag Actions', body: 'Generates specific next steps for hot leads and stale opportunities.' },
                { step: '04', title: 'Email Report', body: 'Sends morning briefing to michal@msapps.mobi via Zoho Mail.' },
                { step: '05', title: 'WhatsApp Ping', body: 'Sends a quick summary reminder via WhatsApp.' },
              ].map(item => (
                <div key={item.step} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--brand-400)]">{item.step}</p>
                  <h4 className="mt-2 text-base font-bold text-white">{item.title}</h4>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Lead Table */}
          <section className="mt-5 surface-panel rounded-xl p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="section-kicker">Pipeline Data</p>
                <h3 className="mt-2 text-xl font-extrabold tracking-[-0.03em] text-white">All tracked leads</h3>
              </div>
              <span className="rounded-full border border-[var(--brand-500)]/20 bg-[var(--brand-500)]/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand-300)]">
                {LEADS.length} leads
              </span>
            </div>
            <LeadTable leads={LEADS} />
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
