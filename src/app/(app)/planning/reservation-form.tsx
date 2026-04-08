'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/audit'
import { OFFICES, STATUSES, TIME_SLOTS } from '@/lib/config'

type Activity = { name: string; capacity: number; hardMax: number; color: string }

export default function ReservationForm({
  date,
  activityType,
  activities,
  staffNames,
  timeSlots,
}: {
  date: string
  activityType: string
  activities: Activity[]
  staffNames: string[]
  timeSlots?: string[]
}) {
  const slots = timeSlots ?? TIME_SLOTS
  const router = useRouter()
  const supabase = createClient()

  const [activity, setActivity] = useState(activities[0]?.name ?? '')
  const [time, setTime] = useState('')
  const [numPeople, setNumPeople] = useState(1)
  const [clientName, setClientName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [staff, setStaff] = useState('')
  const [office, setOffice] = useState('')
  const [status, setStatus] = useState('Confirmada')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [currentOccupancy, setCurrentOccupancy] = useState(0)
  const [expanded, setExpanded] = useState(false)

  const activityConfig = activities.find((a) => a.name === activity)

  // Check current occupancy when activity or time changes
  useEffect(() => {
    if (!activity || !time) {
      setCurrentOccupancy(0)
      setWarning(null)
      return
    }
    const controller = new AbortController()
    ;(async () => {
      const { data } = await supabase
        .from('reservations')
        .select('num_people')
        .eq('date', date)
        .eq('activity', activity)
        .eq('time', time + ':00')
        .neq('status', 'Cancelada')
      if (controller.signal.aborted) return
      const total = (data ?? []).reduce((sum, r) => sum + r.num_people, 0)
      setCurrentOccupancy(total)
    })()
    return () => controller.abort()
  }, [activity, time, date, supabase])

  // Check capacity warning/block when occupancy or numPeople changes
  useEffect(() => {
    if (!activityConfig || !time) {
      setWarning(null)
      return
    }
    const afterBooking = currentOccupancy + numPeople
    if (afterBooking > activityConfig.hardMax) {
      setWarning(`BLOQUEADO: ${afterBooking} personas supera el maximo absoluto de ${activityConfig.hardMax} para ${activity}.`)
    } else if (afterBooking > activityConfig.capacity) {
      setWarning(`Atencion: ${afterBooking} personas supera la capacidad normal de ${activityConfig.capacity} para ${activity}. (Maximo absoluto: ${activityConfig.hardMax})`)
    } else {
      setWarning(null)
    }
  }, [currentOccupancy, numPeople, activityConfig, activity, time])

  const isBlocked = activityConfig && time && (currentOccupancy + numPeople) > activityConfig.hardMax

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activity || !time || !clientName.trim()) {
      setError('Actividad, hora y nombre son obligatorios.')
      return
    }
    if (isBlocked) {
      setError(`No se puede reservar: supera el maximo de ${activityConfig!.hardMax} personas.`)
      return
    }
    setError(null)
    setSaving(true)

    const { error: err } = await supabase.from('reservations').insert({
      activity_type: activityType,
      activity,
      date,
      time: time + ':00',
      num_people: numPeople,
      client_name: clientName.trim(),
      email: email || null,
      phone: phone || null,
      staff: staff || null,
      office: office || null,
      status,
    })

    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }

    logAudit({
      action: 'created',
      activityType,
      clientName: clientName.trim(),
      performedBy: staff || undefined,
      details: `${activity} a las ${time}, ${numPeople} pers.`,
    })

    // Reset form
    setClientName('')
    setEmail('')
    setPhone('')
    setNumPeople(1)
    setSuccess(true)
    setExpanded(false)
    setTimeout(() => setSuccess(false), 2000)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
      {/* Mobile: collapsible header */}
      <button
        type="button"
        className="sm:hidden w-full flex items-center justify-between py-1"
        onClick={() => setExpanded(!expanded)}
      >
        <h2 className="font-semibold text-gray-900">+ Anadir reserva</h2>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <h2 className="hidden sm:block font-semibold text-gray-900 mb-3">+ Anadir reserva</h2>

      {/* Form content - always visible on sm+, collapsible on mobile */}
      <form onSubmit={handleSubmit} className={`${expanded ? 'block' : 'hidden'} sm:block mt-3 sm:mt-0`}>
        {/* Mobile: 1 column, sm: 2 columns, md: 5 columns, lg: full row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-2 sm:gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Actividad</label>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="w-full px-2 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0"
            >
              {activities.map((a) => (
                <option key={a.name} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Hora</label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-2 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0"
            >
              <option value="">--</option>
              {slots.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-0.5">N Pers.</label>
            <input
              type="number"
              min={1}
              value={numPeople}
              onChange={(e) => setNumPeople(Number(e.target.value))}
              className={`w-full px-2 py-2.5 sm:py-1.5 border rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0 ${
                isBlocked ? 'border-red-400 bg-red-50' : warning ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Nombre *</label>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-2 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0"
              placeholder="Cliente"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Teléfono *</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-2 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-2 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0"
              placeholder="email@ejemplo.com"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Atendido por *</label>
            <select
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              required
              className="w-full px-2 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0"
            >
              <option value="">--</option>
              {staffNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Oficina</label>
            <select
              value={office}
              onChange={(e) => setOffice(e.target.value)}
              className="w-full px-2 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0"
            >
              <option value="">--</option>
              {OFFICES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-2 py-2.5 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Capacity indicator */}
        {time && activityConfig && (
          <div className="mt-2 text-xs text-gray-500">
            Ocupacion actual en {activity} a las {time}: <strong>{currentOccupancy}/{activityConfig.capacity}</strong>
            {numPeople > 0 && <span> → con esta reserva: <strong>{currentOccupancy + numPeople}</strong></span>}
          </div>
        )}

        {/* Warning or block message */}
        {warning && !isBlocked && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
            {warning}
          </div>
        )}
        {isBlocked && (
          <div className="mt-2 p-2 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800">
            {warning}
          </div>
        )}

        <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <button
            type="submit"
            disabled={saving || !!isBlocked}
            className={`px-4 py-2.5 sm:py-1.5 font-medium rounded-lg text-sm text-white min-h-[44px] sm:min-h-0 ${
              isBlocked
                ? 'bg-red-300 cursor-not-allowed'
                : 'bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400'
            }`}
          >
            {saving ? 'Guardando...' : isBlocked ? 'Capacidad superada' : 'Guardar reserva'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Reserva guardada</p>}
        </div>
      </form>
    </div>
  )
}
