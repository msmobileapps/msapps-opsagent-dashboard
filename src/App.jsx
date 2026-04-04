import React, { Suspense, lazy } from 'react'
import { useStore } from './hooks/useStore'
import Sidebar from './components/Sidebar'
import Notifications from './components/Notifications'

const Dashboard = lazy(() => import('./components/Dashboard'))
const TaskDetailView = lazy(() => import('./components/TaskDetailView'))

function ViewFallback() {
  return (
    <div className="surface-panel rounded-[28px] p-6 text-sm leading-6 text-slate-400">
      Loading workspace...
    </div>
  )
}

export default function App() {
  const store = useStore()

  const renderView = () => {
    switch (store.view) {
      case 'task-detail':
        return store.selectedTask ? <TaskDetailView store={store} /> : <Dashboard store={store} />
      default:
        return <Dashboard store={store} />
    }
  }

  return (
    <div className="app-shell flex min-h-screen overflow-hidden">
      <Sidebar store={store} />
      <main className="app-main grid-lines flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1500px] px-5 py-6 md:px-7 xl:px-10">
          <Suspense fallback={<ViewFallback />}>
            {renderView()}
          </Suspense>
        </div>
      </main>
      <Notifications notifications={store.notifications} />
    </div>
  )
}
