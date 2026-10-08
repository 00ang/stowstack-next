'use client'

import {
  Plus, ChevronDown, ChevronUp, Pause, Play,
  SkipForward, UserCheck, Trash2, Clock,
  Smartphone, Mail, Zap,
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

interface SequenceTemplate {
  key: string
  name: string
  trigger_type: string
  stepCount: number
}

const TRIGGER_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  landing_page_abandon: { label: 'Landing Page Abandon', icon: '\u{1F6AA}', color: 'text-orange-500' },
  reservation_abandon: { label: 'Reservation Abandon', icon: '\u{1F6D2}', color: 'text-red-500' },
  post_move_in: { label: 'Post Move-In', icon: '\u{1F3E0}', color: 'text-emerald-500' },
  win_back: { label: 'Win-Back', icon: '\u{1F504}', color: 'text-[var(--color-blue)]' },
  post_audit: { label: 'Post Audit', icon: '\u{1F4CB}', color: 'text-violet-500' },
  custom: { label: 'Custom', icon: '\u{2699}\u{FE0F}', color: 'text-[var(--color-body-text)]' },
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

function formatDelay(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  if (minutes < 1440) return `${Math.round(minutes / 60)}hr`
  return `${Math.round(minutes / 1440)}d`
}

function parseSteps(steps: NurtureStep[] | string): NurtureStep[] {
  return typeof steps === 'string' ? JSON.parse(steps) : steps
}

export function SequencesView({
  templates,
  sequences,
  enrollments,
  expandedSeq,
  setExpandedSeq,
  createFromTemplate,
  setShowEnrollModal,
  updateEnrollment,
  deleteItem,
}: {
  templates: SequenceTemplate[]
  sequences: NurtureSequence[]
  enrollments: NurtureEnrollment[]
  expandedSeq: string | null
  setExpandedSeq: (id: string | null) => void
  createFromTemplate: (key: string) => void
  setShowEnrollModal: (id: string | null) => void
  updateEnrollment: (id: string, action: string) => void
  deleteItem: (id: string, type: 'sequence' | 'enrollment') => void
}) {
  return (
    <div className="space-y-4">
      {/* Template setup cards (no sequences yet) */}
      {templates.length > 0 && sequences.length === 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
          <h3 className="text-sm font-semibold mb-3 text-[var(--color-dark)]">
            Get Started — Pick a Sequence Template
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {templates.map(t => {
              const trigger = TRIGGER_TYPES[t.trigger_type] || { label: t.trigger_type, icon: '\u{2699}\u{FE0F}', color: 'text-[var(--color-body-text)]' }
              return (
                <button
                  key={t.key}
                  onClick={() => createFromTemplate(t.key)}
                  className="p-3 rounded-lg border border-[var(--border-subtle)] text-left transition-colors hover:bg-[var(--color-light-gray)]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{trigger.icon}</span>
                    <span className={`text-xs font-semibold ${trigger.color}`}>{trigger.label}</span>
                  </div>
                  <p className="text-sm font-medium text-[var(--color-dark)]">{t.name}</p>
                  <p className="text-xs text-[var(--color-mid-gray)] mt-0.5">{t.stepCount} steps · SMS + Email</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Add template buttons (when sequences exist) */}
      {sequences.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {templates
            .filter(t => !sequences.find(s => s.trigger_type === t.trigger_type))
            .map(t => (
              <button
                key={t.key}
                onClick={() => createFromTemplate(t.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-gold)] text-[var(--color-light)] rounded-lg text-xs font-medium hover:bg-[var(--color-gold)]/80 transition-colors"
              >
                <Plus size={12} /> Add {t.name}
              </button>
            ))}
        </div>
      )}

      {/* Sequence cards */}
      {sequences.map(seq => {
        const trigger = TRIGGER_TYPES[seq.trigger_type] || { label: seq.trigger_type, icon: '\u{2699}\u{FE0F}', color: 'text-[var(--color-body-text)]' }
        const seqEnrollments = enrollments.filter(e => e.sequence_id === seq.id)
        const activeCount = seqEnrollments.filter(e => e.status === 'active').length
        const steps = parseSteps(seq.steps)
        const isExpanded = expandedSeq === seq.id
        const seqStatus = STATUS_CONFIG[seq.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active

        return (
          <div key={seq.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden">
            {/* Sequence header: the expand toggle and Enroll are siblings (a button can't hold a button) */}
            <div className="flex items-center gap-3 p-4">
              <button
                type="button"
                onClick={() => setExpandedSeq(isExpanded ? null : seq.id)}
                aria-expanded={isExpanded}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="text-lg">{trigger.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-[var(--color-dark)]">{seq.name}</h3>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${seqStatus.bg} ${seqStatus.text}`}>
                      {seqStatus.label}
                    </span>
                    <span className="text-xs text-[var(--color-mid-gray)]">{steps.length} steps</span>
                  </div>
                  <p className="text-xs text-[var(--color-mid-gray)] mt-0.5">
                    {activeCount} active · {seqEnrollments.filter(e => e.status === 'converted').length} converted
                  </p>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-[var(--color-mid-gray)]" /> : <ChevronDown size={16} className="text-[var(--color-mid-gray)]" />}
              </button>
              <button
                type="button"
                onClick={() => setShowEnrollModal(seq.id)}
                className="flex shrink-0 items-center gap-1 px-3 py-1.5 bg-[var(--color-gold)] text-[var(--color-light)] rounded-lg text-xs font-medium hover:bg-[var(--color-gold)]/80"
              >
                <Plus size={12} /> Enroll
              </button>
            </div>

            {/* Expanded: step timeline + enrollments */}
            {isExpanded && (
              <div className="border-t border-[var(--border-subtle)] p-4 space-y-4">
                {/* Step timeline */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 text-[var(--color-mid-gray)]">
                    Sequence Steps
                  </h4>
                  <div className="space-y-2">
                    {steps.map((step, i) => {
                      const ch = CHANNEL_CONFIG[step.channel]
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-7 h-7 rounded-full ${ch.bg} flex items-center justify-center text-xs`}>
                              {step.channel === 'sms'
                                ? <Smartphone size={12} className={ch.color} />
                                : <Mail size={12} className={ch.color} />}
                            </div>
                            {i < steps.length - 1 && (
                              <div className="w-px h-6 bg-[var(--color-light-gray)]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${ch.color}`}>{ch.label}</span>
                              <span className="text-xs text-[var(--color-mid-gray)]">after {formatDelay(step.delay_minutes)}</span>
                              {step.send_window && (
                                <span className="text-xs text-[var(--color-mid-gray)]">
                                  ({step.send_window.start}-{step.send_window.end})
                                </span>
                              )}
                            </div>
                            {step.subject && (
                              <p className="text-xs font-medium text-[var(--color-dark)] mt-0.5">{step.subject}</p>
                            )}
                            <p className="text-xs text-[var(--color-mid-gray)] mt-0.5 line-clamp-2">
                              {step.body.slice(0, 120)}...
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Enrollments for this sequence */}
                {seqEnrollments.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--color-mid-gray)]">
                      Enrollments ({seqEnrollments.length})
                    </h4>
                    <div className="space-y-1">
                      {seqEnrollments.map(e => {
                        const eStatus = STATUS_CONFIG[e.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active
                        return (
                          <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--color-light-gray)]">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-[var(--color-dark)]">
                                  {e.contact_name || e.contact_email || e.contact_phone || 'Unknown'}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${eStatus.bg} ${eStatus.text}`}>
                                  {eStatus.label}
                                </span>
                                <span className="text-[10px] text-[var(--color-mid-gray)]">
                                  Step {e.current_step + 1}/{steps.length}
                                </span>
                              </div>
                              {e.next_send_at && e.status === 'active' && (
                                <p className="text-[10px] text-[var(--color-mid-gray)] flex items-center gap-1 mt-0.5">
                                  <Clock size={9} /> Next: {new Date(e.next_send_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {e.status === 'active' && (
                                <>
                                  <button onClick={() => updateEnrollment(e.id, 'pause')} aria-label="Pause enrollment" className="p-1 rounded hover:bg-[var(--color-light-gray)]" title="Pause">
                                    <Pause size={12} className="text-amber-500" />
                                  </button>
                                  <button onClick={() => updateEnrollment(e.id, 'skip')} aria-label="Skip step" className="p-1 rounded hover:bg-[var(--color-light-gray)]" title="Skip step">
                                    <SkipForward size={12} className="text-[var(--color-body-text)]" />
                                  </button>
                                  <button onClick={() => updateEnrollment(e.id, 'convert')} aria-label="Mark converted" className="p-1 rounded hover:bg-[var(--color-light-gray)]" title="Mark converted">
                                    <UserCheck size={12} className="text-emerald-500" />
                                  </button>
                                </>
                              )}
                              {e.status === 'paused' && (
                                <button onClick={() => updateEnrollment(e.id, 'resume')} aria-label="Resume enrollment" className="p-1 rounded hover:bg-[var(--color-light-gray)]" title="Resume">
                                  <Play size={12} className="text-emerald-500" />
                                </button>
                              )}
                              <button onClick={() => deleteItem(e.id, 'enrollment')} aria-label="Remove enrollment" className="p-1 rounded hover:bg-[var(--color-light-gray)]" title="Remove">
                                <Trash2 size={12} className="text-red-400" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Delete sequence */}
                <div className="flex justify-end">
                  <button
                    onClick={() => deleteItem(seq.id, 'sequence')}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete this sequence
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Empty state */}
      {sequences.length === 0 && templates.length === 0 && (
        <div className="text-center py-10">
          <Zap size={32} className="mx-auto mb-3 text-[var(--color-mid-gray)]" />
          <p className="font-medium text-[var(--color-dark)]">No sequences configured</p>
          <p className="text-sm text-[var(--color-body-text)] mt-1">
            Sequence templates will appear here once the nurture engine is set up.
          </p>
        </div>
      )}
    </div>
  )
}
