'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties, type FormEvent, type MouseEvent } from 'react'
import type { Rep, Task, TaskStatus } from '@/lib/types'
import { Card, SectionTitle, Pill } from './ui/primitives'
import { Icon } from './ui/Icon'
import { Avatar } from './ui/Avatar'
import { createTaskAction, updateTaskAction, deleteTaskAction, getTasksAction } from '@/app/actions'
import { createClient } from '@/utils/supabase/client'
import type { SoundType } from '@/hooks/useNotifications'

interface TaskTrackerProps {
  reps: Rep[]
  currentRepId: string | null
  notify?: (title: string, body?: string, sound?: SoundType) => void
}

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo',        label: 'To Do',       color: 'var(--ink-2)' },
  { id: 'in_progress', label: 'In Progress', color: '#FFB020' },
  { id: 'done',        label: 'Done',        color: '#00E5A0' },
]

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--input-bg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  color: 'var(--ink)',
  fontSize: 13,
  outline: 'none',
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return ''
  const d = new Date(deadline + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(deadline: string | null, status: TaskStatus): boolean {
  if (!deadline || status === 'done') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(deadline + 'T00:00:00')
  return d < today
}

interface TaskFormState {
  title: string
  description: string
  assigneeIds: string[]
  deadline: string
}

const emptyForm = (): TaskFormState => ({
  title: '',
  description: '',
  assigneeIds: [],
  deadline: '',
})

export function TaskTracker({ reps, currentRepId, notify }: TaskTrackerProps) {
  const activeReps = reps.filter((r) => r.is_active)
  const defaultCreator = currentRepId ?? activeReps[0]?.id ?? ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [createStatus, setCreateStatus] = useState<TaskStatus>('todo')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')

  const currentRepIdRef = useRef(currentRepId)
  const notifyRef = useRef(notify)
  useEffect(() => { currentRepIdRef.current = currentRepId }, [currentRepId])
  useEffect(() => { notifyRef.current = notify }, [notify])

  useEffect(() => {
    getTasksAction().then(setTasks).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('task_tracker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => {
        const task = payload.new as Task
        setTasks((prev) => prev.some((t) => t.id === task.id) ? prev : [...prev, task])
        if (currentRepIdRef.current && (task.assignee_ids ?? []).includes(currentRepIdRef.current)) {
          notifyRef.current?.(`New task: ${task.title}`, undefined, 'task')
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
        const task = payload.new as Task
        setTasks((prev) => prev.map((t) => t.id === task.id ? task : t))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (payload) => {
        const id = (payload.old as { id: string }).id
        setTasks((prev) => prev.filter((t) => t.id !== id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return tasks.filter((t) => {
      const ids = t.assignee_ids ?? []
      if (q && !t.title.toLowerCase().includes(q)) return false
      if (assigneeFilter === 'unassigned' && ids.length > 0) return false
      if (assigneeFilter && assigneeFilter !== 'unassigned' && !ids.includes(assigneeFilter)) return false
      return true
    })
  }, [tasks, searchQuery, assigneeFilter])

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] }
    for (const t of filteredTasks) {
      const status = t.status as TaskStatus
      if (grouped[status]) grouped[status].push(t)
    }
    for (const col of COLUMNS) {
      grouped[col.id].sort((a, b) => a.position - b.position || b.created_at.localeCompare(a.created_at))
    }
    return grouped
  }, [filteredTasks])

  const repById = useMemo(() => Object.fromEntries(reps.map((r) => [r.id, r])), [reps])

  function openCreateForm(status: TaskStatus = 'todo') {
    setEditingTask(null)
    setCreateStatus(status)
    setForm(emptyForm())
    setShowForm(true)
  }

  function openEditForm(task: Task) {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description ?? '',
      assigneeIds: task.assignee_ids ?? [],
      deadline: task.deadline ?? '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingTask(null)
    setCreateStatus('todo')
    setForm(emptyForm())
  }

  function toggleAssignee(repId: string) {
    setForm((f) => ({
      ...f,
      assigneeIds: f.assigneeIds.includes(repId)
        ? f.assigneeIds.filter((id) => id !== repId)
        : [...f.assigneeIds, repId],
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !defaultCreator) return
    setSaving(true)
    try {
      if (editingTask) {
        const { task } = await updateTaskAction(editingTask.id, {
          title: form.title.trim(),
          description: form.description.trim() || null,
          assigneeIds: form.assigneeIds,
          deadline: form.deadline || null,
        })
        if (task) setTasks((prev) => prev.map((t) => t.id === task.id ? task : t))
      } else {
        const { task } = await createTaskAction({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          assigneeIds: form.assigneeIds,
          createdById: defaultCreator,
          deadline: form.deadline || null,
          status: createStatus,
        })
        if (task) setTasks((prev) => prev.some((t) => t.id === task.id) ? prev : [...prev, task])
      }
      closeForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    await deleteTaskAction(taskId)
    closeForm()
  }

  const moveTask = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return

    const colTasks = tasks.filter((t) => t.status === newStatus)
    const newPosition = colTasks.length

    setTasks((prev) =>
      prev.map((t) => t.id === taskId ? { ...t, status: newStatus, position: newPosition } : t),
    )

    await updateTaskAction(taskId, { status: newStatus, position: newPosition })
  }, [tasks])

  function handleDragStart(taskId: string) {
    setDragTaskId(taskId)
  }

  function handleDragEnd() {
    setDragTaskId(null)
    setDragOverColumn(null)
  }

  function handleDrop(status: TaskStatus) {
    if (dragTaskId) moveTask(dragTaskId, status)
    setDragTaskId(null)
    setDragOverColumn(null)
  }

  const myTasks = tasks.filter((t) => (t.assignee_ids ?? []).includes(currentRepId ?? '') && t.status !== 'done').length
  const overdueCount = tasks.filter((t) => isOverdue(t.deadline, t.status as TaskStatus)).length
  const hasFilters = searchQuery.trim() !== '' || assigneeFilter !== ''

  function clearFilters() {
    setSearchQuery('')
    setAssigneeFilter('')
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-2)', fontSize: 13 }}>
        Loading tasks…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <SectionTitle>Task tracker</SectionTitle>
          <div style={{ display: 'flex', gap: 10, marginTop: -6, marginBottom: 14 }}>
            {currentRepId && myTasks > 0 && (
              <Pill color="#00D4FF">{myTasks} assigned to you</Pill>
            )}
            {overdueCount > 0 && (
              <Pill color="#FF5468">{overdueCount} overdue</Pill>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flex: '1 1 180px',
                maxWidth: 260,
                padding: '6px 0',
                borderBottom: `1px solid ${searchQuery ? '#00D4FF44' : 'var(--line)'}`,
              }}
            >
              <Icon name="search" size={14} color={searchQuery ? '#00D4FF' : 'var(--ink-3)'} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--ink)',
                  fontSize: 13,
                  outline: 'none',
                  padding: 0,
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ color: 'var(--ink-3)', display: 'flex', padding: 2 }}
                  aria-label="Clear search"
                >
                  <Icon name="x" size={14} color="var(--ink-3)" />
                </button>
              )}
            </div>

            <div style={{ width: 1, height: 18, background: 'var(--line)', flexShrink: 0 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {reps.map((r) => {
                const active = assigneeFilter === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    title={r.name}
                    onClick={() => setAssigneeFilter(active ? '' : r.id)}
                    style={{
                      borderRadius: '50%',
                      padding: 0,
                      lineHeight: 0,
                      boxShadow: active ? `0 0 0 2px var(--accent-text), 0 0 0 3px ${r.color}` : 'none',
                      opacity: assigneeFilter && !active ? 0.35 : 1,
                      transition: 'opacity 150ms, box-shadow 150ms',
                    }}
                  >
                    <Avatar rep={r} size={26} />
                  </button>
                )
              })}
              <button
                type="button"
                title="Unassigned"
                onClick={() => setAssigneeFilter(assigneeFilter === 'unassigned' ? '' : 'unassigned')}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  border: `1.5px dashed ${assigneeFilter === 'unassigned' ? 'var(--ink-2)' : '#2A3350'}`,
                  background: assigneeFilter === 'unassigned' ? 'var(--ink-2)22' : 'transparent',
                  color: 'var(--ink-3)',
                  fontSize: 11,
                  fontWeight: 600,
                  opacity: assigneeFilter && assigneeFilter !== 'unassigned' ? 0.35 : 1,
                  transition: 'opacity 150ms',
                }}
              >
                —
              </button>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, padding: '4px 0' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
        {COLUMNS.map((col) => {
          const colTasks = tasksByStatus[col.id]
          const isOver = dragOverColumn === col.id
          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.id) }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => { e.preventDefault(); handleDrop(col.id) }}
              style={{
                minHeight: 420,
                background: isOver ? 'var(--column-hover)' : 'var(--column-bg)',
                border: `1px solid ${isOver ? col.color : 'var(--line)'}`,
                borderRadius: 14,
                padding: 14,
                transition: 'border-color 150ms, background 150ms',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{col.label}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {colTasks.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {colTasks.map((task) => {
                  const assignees = (task.assignee_ids ?? []).map((id) => repById[id]).filter(Boolean) as Rep[]
                  const creator = repById[task.created_by_id]
                  const overdue = isOverdue(task.deadline, col.id)
                  const dragging = dragTaskId === task.id
                  const visibleAssignees = assignees.slice(0, 3)
                  const extraAssignees = assignees.length - visibleAssignees.length

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => openEditForm(task)}
                      style={{
                        background: 'linear-gradient(180deg, var(--card-top), var(--card-bottom))',
                        border: '1px solid var(--line)',
                        borderRadius: 10,
                        padding: 14,
                        cursor: 'grab',
                        opacity: dragging ? 0.5 : 1,
                        boxShadow: overdue ? '0 0 0 1px #FF546844' : 'none',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.4 }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10, lineHeight: 1.45 }}>
                          {task.description.length > 100 ? task.description.slice(0, 100) + '…' : task.description}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {assignees.length === 0 ? (
                            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Unassigned</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {visibleAssignees.map((rep, i) => (
                                <div key={rep.id} style={{ marginLeft: i > 0 ? -6 : 0 }} title={rep.name}>
                                  <Avatar rep={rep} size={22} />
                                </div>
                              ))}
                              {extraAssignees > 0 && (
                                <span style={{ fontSize: 10, color: 'var(--ink-2)', marginLeft: 4 }}>+{extraAssignees}</span>
                              )}
                              {assignees.length === 1 && (
                                <span style={{ fontSize: 11, color: 'var(--ink-2)', marginLeft: 6 }}>
                                  {assignees[0].name.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {task.deadline && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              color: overdue ? '#FF5468' : 'var(--ink-2)',
                              fontFamily: 'JetBrains Mono, monospace',
                            }}
                          >
                            <Icon name="calendar" size={12} color={overdue ? '#FF5468' : 'var(--ink-2)'} />
                            {formatDeadline(task.deadline)}
                          </div>
                        )}
                      </div>
                      {creator && !(task.assignee_ids ?? []).includes(task.created_by_id) && (
                        <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 8 }}>
                          Created by {creator.name.split(' ')[0]}
                        </div>
                      )}
                    </div>
                  )
                })}

                {colTasks.length === 0 && (
                  <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
                    {hasFilters ? 'No matching tasks' : 'Drop tasks here'}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => openCreateForm(col.id)}
                  disabled={!defaultCreator}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    width: '100%',
                    padding: '10px 12px',
                    marginTop: 4,
                    background: 'transparent',
                    border: `1px dashed ${col.color}44`,
                    borderRadius: 8,
                    color: col.color,
                    fontSize: 12,
                    fontWeight: 600,
                    opacity: defaultCreator ? 1 : 0.5,
                    transition: 'background 150ms, border-color 150ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = col.color + '11'
                    e.currentTarget.style.borderColor = col.color + '88'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = col.color + '44'
                  }}
                >
                  <Icon name="plus" size={13} color={col.color} />
                  Add item
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--overlay)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 20,
          }}
          onClick={closeForm}
        >
          <div onClick={(e: MouseEvent) => e.stopPropagation()}>
          <Card style={{ width: '100%', maxWidth: 480 }} padding={24}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                {editingTask
                  ? 'Edit task'
                  : `New task · ${COLUMNS.find((c) => c.id === createStatus)?.label ?? 'To Do'}`}
              </div>
              <button onClick={closeForm} style={{ color: 'var(--ink-3)', padding: 4 }}>
                <Icon name="x" size={18} color="var(--ink-3)" />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Title
                </label>
                <input
                  style={inputStyle}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="What needs to be done?"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Description
                </label>
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Add details…"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Assign to
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0' }}>
                  {reps.map((r) => {
                    const selected = form.assigneeIds.includes(r.id)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        title={r.name}
                        onClick={() => toggleAssignee(r.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px 4px 4px',
                          borderRadius: 20,
                          border: `1.5px solid ${selected ? r.color : 'var(--line)'}`,
                          background: selected ? r.color + '18' : 'transparent',
                          color: selected ? 'var(--ink)' : 'var(--ink-2)',
                          fontSize: 12,
                          fontWeight: selected ? 600 : 400,
                          transition: 'all 150ms',
                          cursor: 'pointer',
                        }}
                      >
                        <Avatar rep={r} size={22} />
                        {r.name.split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
                {form.assigneeIds.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>No one selected — task will be unassigned</div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Deadline
                </label>
                <input
                  type="date"
                  style={inputStyle}
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                />
              </div>

              {editingTask && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Status
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {COLUMNS.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          moveTask(editingTask.id, col.id)
                          setEditingTask((t) => t ? { ...t, status: col.id } : t)
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 7,
                          background: editingTask.status === col.id ? col.color + '33' : 'var(--input-bg)',
                          color: editingTask.status === col.id ? col.color : 'var(--ink-2)',
                          border: `1px solid ${editingTask.status === col.id ? col.color + '66' : 'var(--line)'}`,
                        }}
                      >
                        {col.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                {editingTask && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingTask.id)}
                    style={{
                      padding: '10px 16px',
                      background: 'transparent',
                      border: '1px solid #FF546844',
                      borderRadius: 8,
                      color: '#FF5468',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Delete
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={closeForm}
                  style={{
                    padding: '10px 16px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    color: 'var(--ink-2)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.title.trim()}
                  style={{
                    padding: '10px 20px',
                    background: '#00D4FF',
                    borderRadius: 8,
                    color: 'var(--accent-text)',
                    fontSize: 13,
                    fontWeight: 700,
                    opacity: saving || !form.title.trim() ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving…' : editingTask ? 'Save changes' : 'Create task'}
                </button>
              </div>
            </form>
          </Card>
          </div>
        </div>
      )}
    </div>
  )
}
