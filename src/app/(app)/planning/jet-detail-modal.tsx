'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import {
  OFFICES,
  JETS_SLOTS,
  durationLabel,
  timeToMinutes,
  ALL_SIN_TIT_JETS,
  ALL_CON_TIT_JETS,
  INCIDENT_TYPES,
  INCIDENT_RESOLUTIONS,
} from '@/lib/config'

type Reservation = {
  id: string
  activity_type?: string
  activity: string
  date?: string
  time: string
  num_people: number
  client_name: string
  email: string | null
  phone: string | null
  staff: string | null
  office: string | null
  status: string
  arrived: boolean
  departed: boolean
  jet_id: string | null
  duration_minutes: number | null
  notes: string | null
  group_id: string | null
  incident_type?: string | null
  incident_comment?: string | null
  incident_resolution?: string | null
  incident_refund_amount?: number | null
  incident_refund_type?: string | null
}

const allJets = [...ALL_SIN_TIT_JETS, ...ALL_CON_TIT_JETS]

export default function JetDetailModal({
  reservation: r,
  allReservations,
  staffNames,
  onClose,
}: {
  reservation: Reservation
  allReservations: Reservation[]
  staffNames: string[]
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()

  const jet = allJets.find((j) => j.id === r.jet_id)

  // Find sibling reservations (same group OR same client+time+date if no group_id)
  const groupMembers = r.group_id
    ? allReservations.filter((s) => s.group_id === r.group_id)
    : allReservations.filter((s) =>
        s.activity_type === 'jets' &&
        s.client_name === r.client_name &&
        s.time?.slice(0, 5) === r.time?.slice(0, 5) &&
        s.status !== 'Cancelada'
      )
  const allGroupIds = groupMembers.length > 0 ? groupMembers.map((s) => s.id) : [r.id]
  const isCancelled = r.status === 'Cancelada'
  const returnTime =
    r.time && r.duration_minutes
      ? (() => {
          const [h, m] = r.time.slice(0, 5).split(':').map(Number)
          const total = h * 60 + m + r.duration_minutes
          return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
        })()
      : '—'

  async function toggleArrived() {
    await supabase.from('reservations').update({ arrived: !r.arrived }).in('id', allGroupIds)
    logAudit({
      reservationId: r.id,
      action: 'arrived',
      activityType: 'jets',
      clientName: r.client_name,
      details: !r.arrived
        ? `Marcado como llegado — ${jet?.label ?? r.jet_id}`
        : `Desmarcado llegada — ${jet?.label ?? r.jet_id}`,
    })
    router.refresh()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:rounded-2xl sm:shadow-2xl sm:max-w-2xl max-h-full sm:max-h-[90vh] overflow-auto rounded-t-2xl h-[95vh] sm:h-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{r.client_name}</h2>
              <p className="text-sm text-gray-500 truncate">
                {r.activity} · {jet?.label ?? r.jet_id ?? '—'} · {r.time?.slice(0, 5)}–{returnTime}
                {groupMembers.length > 1 && <span> · grupo de {groupMembers.length} motos</span>}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-white bg-red-500 hover:bg-red-600 text-xl font-bold rounded-full shadow-md shrink-0"
            >
              &times;
            </button>
          </div>
          {!isCancelled && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={toggleArrived}
                className={`px-3 py-2 text-sm rounded-lg min-h-[44px] font-medium ${
                  r.arrived
                    ? 'bg-green-600 text-white border border-green-600'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {r.arrived ? '✓ Llegado' : 'Llegado'}
              </button>
            </div>
          )}
        </div>

        {/* Edit form directly */}
        <div className="p-4 sm:p-6">
          <EditForm
            reservation={r}
            groupMembers={groupMembers}
            allReservations={allReservations}
            staffNames={staffNames}
            onSaved={() => {
              router.refresh()
              onClose()
            }}
          />
        </div>
      </div>
    </div>
  )
}

function EditForm({
  reservation: r,
  groupMembers,
  allReservations,
  staffNames,
  onSaved,
}: {
  reservation: Reservation
  groupMembers: Reservation[]
  allReservations: Reservation[]
  staffNames: string[]
  onSaved: () => void
}) {
  const supabase = createClient()
  const [clientName, setClientName] = useState(r.client_name)
  const [email, setEmail] = useState(r.email ?? '')
  const [phone, setPhone] = useState(r.phone ?? '')
  const [time, setTime] = useState(r.time?.slice(0, 5) ?? '')
  const [duration, setDuration] = useState(r.duration_minutes ?? 60)
  const [staff, setStaff] = useState(r.staff ?? '')
  const [office, setOffice] = useState(r.office ?? '')
  const [notes, setNotes] = useState(r.notes ?? '')
  const [incidentType, setIncidentType] = useState(r.incident_type ?? '')
  const [incidentComment, setIncidentComment] = useState(r.incident_comment ?? '')
  const [incidentResolution, setIncidentResolution] = useState(r.incident_resolution ?? '')
  const [refundAmount, setRefundAmount] = useState<string>(
    r.incident_refund_amount != null ? String(r.incident_refund_amount) : ''
  )
  const allGroupIds = groupMembers.length > 0 ? groupMembers.map((m) => m.id) : [r.id]
  const [affectedIds, setAffectedIds] = useState<string[]>(allGroupIds)
  const [newDate, setNewDate] = useState(r.date ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasIncident = incidentType !== ''
  const canSplit = groupMembers.length > 1
  const showDateChange = hasIncident && incidentResolution === 'Cambio de dia'
  const isVoucher = hasIncident && incidentResolution === 'Cancelar + generar vale'
  const isRefund = hasIncident && incidentResolution === 'Cancelar + devolucion'
  const isCancelling = isVoucher || isRefund
  const showAmount = isVoucher || isRefund
  const affectedCount = canSplit ? affectedIds.length : allGroupIds.length
  const isPartial = hasIncident && incidentResolution !== '' && canSplit && affectedCount < allGroupIds.length

  function toggleAffected(id: string) {
    setAffectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function findOverlap(jetId: string, newTime: string, newDur: number): boolean {
    const reqStart = timeToMinutes(newTime)
    const reqEnd = reqStart + newDur
    return allReservations.some((res) => {
      if (allGroupIds.includes(res.id)) return false
      if (res.jet_id !== jetId || res.status === 'Cancelada') return false
      const bStart = timeToMinutes(res.time?.slice(0, 5) ?? '00:00')
      const bEnd = bStart + (res.duration_minutes ?? 60)
      return bStart < reqEnd && bEnd > reqStart
    })
  }

  function findFreeJet(newTime: string, newDur: number): string | null {
    for (const j of allJets) {
      if (!findOverlap(j.id, newTime, newDur)) return j.id
    }
    return null
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const parsedAmount = refundAmount.trim() === '' ? null : Number(refundAmount)

    // Shared client-info fields — always applied to all motos in the group
    const sharedFields = {
      client_name: clientName.trim(),
      email: email || null,
      phone: phone || null,
      staff: staff || null,
      office: office || null,
      notes: notes || null,
    }

    // Determine which IDs the incident applies to (default = all in group)
    const incidentIds = hasIncident ? (canSplit ? affectedIds : allGroupIds) : []
    const untouchedIds = allGroupIds.filter((id) => !incidentIds.includes(id))

    // If changing time+duration on untouched motos, check jet overlaps
    const reassignments: { id: string; newJetId: string }[] = []
    const noAvailability: string[] = []
    for (const id of untouchedIds) {
      const member = groupMembers.find((m) => m.id === id) ?? r
      if (!member.jet_id) continue
      if (findOverlap(member.jet_id, time, duration)) {
        const freeJet = findFreeJet(time, duration)
        if (freeJet) reassignments.push({ id, newJetId: freeJet })
        else noAvailability.push(member.jet_id)
      }
    }
    if (noAvailability.length > 0) {
      const labels = noAvailability.map((id) => allJets.find((j) => j.id === id)?.label ?? id).join(', ')
      setError(`No hay motos disponibles para reubicar: ${labels}. Cambia la hora o duracion.`)
      setSaving(false)
      return
    }

    // 1) Update untouched members with shared fields + new time/duration (no incident)
    if (untouchedIds.length > 0) {
      const untouchedUpdate: Record<string, unknown> = {
        ...sharedFields,
        time: time + ':00',
        duration_minutes: duration,
        status: 'Confirmada',
        incident_type: null,
        incident_comment: null,
        incident_resolution: null,
        incident_refund_amount: null,
        incident_refund_type: null,
      }
      const { error: err } = await supabase.from('reservations').update(untouchedUpdate).in('id', untouchedIds)
      if (err) { setError(err.message); setSaving(false); return }
      for (const { id, newJetId } of reassignments) {
        await supabase.from('reservations').update({ jet_id: newJetId }).eq('id', id)
      }
    }

    // 2) Update incident members (if any) with incident fields + appropriate status/date/time
    if (incidentIds.length > 0) {
      const incidentUpdate: Record<string, unknown> = {
        ...sharedFields,
        duration_minutes: duration,
        status: isCancelling ? 'Cancelada' : 'Confirmada',
        incident_type: incidentType,
        incident_comment: incidentComment || null,
        incident_resolution: incidentResolution || null,
        incident_refund_amount: showAmount ? parsedAmount : null,
        incident_refund_type: null,
      }
      if (showDateChange) {
        incidentUpdate.date = newDate || r.date
        incidentUpdate.time = time + ':00'
      } else {
        incidentUpdate.time = time + ':00'
      }
      const { error: err } = await supabase.from('reservations').update(incidentUpdate).in('id', incidentIds)
      if (err) { setError(err.message); setSaving(false); return }
    }

    // Audit
    logAudit({
      reservationId: r.id,
      action: 'modified',
      activityType: 'jets',
      clientName: clientName.trim(),
      performedBy: staff || undefined,
      details: hasIncident
        ? `Incidencia ${isPartial ? 'parcial' : 'total'}: ${incidentIds.length}/${allGroupIds.length} motos · ${incidentResolution}${parsedAmount != null ? ` · ${parsedAmount}€` : ''}`
        : 'Datos actualizados',
    })

    setSaving(false)
    onSaved()
  }

  const unitLabel = 'motos'

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <p className="text-xs text-gray-500">Edicion de reserva</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        <Field label="Nombre">
          <input type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)} className="inp" />
        </Field>
        <Field label="Teléfono *">
          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="inp" />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="inp" />
        </Field>
        <Field label="N Motos">
          <input
            type="number"
            value={allGroupIds.length}
            disabled
            className="inp bg-gray-100 text-gray-500 cursor-not-allowed"
            title="Para reducir, crea una incidencia y ajusta las motos afectadas"
          />
        </Field>
        <Field label="Hora">
          <select value={time} onChange={(e) => setTime(e.target.value)} className="inp">
            {JETS_SLOTS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Duracion (min)">
          <input type="number" min={10} step={10} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="inp" />
        </Field>
        <Field label="Atendido por *">
          <select value={staff} onChange={(e) => setStaff(e.target.value)} className="inp" required>
            <option value="">--</option>
            {staffNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </Field>
        <Field label="Oficina">
          <select value={office} onChange={(e) => setOffice(e.target.value)} className="inp">
            <option value="">--</option>
            {OFFICES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
        <div className="col-span-full">
          <Field label="Notas">
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="inp" placeholder="Notas..." />
          </Field>
        </div>
      </div>

      {/* Incident section */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Incidencia</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Tipo de incidencia">
            <select value={incidentType} onChange={(e) => setIncidentType(e.target.value)} className="inp">
              <option value="">Sin incidencia</option>
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          {hasIncident && (
            <div className="col-span-full sm:col-span-3">
              <Field label="Comentario incidencia">
                <textarea
                  value={incidentComment}
                  onChange={(e) => setIncidentComment(e.target.value)}
                  className="inp"
                  placeholder="Detalles de la incidencia..."
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </Field>
            </div>
          )}
        </div>

        {/* Step 1: affected scope (only if group has >1 moto) */}
        {hasIncident && canSplit && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              1. ¿A cuantas {unitLabel} afecta la incidencia?
            </p>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <button
                type="button"
                onClick={() => setAffectedIds(allGroupIds)}
                className={`px-3 py-2 text-sm rounded-lg border font-medium min-h-[44px] ${
                  affectedCount === allGroupIds.length
                    ? 'bg-sky-600 border-sky-600 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-sky-50'
                }`}
              >
                Todas las motos ({allGroupIds.length})
              </button>
              <button
                type="button"
                onClick={() => setAffectedIds(allGroupIds.slice(0, 1))}
                className={`px-3 py-2 text-sm rounded-lg border font-medium min-h-[44px] ${
                  affectedCount < allGroupIds.length
                    ? 'bg-sky-600 border-sky-600 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-sky-50'
                }`}
              >
                Parcial
              </button>
            </div>
            {affectedCount < allGroupIds.length && (
              <div className="p-2 border border-sky-200 bg-sky-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Marca las motos afectadas:</p>
                <div className="flex flex-wrap gap-2">
                  {groupMembers.map((m) => {
                    const j = allJets.find((jt) => jt.id === m.jet_id)
                    const checked = affectedIds.includes(m.id)
                    return (
                      <label key={m.id} className={`px-2 py-1.5 rounded-lg text-xs border cursor-pointer flex items-center gap-1.5 ${
                        checked ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-white border-gray-300 text-gray-700'
                      }`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAffected(m.id)}
                          className="accent-amber-600"
                        />
                        {j?.label ?? m.jet_id ?? '?'}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: resolution */}
        {hasIncident && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              {canSplit ? '2. ' : ''}Solucion de la incidencia
            </p>
            <div className="flex flex-wrap gap-2">
              {INCIDENT_RESOLUTIONS.map((o) => {
                const active = incidentResolution === o
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setIncidentResolution(active ? '' : o)}
                    className={`px-3 py-2 text-sm rounded-lg border font-medium min-h-[44px] ${
                      active
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-amber-50 hover:border-amber-400'
                    }`}
                  >
                    {o}
                  </button>
                )
              })}
            </div>
            {isRefund && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Antes de procesar una devolucion, intenta ofrecer al cliente un cambio de dia o un vale.
              </div>
            )}
            {incidentResolution && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {showDateChange && (
                  <>
                    <Field label="Nuevo dia">
                      <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="inp" />
                    </Field>
                    <Field label="Nueva hora">
                      <select value={time} onChange={(e) => setTime(e.target.value)} className="inp">
                        {JETS_SLOTS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
                {showAmount && (
                  <Field label={isVoucher ? 'Importe del vale (€)' : 'Importe a devolver (€)'}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="inp"
                      placeholder="0.00"
                    />
                  </Field>
                )}
              </div>
            )}
            {isPartial && (
              <p className="mt-2 text-xs text-sky-700">
                {allGroupIds.length - affectedCount} {unitLabel} permaneceran, {affectedCount} {unitLabel} con incidencia.
              </p>
            )}
            {isCancelling && !isPartial && (
              <p className="mt-2 text-xs text-gray-600">
                Al guardar, {canSplit ? 'todas las motos quedaran' : 'la reserva quedara'} marcada como Cancelada.
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2.5 sm:py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400 text-white text-sm rounded-lg font-medium min-h-[44px] sm:min-h-0 w-full sm:w-auto"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
      <style>{`
        .inp { width: 100%; padding: 0.625rem 0.5rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 0.8rem; color: #111827; outline: none; min-height: 44px; }
        @media (min-width: 640px) { .inp { padding: 0.375rem 0.5rem; min-height: auto; } }
        .inp:focus { border-color: transparent; box-shadow: 0 0 0 2px #0ea5e9; }
        textarea.inp { min-height: 60px; }
      `}</style>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-500 mb-0.5">{label}</span>
      {children}
    </label>
  )
}
