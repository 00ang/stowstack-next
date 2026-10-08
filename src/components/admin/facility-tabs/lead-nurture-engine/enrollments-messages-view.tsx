'use client'

import {
  Pause, Play, UserCheck, Users, MessageSquare,
  Smartphone, Mail,
  CheckCircle2, AlertCircle, Send,
} from 'lucide-react'

/* ── Types ── */

interface NurtureStep {
  step_number: number
  delay_minutes: number
  channel: 'sms' | 'email'
  subject: string | null
  body: string
  send_window: { start: string; end: string } | null
}

interface NurtureSequence {
  id: string
  facility_id: string
  name: string
  trigger_type: string
  status: 'active' | 'paused' | 'archived'
  steps: NurtureStep[] | string
  exit_conditions: string[]
  created_at: string
  updated_at: string
}

interface NurtureEnrollment {
  id: string
  sequence_id: string
  facility_id: string
  lead_id: string | null
  tenant_id: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  current_step: number
  status: 'active' | 'paused' | 'completed' | 'converted' | 'unsubscribed' | 'failed'
  enrolled_at: string
  next_send_at: string | null
  completed_at: string | null
  exit_reason: string | null
  metadata: Record<string, unknown>
}

interface NurtureMessage {
  id: string
  enrollment_id: string
  step_number: number
  channel: 'sms' | 'email'
  to_address: string
  subject: string | null
  body: string
  status: string
  external_id: string | null
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  error_message: string | null
  created_at: string
}

const CHANNEL_CONFIG = {
  sms: { label: 'SMS', color: 'text-green-500', bg: 'bg-green-500/10' },
  email: { label: 'Email', color: 'text-[var(--color-blue)]', bg: 'bg-[var(--color-blue)]/10' },
} as const

const STATUS_CONFIG = {
  active: { label: 'Active', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  paused: { label: 'Paused', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  completed: { label: 'Completed', bg: 'bg-[var(--color-blue)]/10', text: 'text-[var(--color-blue)]' },
  converted: { label: 'Converted', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  unsubscribed: { label: 'Unsubscribed', bg: 'bg-[var(--color-mid-gray)]/10', text: 'text-[var(--color-mid-gray)]' },
  failed: { label: 'Failed', bg: 'bg-red-500/10', text: 'text-red-400' },
  archived: { label: 'Archived', bg: 'bg-[var(--color-mid-gray)]/10', text: 'text-[var(--color-mid-gray)]' },
} as const

function parseSteps(steps: NurtureStep[] | string): NurtureStep[] {
  return typeof steps === 'string' ? JSON.parse(steps) : steps
}

/* ── Enrollments View ── */

export function EnrollmentsView({
  enrollments,
  sequences,
  updateEnrollment,
}: {
  enrollments: NurtureEnrollment[]
  sequences: NurtureSequence[]
  updateEnrollment: (id: string, action: string) => void
}) {
  if (enrollments.length === 0) {
    return (
      <div className="text-center py-10">
        <Users size={32} className="mx-auto mb-3 text-[var(--color-mid-gray)]" />
        <p className="font-medium text-[var(--color-dark)]">No enrollments yet</p>
        <p className="text-sm text-[var(--color-body-text)] mt-1">
          Create a sequence and enroll leads to start nurturing
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {enrollments.map(e => {
        const seq = sequences.find(s => s.id === e.sequence_id)
        const eStatus = STATUS_CONFIG[e.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active
        const steps = seq ? parseSteps(seq.steps) : []
        return (
          <div key={e.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[var(--color-dark)]">
                    {e.contact_name || e.contact_email || e.contact_phone}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${eStatus.bg} ${eStatus.text}`}>
                    {eStatus.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--color-mid-gray)]">
                  <span>{seq?.name || 'Unknown sequence'}</span>
                  <span>&middot;</span>
                  <span>Step {e.current_step + 1}/{steps.length || '?'}</span>
                  {e.contact_email && <span>&middot; {e.contact_email}</span>}
                  {e.contact_phone && <span>&middot; {e.contact_phone}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {e.status === 'active' && (
                  <>
                    <button onClick={() => updateEnrollment(e.id, 'pause')} className="p-1.5 rounded-lg hover:bg-[var(--color-light-gray)]">
                      <Pause size={14} className="text-amber-500" />
                    </button>
                    <button onClick={() => updateEnrollment(e.id, 'convert')} className="p-1.5 rounded-lg hover:bg-[var(--color-light-gray)]">
                      <UserCheck size={14} className="text-emerald-500" />
                    </button>
                  </>
                )}
                {e.status === 'paused' && (
                  <button onClick={() => updateEnrollment(e.id, 'resume')} className="p-1.5 rounded-lg hover:bg-[var(--color-light-gray)]">
                    <Play size={14} className="text-emerald-500" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Messages View ── */

export function MessagesView({
  messages,
}: {
  messages: NurtureMessage[]
}) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-10">
        <MessageSquare size={32} className="mx-auto mb-3 text-[var(--color-mid-gray)]" />
        <p className="font-medium text-[var(--color-dark)]">No messages sent yet</p>
        <p className="text-sm text-[var(--color-body-text)] mt-1">
          Messages will appear here as sequences run
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {messages.map(m => {
        const ch = CHANNEL_CONFIG[m.channel as keyof typeof CHANNEL_CONFIG] || CHANNEL_CONFIG.email
        const isFailed = m.status === 'failed' || m.status === 'bounced'
        return (
          <div key={m.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full ${ch.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                {m.channel === 'sms'
                  ? <Smartphone size={12} className={ch.color} />
                  : <Mail size={12} className={ch.color} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium ${ch.color}`}>{ch.label}</span>
                  <span className="text-xs text-[var(--color-mid-gray)]">to {m.to_address}</span>
                  <span className="text-xs text-[var(--color-mid-gray)]">&middot; Step {m.step_number + 1}</span>
                  {isFailed ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 flex items-center gap-1">
                      <AlertCircle size={9} /> {m.status}
                    </span>
                  ) : m.status === 'sent' || m.status === 'delivered' ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={9} /> {m.status}
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-light-gray)] text-[var(--color-body-text)] flex items-center gap-1">
                      <Send size={9} /> {m.status}
                    </span>
                  )}
                </div>
                {m.subject && (
                  <p className="text-xs font-medium text-[var(--color-dark)] mt-0.5">{m.subject}</p>
                )}
                <p className="text-xs text-[var(--color-mid-gray)] mt-0.5 line-clamp-2">
                  {m.body.slice(0, 150)}
                </p>
                {m.error_message && (
                  <p className="text-xs text-red-400 mt-0.5">{m.error_message}</p>
                )}
                {m.sent_at && (
                  <p className="text-[10px] text-[var(--color-mid-gray)] mt-1">
                    {new Date(m.sent_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Enroll Modal ── */

export function EnrollModal({
  showEnrollModal,
  setShowEnrollModal,
  enrollForm,
  setEnrollForm,
  enrollLead,
  leadName,
}: {
  showEnrollModal: string
  setShowEnrollModal: (id: string | null) => void
  enrollForm: { name: string; email: string; phone: string }
  setEnrollForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; phone: string }>>
  enrollLead: (sequenceId: string) => void
  /** Enrolling a known lead: contact comes from their record; the fields only override it. */
  leadName?: string
}) {
  return (
    <div
      className="fixed inset-0 bg-[var(--ic-ink)]/45 z-50 flex items-center justify-center p-4"
      onClick={() => setShowEnrollModal(null)}
    >
      <div
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-2xl max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <h3 className="font-semibold text-[var(--color-dark)]">{leadName ? `Enroll ${leadName}` : "Enroll Lead in Sequence"}</h3>
          {leadName && (
            <p className="text-sm text-[var(--color-dark)]">
              Their email and phone come from their lead record. Fill these in only to use different ones.
            </p>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--color-mid-gray)]">Name</label>
              <input
                value={enrollForm.name}
                onChange={e => setEnrollForm(f => ({ ...f, name: e.target.value }))}
                className="w-full mt-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light)] px-3 py-2 text-sm text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)]"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-mid-gray)]">Email</label>
              <input
                value={enrollForm.email}
                onChange={e => setEnrollForm(f => ({ ...f, email: e.target.value }))}
                className="w-full mt-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light)] px-3 py-2 text-sm text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)]"
                placeholder="john@example.com"
                type="email"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-mid-gray)]">Phone (for SMS)</label>
              <input
                value={enrollForm.phone}
                onChange={e => setEnrollForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full mt-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light)] px-3 py-2 text-sm text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)]"
                placeholder="+1234567890"
                type="tel"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => enrollLead(showEnrollModal)}
              className="flex-1 px-4 py-2.5 bg-[var(--color-gold)] text-[var(--color-light)] rounded-xl text-sm font-medium hover:bg-[var(--color-gold)]/80"
            >
              Enroll
            </button>
            <button
              onClick={() => setShowEnrollModal(null)}
              className="px-4 py-2.5 border border-[var(--border-subtle)] rounded-xl text-sm font-medium text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
