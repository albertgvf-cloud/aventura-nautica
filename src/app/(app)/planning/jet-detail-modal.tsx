'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { OFFICES, STATUSES, JETS_SLOTS, durationLabel, timeToMinutes, ALL_SIN_TIT_JETS, ALL_CON_TIT_JETS } from '@/lib/config'

type Reservation = {
  id: string
  activity_type?: string
  activity: string
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
  const [editing, setEditing] = useState(false)

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
  const siblings = groupMembers.filter((s) => s.id !== r.id)
  const allGroupIds = groupMembers.length > 0 ? groupMembers.map((s) => s.id) : [r.id]
  const isCancelled = r.status === 'Cancelada'
  const returnTime = r.time && r.duration_minutes
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
      details: !r.arrived ? `Marcado como llegado — ${jet?.label ?? r.jet_id}` : `Desmarcado llegada — ${jet?.label ?? r.jet_id}`,
    })
    router.refresh()
  }
  async function toggleDeparted() {
    await supabase.from('reservations').update({ departed: !r.departed }).in('id', allGroupIds)
    logAudit({
      reservationId: r.id,
      action: 'departed',
      activityType: 'jets',
      clientName: r.client_name,
      details: !r.departed ? `Marcado como salido — ${jet?.label ?? r.jet_id}` : `Desmarcado salida — ${jet?.label ?? r.jet_id}`,
    })
    router.refresh()
  }
  async function cancelRes() {
    await supabase.from('reservations').update({ status: 'Cancelada' }).in('id', allGroupIds)
    logAudit({
      reservationId: r.id,
      action: 'cancelled',
      activityType: 'jets',
      clientName: r.client_name,
      details: `${r.activity} — ${jet?.label ?? r.jet_id} a las ${r.time?.slice(0, 5)}`,
    })
    router.refresh()
  }
  async function reactivate() {
    await supabase.from('reservations').update({ status: 'Confirmada' }).in('id', allGroupIds)
    logAudit({
      reservationId: r.id,
      action: 'reactivated',
      activityType: 'jets',
      clientName: r.client_name,
      details: `${r.activity} — ${jet?.label ?? r.jet_id} a las ${r.time?.slice(0, 5)}`,
    })
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:rounded-2xl sm:shadow-2xl sm:max-w-lg max-h-full sm:max-h-[80vh] overflow-auto rounded-t-2xl h-[90vh] sm:h-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{r.client_name}</h2>
              <p className="text-sm text-gray-500">
                {r.activity} · {jet?.label ?? r.jet_id ?? '—'} · {r.time?.slice(0, 5)}–{returnTime}
              </p>
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-white bg-red-500 hover:bg-red-600 text-xl font-bold rounded-full shadow-md">&times;</button>
          </div>
        </div>

        {/* Details */}
        <div className="p-4 sm:p-6">
          {!editing ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <Detail label="Cliente" value={r.client_name} cancelled={isCancelled} />
                <Detail label="Teléfono" value={r.phone ?? '—'} />
                <Detail label="Email" value={r.email ?? '—'} />
                <Detail label="Personas" value={String(r.num_people)} />
                <Detail label="Moto" value={jet ? `${jet.label} (${jet.model})` : r.jet_id ?? '—'} />
                <Detail label="Actividad" value={r.activity} />
                <Detail label="Hora" value={`${r.time?.slice(0, 5)} — ${returnTime}`} />
                <Detail label="Duración" value={r.duration_minutes ? durationLabel(r.duration_minutes) : '—'} />
                <Detail label="Atendido por" value={r.staff ?? '—'} />
                <Detail label="Oficina" value={r.office ?? '—'} />
                <Detail label="Estado" value={r.status} badge />
                <Detail label="Llegada" value={r.arrived ? '✓ Llegó' : 'Pendiente'} green={r.arrived} />
              </div>

              {/* Sibling jets in same booking */}
              {siblings.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Reserva con {allGroupIds.length} motos (se modifican todas juntas)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allGroupIds.map((id) => {
                      const res = allReservations.find((s) => s.id === id)
                      const j = allJets.find((jt) => jt.id === res?.jet_id)
                      const isCurrent = id === r.id
                      return (
                        <span key={id} className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          isCurrent ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {j?.label ?? res?.jet_id ?? '?'} {isCurrent && '(actual)'}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {r.notes && (
                <div className="mb-4 p-2 bg-gray-50 rounded-lg text-sm text-gray-700">
                  <span className="text-xs text-gray-500">Notas: </span>{r.notes}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditing(true)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 min-h-[44px]">
                  ✏️ Editar
                </button>
                {!isCancelled && (
                  <>
                    <button onClick={toggleArrived}
                      className={`px-3 py-2 text-sm rounded-lg min-h-[44px] ${r.arrived ? 'bg-green-100 text-green-700 border border-green-300' : 'border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                      {r.arrived ? '✓ Llegó' : 'Marcar llegada'}
                    </button>
                    <button onClick={toggleDeparted}
                      className={`px-3 py-2 text-sm rounded-lg min-h-[44px] ${r.departed ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                      {r.departed ? '⛵ Salió' : 'Marcar salida'}
                    </button>
                    <button onClick={cancelRes}
                      className="px-3 py-2 text-sm border border-red-200 rounded-lg hover:bg-red-50 text-red-600 min-h-[44px]">
                      ✗ Cancelar
                    </button>
                  </>
                )}
                {isCancelled && (
                  <button onClick={reactivate}
                    className="px-3 py-2 text-sm border border-green-200 rounded-lg hover:bg-green-50 text-green-600 min-h-[44px]">
                    ↩ Reactivar
                  </button>
                )}
              </div>
            </>
          ) : (
            <EditForm reservation={r} groupIds={allGroupIds} allReservations={allReservations} staffNames={staffNames} onSaved={() => { setEditing(false); router.refresh() }} onCancel={() => setEditing(false)} />
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value, cancelled, badge, green }: { label: string; value: string; cancelled?: boolean; badge?: boolean; green?: boolean }) {
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <p className={`font-medium ${cancelled ? 'line-through text-gray-400' : green ? 'text-green-700' : 'text-gray-900'}`}>
        {badge ? <StatusBadge status={value} /> : value}
      </p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s: Record<string, string> = { Confirmada: 'bg-green-100 text-green-700', Pendiente: 'bg-amber-100 text-amber-700', Cancelada: 'bg-red-100 text-red-700' }
  return <span className={`px-2 py-0.5 rounded-full text-xs ${s[status] ?? 'bg-gray-100'}`}>{status}</span>
}

function EditForm({ reservation: r, groupIds, allReservations, staffNames, onSaved, onCancel }: {
  reservation: Reservation; groupIds: string[]; allReservations: Reservation[]; staffNames: string[]; onSaved: () => void; onCancel: () => void
}) {
  const supabase = createClient()
  const [clientName, setClientName] = useState(r.client_name)
  const [email, setEmail] = useState(r.email ?? '')
  const [phone, setPhone] = useState(r.phone ?? '')
  const [numPeople, setNumPeople] = useState(r.num_people)
  const [time, setTime] = useState(r.time?.slice(0, 5) ?? '')
  const [duration, setDuration] = useState(r.duration_minutes ?? 60)
  const [staff, setStaff] = useState(r.staff ?? '')
  const [office, setOffice] = useState(r.office ?? '')
  const [status, setStatus] = useState(r.status)
  const [notes, setNotes] = useState(r.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  // Check overlap for a specific jet at new time+duration, excluding this group's own reservations
  function findOverlap(jetId: string, newTime: string, newDur: number): boolean {
    const reqStart = timeToMinutes(newTime)
    const reqEnd = reqStart + newDur
    return allReservations.some((res) => {
      if (groupIds.includes(res.id)) return false // skip own group
      if (res.jet_id !== jetId || res.status === 'Cancelada') return false
      const bStart = timeToMinutes(res.time?.slice(0, 5) ?? '00:00')
      const bEnd = bStart + (res.duration_minutes ?? 60)
      return bStart < reqEnd && bEnd > reqStart
    })
  }

  // Find a free VX for the new time+duration
  function findFreeJet(newTime: string, newDur: number): string | null {
    const allVX = [...ALL_SIN_TIT_JETS, ...ALL_CON_TIT_JETS]
    for (const j of allVX) {
      if (!findOverlap(j.id, newTime, newDur)) return j.id
    }
    return null
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null); setWarning(null)

    // For each jet in the group, check if the new time+duration overlaps
    const groupReservations = allReservations.filter((res) => groupIds.includes(res.id))
    const reassignments: { id: string; newJetId: string }[] = []
    const noAvailability: string[] = []

    for (const res of groupReservations) {
      if (!res.jet_id) continue
      if (findOverlap(res.jet_id, time, duration)) {
        // This jet has a conflict — find another
        const freeJet = findFreeJet(time, duration)
        if (freeJet) {
          reassignments.push({ id: res.id, newJetId: freeJet })
        } else {
          noAvailability.push(res.jet_id)
        }
      }
    }

    if (noAvailability.length > 0) {
      const jetLabels = noAvailability.map((id) => allJets.find((j) => j.id === id)?.label ?? id).join(', ')
      setError(`No hay motos disponibles para reubicar: ${jetLabels}. Cambia la hora o duración.`)
      setSaving(false)
      return
    }

    // Update shared fields for all in group
    const { error: err } = await supabase.from('reservations').update({
      client_name: clientName.trim(), email: email || null, phone: phone || null,
      num_people: numPeople, time: time + ':00', duration_minutes: duration,
      staff: staff || null, office: office || null, status, notes: notes || null,
    }).in('id', groupIds)

    if (err) { setError(err.message); setSaving(false); return }

    // Reassign jets that had conflicts
    for (const { id, newJetId } of reassignments) {
      await supabase.from('reservations').update({ jet_id: newJetId }).eq('id', id)
    }

    setSaving(false)

    // Build change details
    const changes: string[] = []
    if (clientName.trim() !== r.client_name) changes.push(`Nombre: ${r.client_name}→${clientName.trim()}`)
    if (time !== (r.time?.slice(0, 5) ?? '')) changes.push(`Hora: ${r.time?.slice(0, 5)}→${time}`)
    if (duration !== (r.duration_minutes ?? 60)) changes.push(`Duración: ${durationLabel(r.duration_minutes ?? 60)}→${durationLabel(duration)}`)
    if (numPeople !== r.num_people) changes.push(`Personas: ${r.num_people}→${numPeople}`)
    if ((staff || null) !== r.staff) changes.push(`Staff: ${r.staff ?? '—'}→${staff || '—'}`)
    if ((office || null) !== r.office) changes.push(`Oficina: ${r.office ?? '—'}→${office || '—'}`)
    if (status !== r.status) changes.push(`Estado: ${r.status}→${status}`)
    if ((email || null) !== r.email) changes.push('Email cambiado')
    if ((phone || null) !== r.phone) changes.push('Teléfono cambiado')
    if ((notes || null) !== r.notes) changes.push('Notas cambiadas')
    if (reassignments.length > 0) changes.push(`Motos reubicadas: ${reassignments.length}`)

    logAudit({
      reservationId: r.id,
      action: 'modified',
      activityType: 'jets',
      clientName: clientName.trim(),
      performedBy: staff || undefined,
      details: changes.length > 0 ? changes.join(', ') : 'Sin cambios detectados',
    })

    if (reassignments.length > 0) {
      const moves = reassignments.map(({ id, newJetId }) => {
        const oldJet = groupReservations.find((res) => res.id === id)
        const oldLabel = allJets.find((j) => j.id === oldJet?.jet_id)?.label ?? '?'
        const newLabel = allJets.find((j) => j.id === newJetId)?.label ?? '?'
        return `${oldLabel} → ${newLabel}`
      }).join(', ')
      alert(`Reserva guardada. Motos reubicadas por solapamiento: ${moves}`)
    }

    onSaved()
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Nombre"><input type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)} className="inp" /></Field>
        <Field label="Teléfono *"><input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="inp" /></Field>
        <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="inp" /></Field>
        <Field label="Personas"><input type="number" min={1} value={numPeople} onChange={(e) => setNumPeople(Number(e.target.value))} className="inp" /></Field>
        <Field label="Hora">
          <select value={time} onChange={(e) => setTime(e.target.value)} className="inp">
            {JETS_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Duración (min)"><input type="number" min={10} step={10} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="inp" /></Field>
        <Field label="Atendido por *">
          <select value={staff} onChange={(e) => setStaff(e.target.value)} className="inp" required>
            <option value="">—</option>
            {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Oficina">
          <select value={office} onChange={(e) => setOffice(e.target.value)} className="inp">
            <option value="">—</option>
            {OFFICES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="inp">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Notas"><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="inp" placeholder="Notas..." /></Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400 text-white text-sm rounded-lg font-medium min-h-[44px]">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 min-h-[44px]">
          Cancelar
        </button>
      </div>
      <style>{`.inp{width:100%;padding:0.375rem 0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.8rem;color:#111827;outline:none;min-height:36px}.inp:focus{border-color:transparent;box-shadow:0 0 0 2px #0ea5e9}`}</style>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs text-gray-500 mb-0.5">{label}</span>{children}</label>
}
