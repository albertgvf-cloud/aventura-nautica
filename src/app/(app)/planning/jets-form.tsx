'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/audit'
import { JETS, ALL_SIN_TIT_JETS, ALL_CON_TIT_JETS, JETS_SLOTS, OFFICES, durationLabel, timeToMinutes } from '@/lib/config'

type Reservation = {
  time: string
  jet_id: string | null
  duration_minutes: number | null
  status: string
  activity: string
}

export default function JetsForm({
  date,
  reservations,
  staffNames,
}: {
  date: string
  reservations: Reservation[]
  staffNames: string[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [category, setCategory] = useState<'sin' | 'con'>('sin')
  const [type, setType] = useState<'excursion' | 'circuit'>('excursion')
  const [duration, setDuration] = useState(60)
  const [time, setTime] = useState('')
  // Per-model quantity selection: { 'VX115': 3, 'Jet Blaster': 1, ... }
  const [qtyByModel, setQtyByModel] = useState<Record<string, number>>({})
  // Client
  const [clientName, setClientName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [staff, setStaff] = useState('')
  const [office, setOffice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const active = reservations.filter((r) => r.status !== 'Cancelada')

  const durations = category === 'sin'
    ? (type === 'excursion' ? JETS.sinTitulacion.durations.excursion : JETS.sinTitulacion.durations.circuit)
    : JETS.conTitulacion.durations

  function getAvailableJets(t: string, dur: number, fleet: typeof ALL_SIN_TIT_JETS) {
    if (!t) return []
    const reqStart = timeToMinutes(t)
    const reqEnd = reqStart + dur
    const busyIds = new Set(
      active.filter((r) => {
        if (!r.jet_id || !r.time) return false
        const bStart = timeToMinutes(r.time.slice(0, 5))
        const bEnd = bStart + (r.duration_minutes ?? 60)
        return bStart < reqEnd && bEnd > reqStart
      }).map((r) => r.jet_id)
    )
    return fleet.filter((j) => !busyIds.has(j.id))
  }

  // Fleet depends on category
  const fleet = category === 'sin' ? ALL_SIN_TIT_JETS : [...ALL_SIN_TIT_JETS, ...ALL_CON_TIT_JETS]
  const availableJets = useMemo(() => getAvailableJets(time, duration, fleet), [time, duration, category, active])

  // Group available jets by model
  const availableByModel = useMemo(() => {
    const groups: Record<string, typeof fleet> = {}
    for (const j of availableJets) {
      if (!groups[j.model]) groups[j.model] = []
      groups[j.model].push(j)
    }
    return groups
  }, [availableJets])

  function handleTimeChange(t: string) { setTime(t); setQtyByModel({}) }
  function handleDurationChange(d: number) { setDuration(d); setQtyByModel({}) }
  function handleCategoryChange(c: 'sin' | 'con') {
    setCategory(c); setQtyByModel({})
    setDuration(c === 'sin' ? (type === 'excursion' ? 30 : 20) : 60)
  }

  function setModelQty(model: string, qty: number) {
    setQtyByModel((prev) => ({ ...prev, [model]: Math.max(0, qty) }))
  }

  // Total selected
  const totalSelected = Object.values(qtyByModel).reduce((s, n) => s + n, 0)
  const instructorsNeeded = category === 'sin' ? Math.ceil(totalSelected / JETS.sinTitulacion.instructorRatio) : 0
  const returnTime = time ? (() => {
    const m = timeToMinutes(time) + duration
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  })() : ''

  // Build the list of jets to assign
  function getJetsToAssign() {
    const jets: typeof fleet = []
    for (const [model, qty] of Object.entries(qtyByModel)) {
      if (qty <= 0) continue
      const modelJets = availableByModel[model] ?? []
      jets.push(...modelJets.slice(0, qty))
    }
    return jets
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!time || !clientName.trim()) return setError('Hora y nombre son obligatorios.')
    if (totalSelected === 0) return setError('Selecciona al menos 1 moto.')

    // Validate per model
    for (const [model, qty] of Object.entries(qtyByModel)) {
      const avail = (availableByModel[model] ?? []).length
      if (qty > avail) return setError(`Solo hay ${avail} ${model} disponibles.`)
    }

    setSaving(true); setError(null)

    const jetsToAssign = getJetsToAssign()
    const actName = category === 'sin'
      ? (type === 'excursion' ? `Excursion ${durationLabel(duration)}` : `Circuito ${durationLabel(duration)}`)
      : null

    // Generate a group_id to link all jets in this booking
    const groupId = crypto.randomUUID()

    const inserts = jetsToAssign.map((j) => ({
      activity_type: 'jets',
      activity: actName ?? `${j.model} ${durationLabel(duration)}`,
      date,
      time: time + ':00',
      num_people: 1,
      client_name: clientName.trim(),
      email: email || null,
      group_id: jetsToAssign.length > 1 ? groupId : null,
      phone: phone || null,
      staff: staff || null,
      office: office || null,
      status: 'Confirmada',
      jet_id: j.id,
      duration_minutes: duration,
    }))

    const { error: err } = await supabase.from('reservations').insert(inserts)
    if (err) { setError(err.message); setSaving(false); return }

    logAudit({
      action: 'created',
      activityType: 'jets',
      clientName: clientName.trim(),
      performedBy: staff || undefined,
      details: `${totalSelected} moto(s) a las ${time}, ${durationLabel(duration)}, ${category === 'sin' ? 'sin' : 'con'} titulación (${jetsToAssign.map((j) => j.label).join(', ')})`,
    })

    setSaving(false)
    setClientName(''); setEmail(''); setPhone(''); setQtyByModel({})
    setSuccess(true); setTimeout(() => setSuccess(false), 2000)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-900 mb-3">🏄 Nueva reserva Jet</h2>
      <form onSubmit={handleSubmit}>
        {/* Category toggle */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-3">
          <button type="button" onClick={() => handleCategoryChange('sin')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${category === 'sin' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600'}`}>
            Sin Titulación
          </button>
          <button type="button" onClick={() => handleCategoryChange('con')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${category === 'con' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600'}`}>
            Con Titulación
          </button>
        </div>

        {/* Step 1: Time config */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          {category === 'sin' && (
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Tipo</label>
              <select value={type} onChange={(e) => { setType(e.target.value as 'excursion' | 'circuit'); handleDurationChange(e.target.value === 'excursion' ? 30 : 20) }}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
                <option value="excursion">Excursión</option>
                <option value="circuit">Circuito</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Duración</label>
            <select value={duration} onChange={(e) => handleDurationChange(Number(e.target.value))}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
              {durations.map((d) => <option key={d} value={d}>{durationLabel(d)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Hora salida *</label>
            <select value={time} onChange={(e) => handleTimeChange(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
              <option value="">— selecciona hora —</option>
              {JETS_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Step 2: Select number of jets per model */}
        {time && (
          <div className="mb-3 p-3 border border-gray-200 rounded-xl bg-gray-50/50">
            <label className="block text-xs text-gray-500 mb-2">
              Motos disponibles a las {time} ({durationLabel(duration)}):
            </label>
            {Object.keys(availableByModel).length === 0 ? (
              <p className="text-xs text-red-500 py-1">No hay motos disponibles a esta hora y duración</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(availableByModel).map(([model, jets]) => {
                  const qty = qtyByModel[model] ?? 0
                  const isSpecial = ALL_CON_TIT_JETS.some((c) => c.model === model)
                  const colorClass = isSpecial ? 'text-green-700' : 'text-blue-700'
                  const bgClass = isSpecial ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
                  return (
                    <div key={model} className={`flex items-center gap-3 p-2 rounded-lg border ${qty > 0 ? bgClass : 'bg-white border-gray-200'}`}>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-semibold ${colorClass}`}>{model}</span>
                        <span className="text-xs text-gray-400 ml-1.5">{jets.length} disponibles</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => setModelQty(model, qty - 1)} disabled={qty <= 0}
                          className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent font-bold">
                          −
                        </button>
                        <span className={`w-8 text-center text-sm font-bold ${qty > 0 ? colorClass : 'text-gray-400'}`}>
                          {qty}
                        </span>
                        <button type="button" onClick={() => setModelQty(model, qty + 1)} disabled={qty >= jets.length}
                          className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent font-bold">
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {totalSelected > 0 && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600 pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-900">Total: {totalSelected} motos</span>
                <span>⏱ Retorno: {returnTime}</span>
                {category === 'sin' && <span>👨‍🏫 Monitores: {instructorsNeeded}</span>}
                <span className="text-gray-400">
                  ({getJetsToAssign().map((j) => j.label).join(', ')})
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Client info */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Nombre *</label>
            <input type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500" placeholder="Cliente" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Teléfono *</label>
            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500" placeholder="email@ej.com" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Atendido por *</label>
            <select value={staff} onChange={(e) => setStaff(e.target.value)} required
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
              <option value="">—</option>
              {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Oficina</label>
            <select value={office} onChange={(e) => setOffice(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
              <option value="">—</option>
              {OFFICES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={saving || !time || totalSelected === 0}
            className={`px-4 py-1.5 text-white font-medium rounded-lg text-sm ${
              category === 'sin' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
            } disabled:bg-gray-400`}>
            {saving ? 'Guardando...' : `Guardar reserva (${totalSelected} moto${totalSelected !== 1 ? 's' : ''})`}
          </button>
          {success && <p className="text-sm text-green-600">✓ Reserva guardada</p>}
        </div>
      </form>
    </div>
  )
}
