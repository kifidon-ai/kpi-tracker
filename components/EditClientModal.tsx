'use client'

import { useState } from 'react'
import type { Client } from '@/lib/types'
import { fmtMoney } from '@/lib/helpers'

interface EditClientModalProps {
  client: Client
  onSave: (cancelDate: string | null) => void
  onCancel: () => void
  saving?: boolean
}

export function EditClientModal({ client, onSave, onCancel, saving }: EditClientModalProps) {
  const [cancelDate, setCancelDate] = useState(client.cancel_date ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(cancelDate.trim() ? cancelDate : null)
  }

  function handleClear() {
    setCancelDate('')
    onSave(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-line-2 p-6 shadow-2xl"
        style={{ background: 'linear-gradient(180deg, var(--card-top), var(--card-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: client.cancel_date ? '#FFB800' : '#00E5A0' }}
            />
            <div className="text-[11px] text-ink-3 uppercase tracking-[1px] font-semibold">Client</div>
          </div>
          <div className="text-[20px] font-bold leading-tight">{client.name}</div>
          <div className="text-[13px] text-ink-2 mt-0.5">
            {fmtMoney(client.mrr)}/mo · onboarded {client.since_date}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-ink-2 uppercase tracking-[0.8px] font-semibold">
              Canceled date
            </label>
            <input
              type="date"
              value={cancelDate}
              min={client.since_date ?? undefined}
              onChange={(e) => setCancelDate(e.target.value)}
              autoFocus
              className="mono w-full px-3.5 py-2.5 rounded-lg text-[14px] font-medium text-ink outline-none transition-all"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--line-2)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#00E5A066')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
            />
            <p className="text-[11px] text-ink-3 mt-0.5">
              After this date the client drops off the active-clients speedometer and MRR.
            </p>
          </div>

          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-ink-2 transition-colors hover:text-ink-1"
              style={{ background: '#1A2035', border: '1px solid #262E45' }}
            >
              Close
            </button>
            {client.cancel_date && (
              <button
                type="button"
                onClick={handleClear}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-ink-2 transition-colors hover:text-ink-1 disabled:opacity-40"
                style={{ background: '#1A2035', border: '1px solid #262E45' }}
              >
                Clear cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-bg-1 transition-opacity disabled:opacity-30"
              style={{ background: '#00E5A0' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
