'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { OFFICES, STATUSES, TIME_SLOTS, INCIDENT_TYPES, INCIDENT_RESOLUTIONS, INCIDENT_AUTHORIZERS } from '@/lib/config'
import { getStoredOffice } from '@/lib/office'

type Reservation = {
  id: string
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
  notes: string | null
  incident_type: string | null
  incident_comment: string | null
  incident_resolution: string | null
  incident_refund_amount: number | null
  incident_refund_type: string | null
  incident_resolved_by: string | null
  incident_authorized_by: string | null
}

export default function SlotModal({
  slot,
  activityName,
  activityType,
  activityColor,
  capacity,
  date,
  reservations,
  staffNames,
  initialEditingId,
  initialAddMode,
  onClose,
}: {
  slot: string
  activityName: string
  activityType: string
  activityColor: string
  capacity: number
  date: string
  reservations: Reservation[]
  staffNames: string[]
  initialEditingId?: string
  initialAddMode?: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [editingId, setEditingId] = useState<string | null>(initialEditingId ?? null)
  const [showAddForm, setShowAddForm] = useState(initialAddMode ?? false)

  const active = reservations.filter((r) => r.status !== 'Cancelada')
  const totalPeople = active.reduce((s, r) => s + r.num_people, 0)
  const arrivedCount = active.filter((r) => r.arrived).length
  const allDeparted = active.length > 0 && active.every((r) => r.departed)

  async function markAllDeparted() {
    // Arrived clients → Realizada, non-arrived → just mark departed
    const arrivedIds = active.filter((r) => r.arrived).map((r) => r.id)
    const notArrivedIds = active.filter((r) => !r.arrived).map((r) => r.id)
    if (arrivedIds.length > 0) {
      await supabase.from('reservations').update({ departed: true, status: 'Realizada' }).in('id', arrivedIds)
    }
    if (notArrivedIds.length > 0) {
      await supabase.from('reservations').update({ departed: true }).in('id', notArrivedIds)
    }
    for (const res of active) {
      logAudit({
        reservationId: res.id,
        action: 'departed',
        activityType,
        clientName: res.client_name,
        details: `${activityName} a las ${slot} - salida grupal`,
      })
    }
    router.refresh()
  }

  async function unmarkAllDeparted() {
    // Revert Realizada → Confirmada only for those we promoted on mark; other statuses stay.
    const realizadaIds = active.filter((r) => r.status === 'Realizada').map((r) => r.id)
    const restIds = active.filter((r) => r.status !== 'Realizada').map((r) => r.id)
    if (realizadaIds.length > 0) {
      await supabase.from('reservations').update({ departed: false, status: 'Confirmada' }).in('id', realizadaIds)
    }
    if (restIds.length > 0) {
      await supabase.from('reservations').update({ departed: false }).in('id', restIds)
    }
    for (const res of active) {
      logAudit({
        reservationId: res.id,
        action: 'departed',
        activityType,
        clientName: res.client_name,
        details: `${activityName} a las ${slot} - desmarcado salida grupal`,
      })
    }
    router.refresh()
  }

  async function confirmReservation(id: string, res: Reservation) {
    await supabase.from('reservations').update({ status: 'Confirmada' }).eq('id', id)
    logAudit({
      reservationId: id,
      action: 'reactivated',
      activityType,
      clientName: res.client_name,
      details: `${activityName} a las ${slot}`,
    })
    router.refresh()
  }

  async function toggleArrived(id: string, current: boolean, res: Reservation) {
    await supabase.from('reservations').update({ arrived: !current }).eq('id', id)
    logAudit({
      reservationId: id,
      action: 'arrived',
      activityType,
      clientName: res.client_name,
      details: !current ? 'Marcado como llegado' : 'Desmarcado llegada',
    })
    router.refresh()
  }


  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:rounded-2xl sm:shadow-2xl sm:max-w-3xl max-h-full sm:max-h-[90vh] overflow-hidden
                   rounded-t-2xl sm:rounded-b-2xl
                   h-[95vh] sm:h-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200" style={{ borderTopColor: activityColor, borderTopWidth: 4 }}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">{activityName} -- {slot}</h2>
              <p className="text-xs sm:text-sm text-gray-500">
                {totalPeople}/{capacity} personas · {arrivedCount}/{active.length} llegaron
                {totalPeople > capacity && <span className="text-amber-600 font-medium"> (sobrecapacidad)</span>}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-2xl leading-none w-10 h-10 flex items-center justify-center shrink-0 rounded-lg hover:bg-gray-100"
            >
              &times;
            </button>
          </div>
          {/* Actions: add reservation + departure */}
          <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowAddForm(true)}
              className="px-3 py-2 sm:py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium min-h-[44px] sm:min-h-0"
            >
              + Añadir reserva
            </button>
            {active.length > 0 && (
              <>
                {allDeparted ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">Actividad ha salido</span>
                    <button
                      onClick={unmarkAllDeparted}
                      className="text-xs text-gray-500 hover:text-gray-700 underline min-h-[44px] sm:min-h-0"
                    >
                      Desmarcar salida
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={markAllDeparted}
                    className="px-3 py-2 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium min-h-[44px] sm:min-h-0"
                  >
                    Marcar salida de actividad
                  </button>
                )}
                {arrivedCount < active.length && !allDeparted && (
                  <span className="text-xs text-amber-600">
                    {active.length - arrivedCount} cliente(s) no han llegado aun
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Reservations list + Add form */}
        <div className="overflow-auto flex-1 p-3 sm:p-4">
          {reservations.length === 0 && !showAddForm ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-3">No hay reservas en esta franja.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium"
              >
                + Añadir primera reserva
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map((r) => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
                  isEditing={editingId === r.id}
                  staffNames={staffNames}
                  date={date}
                  activityType={activityType}
                  activityName={activityName}
                  onEdit={() => setEditingId(editingId === r.id ? null : r.id)}
                  onConfirm={() => confirmReservation(r.id, r)}
                  onToggleArrived={() => toggleArrived(r.id, r.arrived, r)}
                  onSaved={() => { setEditingId(null); router.refresh() }}
                />
              ))}

              {/* Add reservation button / form */}
              {showAddForm ? (
                <QuickAddForm
                  activityType={activityType}
                  activityName={activityName}
                  date={date}
                  time={slot}
                  staffNames={staffNames}
                  onSaved={() => { setShowAddForm(false); router.refresh() }}
                  onCancel={() => setShowAddForm(false)}
                />
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50/50 transition-colors min-h-[44px]"
                >
                  + Añadir reserva en esta franja
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReservationCard({
  reservation: r,
  isEditing,
  staffNames,
  date,
  activityType,
  activityName,
  onEdit,
  onConfirm,
  onToggleArrived,
  onSaved,
}: {
  reservation: Reservation
  isEditing: boolean
  staffNames: string[]
  date: string
  activityType: string
  activityName: string
  onEdit: () => void
  onConfirm: () => void
  onToggleArrived: () => void
  onSaved: () => void
}) {
  const isCancelled = r.status === 'Cancelada'

  return (
    <div className={`border rounded-xl p-3 sm:p-4 ${
      isCancelled ? 'border-red-200 bg-red-50/50 opacity-60' :
      r.departed && !r.arrived ? 'border-amber-300 bg-amber-50/50' :
      r.departed ? 'border-blue-200 bg-blue-50/50' :
      r.arrived ? 'border-green-200 bg-green-50/50' :
      'border-gray-200'
    }`}>
      {/* Mobile: stack vertically, Desktop: side by side */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
          {/* Checkbox de llegada */}
          {!isCancelled && !isEditing && (
            <input
              type="checkbox"
              checked={r.arrived}
              onChange={onToggleArrived}
              className="w-6 h-6 sm:w-5 sm:h-5 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer accent-green-600 shrink-0"
              title={r.arrived ? 'Llego — clic para desmarcar' : 'Marcar llegada'}
            />
          )}
          {isEditing ? (
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-gray-900 text-base ${isCancelled ? 'line-through' : ''}`}>{r.client_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">Edicion de reserva</p>
            </div>
          ) : (
            <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1.5 sm:gap-2 text-sm">
              <div>
                <span className="text-xs text-gray-500">Cliente</span>
                <p className={`font-medium text-gray-900 ${isCancelled ? 'line-through' : ''}`}>{r.client_name}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Teléfono</span>
                <p className="text-gray-700">{r.phone ?? '--'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Email</span>
                <p className="text-gray-700 truncate">{r.email ?? '--'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Personas</span>
                <p className="font-semibold text-gray-900">{r.num_people}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Atendido por</span>
                <p className="text-gray-700">{r.staff ?? '--'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Oficina</span>
                <p className="text-gray-700">{r.office ?? '--'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Estado</span>
                <p><StatusBadge status={r.status} /></p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Llegada</span>
                <p className={r.arrived ? 'text-green-700 font-medium' : 'text-gray-400'}>
                  {r.arrived ? 'Llego' : 'Pendiente'}
                </p>
              </div>
              {r.departed && !r.arrived && (
                <div className="col-span-full">
                  <p className="text-sm text-amber-700 font-medium">
                    La actividad salio sin este cliente -- usa &quot;Detalle&quot; para cambiar la hora y reubicarlo
                  </p>
                </div>
              )}
              {r.incident_type && (
                <div className="col-span-full">
                  <span className="text-xs text-gray-500">Incidencia</span>
                  <p className="text-amber-700 font-medium">{r.incident_type}</p>
                  {r.incident_resolution && (
                    <p className="text-amber-800 text-xs mt-0.5">
                      Solucion: {r.incident_resolution}
                      {r.incident_refund_amount != null && (
                        <> · {r.incident_refund_amount}€</>
                      )}
                    </p>
                  )}
                  {(r.incident_resolved_by || r.incident_authorized_by) && (
                    <p className="text-gray-600 text-xs mt-0.5">
                      {r.incident_resolved_by && <>Gestionada por {r.incident_resolved_by}</>}
                      {r.incident_resolved_by && r.incident_authorized_by && ' · '}
                      {r.incident_authorized_by && <>Autoriza: {r.incident_authorized_by}</>}
                    </p>
                  )}
                  {r.incident_comment && <p className="text-gray-600 text-xs mt-0.5">{r.incident_comment}</p>}
                </div>
              )}
              {r.notes && (
                <div className="col-span-full">
                  <span className="text-xs text-gray-500">Notas</span>
                  <p className="text-gray-700">{r.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Action buttons - horizontal on mobile, vertical on desktop */}
        <div className="flex flex-row sm:flex-col gap-1.5 sm:gap-1 shrink-0 overflow-x-auto">
          {!isCancelled && (
            <>
              <button onClick={onToggleArrived} className={`px-3 py-2 sm:py-1.5 text-sm rounded-lg min-h-[44px] sm:min-h-0 whitespace-nowrap font-medium ${
                r.arrived ? 'bg-green-600 text-white border border-green-600' : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}>
                {r.arrived ? '✓ Llegado' : 'Llegado'}
              </button>
              <button onClick={onEdit} className={`px-3 py-2 sm:py-1.5 text-sm rounded-lg min-h-[44px] sm:min-h-0 whitespace-nowrap font-medium ${
                isEditing ? 'bg-sky-600 text-white border border-sky-600' : 'border border-sky-300 text-sky-700 hover:bg-sky-50'
              }`}>
                {isEditing ? 'Cerrar detalle' : 'Detalle'}
              </button>
            </>
          )}
          {isCancelled && (
            <button onClick={onConfirm} className="px-3 py-2 sm:py-1.5 text-sm border border-green-200 rounded-lg hover:bg-green-50 text-green-600 min-h-[44px] sm:min-h-0 whitespace-nowrap font-medium">
              Reactivar
            </button>
          )}
        </div>
      </div>

      {isEditing && !isCancelled && (
        <EditForm reservation={r} staffNames={staffNames} date={date} activityType={activityType} activityName={activityName} onSaved={onSaved} />
      )}
    </div>
  )
}

function EditForm({
  reservation: r,
  staffNames,
  date,
  activityType,
  activityName,
  onSaved,
}: {
  reservation: Reservation
  staffNames: string[]
  date: string
  activityType: string
  activityName: string
  onSaved: () => void
}) {
  const supabase = createClient()
  const [clientName, setClientName] = useState(r.client_name)
  const [email, setEmail] = useState(r.email ?? '')
  const [phone, setPhone] = useState(r.phone ?? '')
  const [time, setTime] = useState(r.time?.slice(0, 5) ?? '')
  const [staff, setStaff] = useState(r.staff ?? '')
  const [office, setOffice] = useState(r.office ?? '')
  const [status, setStatus] = useState(r.status)
  const [notes, setNotes] = useState(r.notes ?? '')
  const [incidentType, setIncidentType] = useState(r.incident_type ?? '')
  const [incidentComment, setIncidentComment] = useState(r.incident_comment ?? '')
  const [incidentResolution, setIncidentResolution] = useState(r.incident_resolution ?? '')
  const [refundAmount, setRefundAmount] = useState<string>(
    r.incident_refund_amount != null ? String(r.incident_refund_amount) : ''
  )
  const [resolvedBy, setResolvedBy] = useState(r.incident_resolved_by ?? '')
  const [authorizedBy, setAuthorizedBy] = useState(r.incident_authorized_by ?? '')
  const [affected, setAffected] = useState(r.num_people)
  const [newDate, setNewDate] = useState(date)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasIncident = incidentType !== ''
  const isJets = activityType === 'jets'
  const unitLabel = isJets ? 'motos' : 'personas'
  const canSplit = !isJets && r.num_people > 1
  const showDateChange = hasIncident && incidentResolution === 'Cambio de dia'
  const isVoucher = hasIncident && incidentResolution === 'Cancelar + generar vale'
  const isRefund = hasIncident && incidentResolution === 'Cancelar + devolucion'
  const isCancelling = isVoucher || isRefund
  const showAmount = isVoucher || isRefund
  // How many people/motos this incident applies to. Full reservation by default.
  const affectedCount = canSplit ? Math.max(1, Math.min(r.num_people, affected)) : r.num_people
  const isPartial = hasIncident && incidentResolution !== '' && affectedCount < r.num_people

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Require resolver + authorizer whenever a resolution is picked
    if (hasIncident && incidentResolution) {
      if (!resolvedBy) {
        setError('Indica qué comercial ha gestionado la resolucion.')
        setSaving(false)
        return
      }
      if (!authorizedBy) {
        setError('Indica quién ha autorizado la resolucion (o "Sin autorizacion").')
        setSaving(false)
        return
      }
    }

    const trimmedAmount = refundAmount.trim()
    const parsedAmountRaw = trimmedAmount === '' ? null : Number(trimmedAmount)
    if (parsedAmountRaw != null && Number.isNaN(parsedAmountRaw)) {
      setError('El importe no es un numero valido.')
      setSaving(false)
      return
    }
    const parsedAmount = parsedAmountRaw

    // Shared client-info fields (apply to all rows we touch)
    const clientFields = {
      client_name: clientName.trim(),
      email: email || null,
      phone: phone || null,
      staff: staff || null,
      office: office || null,
      notes: notes || null,
    }

    if (isPartial) {
      // Split: original row keeps (num_people - affectedCount) unaffected people; new row carries the incident
      const remaining = r.num_people - affectedCount

      // For partial splits, the "staying" portion keeps its original time/date.
      // Time/date changes only apply to the moved portion (the newRow).
      const originalUpdate: Record<string, unknown> = {
        ...clientFields,
        num_people: remaining,
        status,
        // Clear incident fields on the remaining portion
        incident_type: null,
        incident_comment: null,
        incident_resolution: null,
        incident_refund_amount: null,
        incident_refund_type: null,
        incident_resolved_by: null,
        incident_authorized_by: null,
      }

      const newRow: Record<string, unknown> = {
        ...clientFields,
        activity_type: activityType,
        activity: activityName,
        date: showDateChange ? newDate : date,
        time: time + ':00',
        num_people: affectedCount,
        status: isCancelling ? 'Cancelada' : 'Confirmada',
        incident_type: incidentType,
        incident_comment: incidentComment || null,
        incident_resolution: incidentResolution,
        incident_refund_amount: showAmount ? parsedAmount : null,
        incident_refund_type: null,
        incident_resolved_by: resolvedBy || null,
        incident_authorized_by: authorizedBy || null,
      }

      // Step 1: insert the new row FIRST so a failure leaves the original untouched
      const { error: insErr } = await supabase.from('reservations').insert(newRow)
      if (insErr) { setSaving(false); setError(insErr.message); return }

      // Step 2: update the original to subtract affected people
      const { error: updErr } = await supabase.from('reservations').update(originalUpdate).eq('id', r.id)
      if (updErr) {
        // Best-effort rollback: delete the just-inserted row by matching its unique fields
        await supabase
          .from('reservations')
          .delete()
          .match({
            activity_type: newRow.activity_type,
            activity: newRow.activity,
            date: newRow.date,
            time: newRow.time,
            client_name: newRow.client_name,
            num_people: newRow.num_people,
          })
        setSaving(false); setError(updErr.message); return
      }

      logAudit({
        reservationId: r.id,
        action: 'modified',
        clientName: clientName.trim(),
        performedBy: staff || undefined,
        details: `Incidencia parcial: ${affectedCount}/${r.num_people} ${unitLabel} · ${incidentResolution}${parsedAmount != null ? ` · ${parsedAmount}€` : ''}`,
      })

      setSaving(false)
      onSaved()
      return
    }

    // Full update path (either no incident, or incident applies to the whole reservation)
    const finalStatus = isCancelling ? 'Cancelada' : status
    const updateData: Record<string, unknown> = {
      ...clientFields,
      time: time + ':00',
      status: finalStatus,
      incident_type: incidentType || null,
      incident_comment: incidentComment || null,
      incident_resolution: hasIncident ? (incidentResolution || null) : null,
      incident_refund_amount: showAmount ? parsedAmount : null,
      incident_refund_type: null,
      incident_resolved_by: hasIncident && incidentResolution ? (resolvedBy || null) : null,
      incident_authorized_by: hasIncident && incidentResolution ? (authorizedBy || null) : null,
    }
    if (showDateChange && newDate !== date) {
      updateData.date = newDate
    }

    const { error: err } = await supabase.from('reservations').update(updateData).eq('id', r.id)
    setSaving(false)
    if (err) { setError(err.message); return }

    const changes: string[] = []
    if (clientName.trim() !== r.client_name) changes.push(`Nombre: ${r.client_name}→${clientName.trim()}`)
    if (showDateChange && newDate !== date) changes.push(`Fecha: ${date}→${newDate}`)
    if (time !== (r.time?.slice(0, 5) ?? '')) changes.push(`Hora: ${r.time?.slice(0, 5)}→${time}`)
    if ((staff || null) !== r.staff) changes.push(`Staff: ${r.staff ?? '—'}→${staff || '—'}`)
    if ((office || null) !== r.office) changes.push(`Oficina: ${r.office ?? '—'}→${office || '—'}`)
    if (finalStatus !== r.status) changes.push(`Estado: ${r.status}→${finalStatus}`)
    if ((email || null) !== r.email) changes.push('Email cambiado')
    if ((phone || null) !== r.phone) changes.push('Teléfono cambiado')
    if ((notes || null) !== r.notes) changes.push('Notas cambiadas')
    if (incidentType && incidentType !== (r.incident_type ?? '')) changes.push(`Incidencia: ${incidentType}`)
    if (incidentResolution && incidentResolution !== (r.incident_resolution ?? '')) changes.push(`Solucion: ${incidentResolution}`)
    if (incidentComment && incidentComment !== (r.incident_comment ?? '')) changes.push('Comentario incidencia cambiado')

    logAudit({
      reservationId: r.id,
      action: 'modified',
      clientName: clientName.trim(),
      performedBy: staff || undefined,
      details: changes.length > 0 ? changes.join(', ') : 'Sin cambios detectados',
    })

    onSaved()
  }

  return (
    <form onSubmit={handleSave} className="mt-3 pt-3 border-t border-gray-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        <Field label="Nombre">
          <input type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)} className="input" />
        </Field>
        <Field label="Teléfono *">
          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </Field>
        <Field label={isJets ? 'N Motos' : 'N Personas'}>
          <input
            type="number"
            min={1}
            value={r.num_people}
            disabled
            className="input bg-gray-100 text-gray-500 cursor-not-allowed"
            title="Para reducir, crea una incidencia y ajusta las afectadas"
          />
        </Field>
        <Field label="Hora">
          <select value={time} onChange={(e) => setTime(e.target.value)} className="input">
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Atendido por *">
          <select value={staff} onChange={(e) => setStaff(e.target.value)} className="input" required>
            <option value="">--</option>
            {staffNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </Field>
        <Field label="Oficina">
          <select value={office} onChange={(e) => setOffice(e.target.value)} className="input">
            <option value="">--</option>
            {OFFICES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <div className="col-span-full">
          <Field label="Notas">
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Notas..." />
          </Field>
        </div>
      </div>

      {/* Incident section */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Incidencia</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Tipo de incidencia">
            <select value={incidentType} onChange={(e) => setIncidentType(e.target.value)} className="input">
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
                  className="input"
                  placeholder="Detalles de la incidencia..."
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </Field>
            </div>
          )}
        </div>

        {/* Step 1: affected scope (shows as soon as incident type is set) */}
        {hasIncident && canSplit && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              1. ¿A cuantas {unitLabel} afecta la incidencia?
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setAffected(r.num_people)}
                className={`px-3 py-2 text-sm rounded-lg border font-medium min-h-[44px] sm:min-h-0 ${
                  affected === r.num_people
                    ? 'bg-sky-600 border-sky-600 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-sky-50'
                }`}
              >
                Toda la reserva ({r.num_people} {unitLabel})
              </button>
              <button
                type="button"
                onClick={() => setAffected(Math.max(1, r.num_people - 1))}
                className={`px-3 py-2 text-sm rounded-lg border font-medium min-h-[44px] sm:min-h-0 ${
                  affected < r.num_people
                    ? 'bg-sky-600 border-sky-600 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-sky-50'
                }`}
              >
                Parcial
              </button>
              {affected < r.num_people && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={r.num_people - 1}
                    value={affected}
                    onChange={(e) => setAffected(Math.max(1, Math.min(r.num_people - 1, Number(e.target.value))))}
                    className="input w-20"
                  />
                  <span className="text-sm text-gray-600">de {r.num_people} {unitLabel}</span>
                </div>
              )}
            </div>
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
                    className={`px-3 py-2 text-sm rounded-lg border font-medium min-h-[44px] sm:min-h-0 ${
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
              <>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {showDateChange && (
                    <>
                      <Field label="Nuevo dia">
                        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input" />
                      </Field>
                      <Field label="Nueva hora">
                        <select value={time} onChange={(e) => setTime(e.target.value)} className="input">
                          {TIME_SLOTS.map((t) => (
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
                        className="input"
                        placeholder="0.00"
                      />
                    </Field>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Field label="Gestionada por * (comercial)">
                    <select value={resolvedBy} onChange={(e) => setResolvedBy(e.target.value)} className="input" required>
                      <option value="">-- selecciona --</option>
                      {staffNames.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Autorizada por *">
                    <select value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} className="input" required>
                      <option value="">-- selecciona --</option>
                      {INCIDENT_AUTHORIZERS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            )}
            {isPartial && (
              <p className="mt-2 text-xs text-sky-700">
                Se dividira la reserva: {r.num_people - affectedCount} {unitLabel} permaneceran, {affectedCount} {unitLabel} con incidencia.
              </p>
            )}
            {isCancelling && !isPartial && (
              <p className="mt-2 text-xs text-gray-600">Al guardar, la reserva quedara marcada como Cancelada.</p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <div className="mt-3">
        <button type="submit" disabled={saving} className="px-4 py-2.5 sm:py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400 text-white text-sm rounded-lg font-medium min-h-[44px] sm:min-h-0 w-full sm:w-auto">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
      <style>{`
        .input { width: 100%; padding: 0.625rem 0.5rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 0.8rem; color: #111827; outline: none; min-height: 44px; }
        @media (min-width: 640px) { .input { padding: 0.375rem 0.5rem; min-height: auto; } }
        .input:focus { border-color: transparent; box-shadow: 0 0 0 2px #0ea5e9; }
        textarea.input { min-height: 60px; }
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

function QuickAddForm({
  activityType,
  activityName,
  date,
  time,
  staffNames,
  onSaved,
  onCancel,
}: {
  activityType: string
  activityName: string
  date: string
  time: string
  staffNames: string[]
  onSaved: () => void
  onCancel: () => void
}) {
  const supabase = createClient()
  const [clientName, setClientName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [numPeople, setNumPeople] = useState(1)
  const [staff, setStaff] = useState('')
  const [office, setOffice] = useState(() => getStoredOffice())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPastReservation = time ? new Date(`${date}T${time}:00`).getTime() < Date.now() : false

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientName.trim()) return setError('Nombre es obligatorio.')
    setSaving(true)
    setError(null)

    const { error: err } = await supabase.from('reservations').insert({
      activity_type: activityType,
      activity: activityName,
      date,
      time: time + ':00',
      num_people: numPeople,
      client_name: clientName.trim(),
      email: email || null,
      phone: phone || null,
      staff: staff || null,
      office: office || null,
      status: 'Confirmada',
    })

    setSaving(false)
    if (err) { setError(err.message); return }
    logAudit({
      action: 'created',
      activityType,
      clientName: clientName.trim(),
      performedBy: staff || undefined,
      details: `${activityName} a las ${time}, ${numPeople} pers.`,
    })
    onSaved()
  }

  return (
    <div className="border-2 border-sky-200 bg-sky-50/50 rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm text-gray-900">+ Nueva reserva — {activityName} a las {time}</h4>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg leading-none w-8 h-8 flex items-center justify-center">&times;</button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Nombre *</label>
            <input type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)}
              className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0"
              placeholder="Cliente" autoFocus />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Teléfono *</label>
            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0"
              placeholder="email@ejemplo.com" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Nº Personas</label>
            <input type="number" min={1} value={numPeople} onChange={(e) => setNumPeople(Number(e.target.value))}
              className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Atendido por *</label>
            <select value={staff} onChange={(e) => setStaff(e.target.value)} required
              className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0">
              <option value="">—</option>
              {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Oficina</label>
            <select value={office} onChange={(e) => setOffice(e.target.value)}
              className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0">
              <option value="">—</option>
              {OFFICES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        {isPastReservation && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
            Atencion: la fecha/hora seleccionada ya ha pasado.
          </div>
        )}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button type="submit" disabled={saving}
            className="px-4 py-2 sm:py-1.5 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400 text-white text-sm rounded-lg font-medium min-h-[44px] sm:min-h-0">
            {saving ? 'Guardando...' : 'Guardar reserva'}
          </button>
          <button type="button" onClick={onCancel}
            className="px-4 py-2 sm:py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 min-h-[44px] sm:min-h-0">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Confirmada: 'bg-green-100 text-green-700',
    Pendiente: 'bg-amber-100 text-amber-700',
    Cancelada: 'bg-red-100 text-red-700',
    Realizada: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${styles[status] ?? 'bg-gray-100'}`}>
      {status}
    </span>
  )
}
