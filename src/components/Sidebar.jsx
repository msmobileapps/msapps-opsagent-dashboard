import React from 'react'
import { Target, LayoutDashboard, Zap, Settings, Activity } from 'lucide-react'

function NavItem({ icon: Icon, label, meta, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`group w-full rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 ${
        active
          ? 'border-[var(--brand-400)]/18 bg-[var(--brand-400)]/[0.08] text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]'
          : 'border-transparent bg-transparent text-slate-400 hover:border-slate-700/70 hover:bg-white/[0.03] hover:text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`${active ? 'text-[var(--brand-400)]' : 'text-slate-500 group-hover:text-slate-200'}`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{label}</span>
            {badge > 0 && (
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                {badge}
              </span>
            )}
          </div>
          {meta && <p className="mt-0.5 truncate text-[11px] text-slate-500">{meta}</p>}
        </div>
      </div>
    </button>
  )
}

export default function Sidebar({ store }) {
  const { identity, view, setView, setSelectedTask, tasks } = store

  const enabledTasks = tasks.filter(t => t.enabled)

  return (
    <aside className="app-sidebar hidden h-screen w-[300px] shrink-0 border-r border-white/6 lg:flex lg:flex-col">
      {/* Brand Header */}
      <div className="border-b border-white/6 px-6 py-6">
        <div className="surface-panel-strong rounded-[28px] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--brand-500),var(--accent-500))] shadow-[0_16px_40px_rgba(108,58,237,0.25)]">
              <Zap className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="section-kicker">{identity.clientName} Ops</p>
              <h1 className="text-lg font-extrabold tracking-tight text-white">OpsAgent</h1>
              <p className="text-xs text-slate-400">{identity.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-2">
          <NavItem
            icon={LayoutDashboard}
            label="Operations Overview"
            meta="Active tasks, pipeline status, and agent health"
            active={view === 'dashboard'}
            onClick={() => { setView('dashboard'); setSelectedTask(null) }}
          />
        </div>

        {/* Agent Tasks */}
        <div className="mt-7">
          <p className="sidebar-section-label px-2">Agent Tasks</p>
          <div className="mt-3 space-y-2">
            {identity.agents.map(agent => {
              const task = tasks.find(t => t.taskId === agent.id)
              const isSelected = view === 'task-detail' && store.selectedTask?.taskId === agent.id
              return (
                <NavItem
                  key={agent.id}
                  icon={Target}
                  label={agent.name}
                  meta={agent.schedule}
                  active={isSelected}
                  onClick={() => {
                    if (task) {
                      store.openTask(task)
                    } else {
                      store.openTask({ taskId: agent.id, description: agent.description, ...agent })
                    }
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* Other Scheduled Tasks */}
        {enabledTasks.filter(t => !identity.agents.some(a => a.id === t.taskId)).length > 0 && (
          <div className="mt-7">
            <p className="sidebar-section-label px-2">Other Tasks</p>
            <div className="mt-3 space-y-2">
              {enabledTasks
                .filter(t => !identity.agents.some(a => a.id === t.taskId))
                .slice(0, 5)
                .map(task => (
                  <NavItem
                    key={task.taskId}
                    icon={Activity}
                    label={task.description?.slice(0, 30) || task.taskId}
                    meta={task.schedule || 'Manual'}
                    active={view === 'task-detail' && store.selectedTask?.taskId === task.taskId}
                    onClick={() => store.openTask(task)}
                  />
                ))}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="space-y-3 border-t border-white/6 px-4 py-4">
        <div className="surface-panel rounded-3xl p-4">
          <div className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: store.connected ? '#4ade80' : '#fbbf24',
                boxShadow: store.connected ? '0 0 12px rgba(74, 222, 128, 0.5)' : '0 0 12px rgba(251, 191, 36, 0.45)',
              }}
            />
            <span className="font-semibold text-slate-200">
              {store.connected ? 'API connected' : 'Offline mode'}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {enabledTasks.length} active tasks configured
          </p>
        </div>

        <div className="rounded-3xl border border-white/6 bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operator</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--brand-500),var(--accent-500))] text-sm font-extrabold text-white">
              {identity.operatorInitials}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{identity.operatorName}</p>
              <p className="text-xs text-slate-400">{identity.operatorEmail}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
