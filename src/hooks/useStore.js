import { useState, useCallback, useEffect } from 'react'
import { identity } from '../config/identity'
import { fetchTasks, fetchTaskOutput, fetchLeads, healthCheck } from '../services/api'

export function useStore() {
  const [view, setView] = useState('dashboard')
  const [selectedTask, setSelectedTask] = useState(null)
  const [tasks, setTasks] = useState([])
  const [leads, setLeads] = useState([])
  const [taskOutputs, setTaskOutputs] = useState({})
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState([])

  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now()
    setNotifications(prev => [...prev, { id, message, type }])
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000)
  }, [])

  // Load real data on mount
  useEffect(() => {
    async function init() {
      setLoading(true)
      const health = await healthCheck()
      setConnected(health.connected)

      if (health.connected) {
        const [taskResult, leadResult] = await Promise.all([
          fetchTasks(),
          fetchLeads(),
        ])
        if (taskResult.tasks) setTasks(taskResult.tasks)
        if (leadResult.leads) setLeads(leadResult.leads)
      }
      setLoading(false)
    }
    init()
  }, [])

  const refreshLeads = useCallback(async () => {
    const result = await fetchLeads()
    if (result.leads) setLeads(result.leads)
    return result
  }, [])

  const loadTaskOutput = useCallback(async (taskId) => {
    const result = await fetchTaskOutput(taskId)
    if (result.success !== false) {
      setTaskOutputs(prev => ({ ...prev, [taskId]: result }))
    }
    return result
  }, [])

  const openTask = useCallback((task) => {
    setSelectedTask(task)
    setView('task-detail')
    loadTaskOutput(task.taskId)
  }, [loadTaskOutput])

  const goBack = useCallback(() => {
    setSelectedTask(null)
    setView('dashboard')
  }, [])

  return {
    identity,
    view,
    setView,
    selectedTask,
    setSelectedTask,
    openTask,
    goBack,
    tasks,
    setTasks,
    leads,
    setLeads,
    refreshLeads,
    taskOutputs,
    loadTaskOutput,
    connected,
    loading,
    notifications,
    addNotification,
  }
}
