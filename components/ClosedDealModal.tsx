'use client'

import { useState } from 'react'
import type { Rep } from '@/lib/types'
import { fmtMoney } from '@/lib/helpers'

interface ClosedDealModalProps {
  rep: Rep
  onSave: (data: { companyName: string; monthlyPrice: number; closedDate: string }) => void
  onCancel: () => void
}

export function ClosedDealModal({ rep, onSave, onCancel }: ClosedDealModalProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [companyName, setCompanyName] = useState('')
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const [closedDate, setClosedDate] = useState(today)

  const price = parseFloat(monthlyPrice) || 0
  const canSubmit = companyName.trim().length > 0 && price > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSave({ companyName: companyName.trim(), monthlyPrice: price, closedDate })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-line-2 p-6 shadow-2xl"
        style={{ background: 'linear-gradient(180deg, var(--card-top), var(--card-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-mint" />
            <div className="text-[11px] text-ink-3 uppercase tracking-[1px] font-semibold">Closed Won</div>
          </div>
          <div className="text-[20px] font-bold leading-tight">New deal</div>
          <div className="text-[13px] text-ink-2 mt-0.5">logged by {rep.name}</div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Company name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-ink-2 uppercase tracking-[0.8px] font-semibold">Company name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-lg text-[14px] font-medium text-ink outline-none transition-all placeholder:text-ink-3"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--line-2)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#00E5A066')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
            />
          </div>

          {/* Monthly price + Closed date */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] text-ink-2 uppercase tracking-[0.8px] font-semibold">Monthly price</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 text-[14px] font-semibold">$</span>
                <input
                  type="number"
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1"
                  className="mono w-full pl-7 pr-3.5 py-2.5 rounded-lg text-[14px] font-semibold text-ink outline-none transition-all placeholder:text-ink-3"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--line-2)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#00E5A066')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] text-ink-2 uppercase tracking-[0.8px] font-semibold">Closed date</label>
              <input
                type="date"
                value={closedDate}
                onChange={(e) => setClosedDate(e.target.value)}
                className="mono w-full px-3.5 py-2.5 rounded-lg text-[14px] font-medium text-ink outline-none transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--line-2)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#00E5A066')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
              />
            </div>
          </div>

          {/* ARR preview */}
          <div
            className="px-4 py-3 rounded-xl flex justify-between items-center"
            style={{ background: price > 0 ? '#00E5A011' : 'var(--bg-2)', border: `1px solid ${price > 0 ? '#00E5A033' : 'var(--line)'}` }}
          >
            <span className="text-[12px] text-ink-2 font-medium">ARR contribution</span>
            <span className="mono text-[15px] font-bold" style={{ color: price > 0 ? '#00E5A0' : '#3A4460' }}>
              {price > 0 ? fmtMoney(price * 12) : '—'}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-ink-2 transition-colors hover:text-ink-1"
              style={{ background: '#1A2035', border: '1px solid #262E45' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-bg-1 transition-opacity disabled:opacity-30"
              style={{ background: '#00E5A0' }}
            >
              Log deal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
