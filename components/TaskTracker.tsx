'use client'

import { useState, useEffect, useMemo, useRef, type CSSProperties, type MouseEvent } from 'react'
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(deadline: string | null, status: TaskStatus): boolean {
  if (!deadline || status === 'done') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(deadline + 'T00:00:00') < today
}

interface TaskFormState {
  title: string
  description: string
  assigneeIds: string[]
  deadline: string
  status: TaskStatus
}

const emptyForm = (): TaskFormState => ({
  title: '',
  description: '',
  assigneeIds: [],
  deadline: '',
  status: 'todo',
})

function StatusCircle({ status, onClick }: { status: TaskStatus; onClick: (e: MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={status === 'done' ? 'Mark as to do' : 'Mark as done'}
      style={{ lineHeight: 0, flexShrink: 0, padding: 2 }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        {status === 'done' ? (
          <>
            <circle cx="10" cy="10" r="9" fill="#00E5A0" />
            <path d="M6 10.5l2.5 2.5 5-5.5" stroke="#0A0E1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : status === 'in_progress' ? (
          <>
            <circle cx="10" cy="10" r="9" stroke="#FFB020" strokeWidth="1.5" />
            <circle cx="10" cy="10" r="3.5" fill="#FFB020" />
          </>
        ) : (
          <circle cx="10" cy="10" r="9" stroke="var(--line)" strokeWidth="1.5" />
        )}
      </svg>
    </button>
  )
}

export function TaskTracker({ reps, currentRepId, notify }: TaskTrackerProps) {
  const activeReps = reps.filter((r) => r.is_active)
  const defaultCreator = currentRepId ?? activeReps[0]?.id ?? ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')
  const [showDone, setShowDone] = useState(false)

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

  const repById = useMemo(() => Object.fromEntries(reps.map((r) => [r.id, r])), [reps])

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return tasks.filter((t) => {
      const ids = t.assignee_ids ?? []
      if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? '').toLowerCase().includes(q)) return false
      if (assigneeFilter === 'unassigned' && ids.length > 0) return false
      if (assigneeFilter && assigneeFilter !== 'unassigned' && !ids.includes(assigneeFilter)) return false
      return true
    })
  }, [tasks, searchQuery, assigneeFilter])

  const activeTasks = useMemo(() =>
    filteredTasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => {
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1
        if (b.status === 'in_progress' && a.status !== 'in_progress') return 1
        return a.position - b.position || b.created_at.localeCompare(a.created_at)
      }),
    [filteredTasks])

  const doneTasks = useMemo(() =>
    filteredTasks
      .filter((t) => t.status === 'done')
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [filteredTasks])

  function openCreateForm() {
    setEditingTask(null)
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
      status: task.status as TaskStatus,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingTask(null)
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

  async function quickToggleStatus(task: Task, e: MouseEvent) {
    e.stopPropagation()
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done'
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
    await updateTaskAction(task.id, { status: newStatus })
  }

  async function handleSubmit(e: { preventDefault(): void }) {
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
          status: form.status,
        })
        if (task) setTasks((prev) => prev.map((t) => t.id === task.id ? task : t))
      } else {
        const { task } = await createTaskAction({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          assigneeIds: form.assigneeIds,
          createdById: defaultCreator,
          deadline: form.deadline || null,
          status: form.status,
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

  const myTasks = tasks.filter((t) => (t.assignee_ids ?? []).includes(currentRepId ?? '') && t.status !== 'done').length
  const overdueCount = tasks.filter((t) => isOverdue(t.deadline, t.status as TaskStatus)).length
  const hasFilters = searchQuery.trim() !== '' || assigneeFilter !== ''

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-2)', fontSize: 13 }}>Loading tasks…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <SectionTitle>Long-term tasks</SectionTitle>
          <div style={{ display: 'flex', gap: 10, marginTop: -6 }}>
            {currentRepId && myTasks > 0 && <Pill color="#00D4FF">{myTasks} assigned to you</Pill>}
            {overdueCount > 0 && <Pill color="#FF5468">{overdueCount} overdue</Pill>}
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          disabled={!defaultCreator}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 18px',
            background: '#00D4FF',
            borderRadius: 9,
            color: '#0A0E1A',
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
            opacity: defaultCreator ? 1 : 0.5,
          }}
        >
          <Icon name="plus" size={14} color="#0A0E1A" stroke={2.5} />
          Add task
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px',
          background: 'var(--input-bg)',
          border: `1px solid ${searchQuery ? '#00D4FF44' : 'var(--line)'}`,
          borderRadius: 8,
          flex: '1 1 180px', maxWidth: 260,
        }}>
          <Icon name="search" size={14} color={searchQuery ? '#00D4FF' : 'var(--ink-3)'} />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks…"
            style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 13, outline: 'none', padding: 0 }}
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} style={{ lineHeight: 0 }}>
              <Icon name="x" size={13} color="var(--ink-3)" />
            </button>
          )}
        </div>

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
                  borderRadius: '50%', padding: 0, lineHeight: 0,
                  boxShadow: active ? `0 0 0 2px var(--accent-text), 0 0 0 3px ${r.color}` : 'none',
                  opacity: assigneeFilter && !active ? 0.3 : 1,
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
              width: 26, height: 26, borderRadius: '50%',
              border: `1.5px dashed ${assigneeFilter === 'unassigned' ? 'var(--ink-2)' : '#2A3350'}`,
              background: assigneeFilter === 'unassigned' ? 'var(--ink-2)22' : 'transparent',
              color: 'var(--ink-3)', fontSize: 11, fontWeight: 600,
              opacity: assigneeFilter && assigneeFilter !== 'unassigned' ? 0.3 : 1,
              transition: 'opacity 150ms',
            }}
          >—</button>
        </div>

        {hasFilters && (
          <button type="button" onClick={() => { setSearchQuery(''); setAssigneeFilter('') }}
            style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>
            Clear
          </button>
        )}
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {activeTasks.length === 0 && doneTasks.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>
            {hasFilters ? 'No matching tasks' : 'No tasks yet — add one above'}
          </div>
        )}

        {activeTasks.map((task) => {
          const assignees = (task.assignee_ids ?? []).map((id) => repById[id]).filter(Boolean) as Rep[]
          const overdue = isOverdue(task.deadline, task.status as TaskStatus)
          const inProgress = task.status === 'in_progress'

          return (
            <div
              key={task.id}
              onClick={() => openEditForm(task)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid transparent',
                cursor: 'pointer',
                transition: 'background 120ms, border-color 120ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--column-bg)'
                e.currentTarget.style.borderColor = 'var(--line)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              <StatusCircle status={task.status as TaskStatus} onClick={(e) => quickToggleStatus(task, e)} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {inProgress && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#FFB020', background: '#FFB02018', padding: '2px 6px', borderRadius: 4, letterSpacing: 0.4, flexShrink: 0 }}>
                      IN PROGRESS
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {task.title}
                  </span>
                </div>
                {task.description && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, wordBreak: 'break-word' }}>
                    {task.description}
                  </div>
                )}
              </div>

              {/* Assignees */}
              {assignees.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {assignees.slice(0, 3).map((rep, i) => (
                    <div key={rep.id} style={{ marginLeft: i > 0 ? -6 : 0 }} title={rep.name}>
                      <Avatar rep={rep} size={22} />
                    </div>
                  ))}
                  {assignees.length > 3 && (
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 4 }}>+{assignees.length - 3}</span>
                  )}
                </div>
              )}

              {/* Deadline */}
              {task.deadline && (
                <span style={{
                  fontSize: 11, fontWeight: 600, flexShrink: 0,
                  color: overdue ? '#FF5468' : 'var(--ink-3)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {overdue && '⚠ '}{formatDeadline(task.deadline)}
                </span>
              )}
            </div>
          )
        })}

        {/* Done section */}
        {doneTasks.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', marginTop: 8,
                color: 'var(--ink-3)', fontSize: 12, fontWeight: 600,
                borderTop: '1px solid var(--line)',
              }}
            >
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                style={{ transform: showDone ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
              >
                <path d="M4 2l4 4-4 4" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Done · {doneTasks.length}
            </button>

            {showDone && doneTasks.map((task) => {
              const assignees = (task.assignee_ids ?? []).map((id) => repById[id]).filter(Boolean) as Rep[]

              return (
                <div
                  key={task.id}
                  onClick={() => openEditForm(task)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '9px 14px', borderRadius: 10,
                    cursor: 'pointer', opacity: 0.55,
                    transition: 'opacity 120ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.55' }}
                >
                  <StatusCircle status="done" onClick={(e) => quickToggleStatus(task, e)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: 'var(--ink-2)', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                      {task.title}
                    </span>
                  </div>
                  {assignees.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      {assignees.slice(0, 3).map((rep, i) => (
                        <div key={rep.id} style={{ marginLeft: i > 0 ? -6 : 0 }}>
                          <Avatar rep={rep} size={20} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'var(--overlay)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, padding: 20,
          }}
          onClick={closeForm}
        >
          <div onClick={(e: MouseEvent) => e.stopPropagation()}>
            <Card style={{ width: '100%', maxWidth: 480 }} padding={24}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                  {editingTask ? 'Edit task' : 'New task'}
                </div>
                <button onClick={closeForm} style={{ padding: 4 }}>
                  <Icon name="x" size={18} color="var(--ink-3)" />
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Title</label>
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
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Add details…"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((s) => {
                      const label = s === 'todo' ? 'To Do' : s === 'in_progress' ? 'In Progress' : 'Done'
                      const color = s === 'todo' ? 'var(--ink-2)' : s === 'in_progress' ? '#FFB020' : '#00E5A0'
                      const active = form.status === s
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, status: s }))}
                          style={{
                            flex: 1, padding: '8px 10px', fontSize: 11, fontWeight: 600, borderRadius: 7,
                            background: active ? color + '22' : 'var(--input-bg)',
                            color: active ? color : 'var(--ink-3)',
                            border: `1px solid ${active ? color + '66' : 'var(--line)'}`,
                            transition: 'all 120ms',
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Assign to</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '4px 0' }}>
                    {reps.map((r) => {
                      const selected = form.assigneeIds.includes(r.id)
                      return (
                        <button
                          key={r.id}
                          type="button"
                          title={r.name}
                          onClick={() => toggleAssignee(r.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 10px 4px 4px', borderRadius: 20,
                            border: `1.5px solid ${selected ? r.color : 'var(--line)'}`,
                            background: selected ? r.color + '18' : 'transparent',
                            color: selected ? 'var(--ink)' : 'var(--ink-2)',
                            fontSize: 12, fontWeight: selected ? 600 : 400,
                            transition: 'all 150ms',
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
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Deadline</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.deadline}
                    onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  {editingTask && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingTask.id)}
                      style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #FF546844', borderRadius: 8, color: '#FF5468', fontSize: 13, fontWeight: 600 }}
                    >
                      Delete
                    </button>
                  )}
                  <div style={{ flex: 1 }} />
                  <button
                    type="button"
                    onClick={closeForm}
                    style={{ padding: '10px 16px', background: 'var(--input-bg)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink-2)', fontSize: 13, fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !form.title.trim()}
                    style={{ padding: '10px 20px', background: '#00D4FF', borderRadius: 8, color: '#0A0E1A', fontSize: 13, fontWeight: 700, opacity: saving || !form.title.trim() ? 0.6 : 1 }}
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
