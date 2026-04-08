'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { JETS, OFFICES, durationLabel, timeToMinutes, ALL_SIN_TIT_JETS, ALL_CON_TIT_JETS } from '@/lib/config'

const allJetsFleet = [...ALL_SIN_TIT_JETS, ...ALL_CON_TIT_JETS]

type Reservation = {
  time: string
  jet_id: string | null
  duration_minutes: number | null
  status: string
}

export default function JetQuickBook({
  jetId,
  time,
  staffNames,
  date,
  existingReservations,
  onClose,
}: {
  jetId: string
  time: string
  staffNames: string[]
  date: string
  existingReservations: Reservation[]
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()

  const jet = allJetsFleet.find((j) => j.id === jetId)
  const isVX = ALL_SIN_TIT_JETS.some((j) => j.id === jetId)

  const [type, setType] = useState<'excursion' | 'circuit' | 'con_tit'>(isVX ? 'excursion' : 'con_tit')
  const durations = type === 'excursion' ? JETS.sinTitulacion.durations.excursion
    : type === 'circuit' ? JETS.sinTitulacion.durations.circuit
    : JETS.conTitulacion.durations
  const [duration, setDuration] = useState(durations[0])
  const [selectedJetIds, setSelectedJetIds] = useState<string[]>([])
  const [clientName, setClientName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [staff, setStaff] = useState('')
  const [office, setOffice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const active = existingReservations.filter((r) => r.status !== 'Cancelada')

  // Available jets for the selected time + duration
  const availableJets = useMemo(() => {
    const fleet = type === 'con_tit' ? allJetsFleet : ALL_SIN_TIT_JETS
    const reqStart = timeToMinutes(time)
    const reqEnd = reqStart + duration
    const busyIds = new Set(
      active.filter((r) => {
        if (!r.jet_id || !r.time) return false
        const bStart = timeToMinutes(r.time.slice(0, 5))
        const bEnd = bStart + (r.duration_minutes ?? 60)
        return bStart < reqEnd && bEnd > reqStart
      }).map((r) => r.jet_id)
    )
    return fleet.filter((j) => !busyIds.has(j.id))
  }, [time, duration, type, active])

  // Stable key for available jets — only re-run when the actual IDs change
  const availableIds = availableJets.map((j) => j.id).join(',')
  useEffect(() => {
    if (availableJets.some((j) => j.id === jetId)) {
      setSelectedJetIds([jetId])
    } else if (availableJets.length > 0) {
      setSelectedJetIds([availableJets[0].id])
    } else {
      setSelectedJetIds([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableIds, jetId])

  function toggleJet(id: string) {
    setSelectedJetIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const totalSelected = selectedJetIds.length
  const instructorsNeeded = type !== 'con_tit' ? Math.ceil(totalSelected / JETS.sinTitulacion.instructorRatio) : 0

  const returnTime = (() => {
    const m = timeToMinutes(time) + duration
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientName.trim()) return setError('Nombre obligatorio.')
    if (totalSelected === 0) return setError('Selecciona al menos 1 moto.')

    setSaving(true); setError(null)

    const groupId = totalSelected > 1 ? crypto.randomUUID() : null

    const inserts = selectedJetIds.map((jid) => {
      const j = allJetsFleet.find((x) => x.id === jid)
      const actName = type === 'excursion' ? `Excursion ${durationLabel(duration)}`
        : type === 'circuit' ? `Circuito ${durationLabel(duration)}`
        : `${j?.model ?? 'Jet'} ${durationLabel(duration)}`
      return {
        activity_type: 'jets', activity: actName, date, time: time + ':00',
        num_people: 1, client_name: clientName.trim(),
        email: email || null, phone: phone || null,
        staff: staff || null, office: office || null,
        status: 'Confirmada', jet_id: jid, duration_minutes: duration,
        group_id: groupId,
      }
    })

    const { error: err } = await supabase.from('reservations').insert(inserts)
    setSaving(false)
    if (err) { setError(err.message); return }

    const jetLabels = selectedJetIds.map((jid) => allJetsFleet.find((x) => x.id === jid)?.label ?? jid).join(', ')
    logAudit({
      action: 'created',
      activityType: 'jets',
      clientName: clientName.trim(),
      performedBy: staff || undefined,
      details: `${totalSelected} moto(s) a las ${time}, ${durationLabel(duration)} (${jetLabels})`,
    })

    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:rounded-2xl sm:shadow-2xl sm:max-w-lg rounded-t-2xl overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}>

        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Reservar — {time}</h2>
            <p className="text-xs text-gray-500">Desde {jet?.label} · Retorno {returnTime}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 text-xl rounded-lg hover:bg-gray-100">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Type + Duration */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Tipo</label>
              <select value={type} onChange={(e) => {
                const t = e.target.value as typeof type
                setType(t)
                setDuration(t === 'excursion' ? 30 : t === 'circuit' ? 20 : 60)
                setQtyByModel({ [jet?.model ?? '']: 1 })
              }}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
                {isVX && <option value="excursion">Excursión (sin tit.)</option>}
                {isVX && <option value="circuit">Circuito (sin tit.)</option>}
                <option value="con_tit">Con Titulación</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Duración</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
                {durations.map((d) => <option key={d} value={d}>{durationLabel(d)}</option>)}
              </select>
            </div>
          </div>

          {/* Jet selection — clicked jet pre-selected, add more with checkboxes */}
          <div className="p-3 border border-gray-200 rounded-xl bg-gray-50/50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">
                Motos disponibles ({availableJets.length}) — {totalSelected} seleccionada{totalSelected !== 1 ? 's' : ''}
              </label>
              {totalSelected > 1 && (
                <button type="button" onClick={() => setSelectedJetIds([jetId])} className="text-xs text-gray-400 hover:text-red-500">Solo la clicada</button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {availableJets.map((j) => {
                const checked = selectedJetIds.includes(j.id)
                const isSpecial = ALL_CON_TIT_JETS.some((c) => c.id === j.id)
                const isClicked = j.id === jetId
                return (
                  <label key={j.id}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs cursor-pointer select-none transition-colors ${
                      checked
                        ? isSpecial ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    } ${isClicked ? 'ring-2 ring-blue-400' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleJet(j.id)}
                      className={`w-3.5 h-3.5 rounded ${isSpecial ? 'accent-green-600' : 'accent-blue-600'}`} />
                    <span className="font-medium">{j.label}</span>
                    {isSpecial && <span className="text-[9px] text-green-600">({j.model})</span>}
                  </label>
                )
              })}
            </div>
            {totalSelected > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200 flex flex-wrap gap-3 text-xs text-gray-600">
                <span className="font-semibold text-gray-900">Total: {totalSelected} moto{totalSelected !== 1 ? 's' : ''}</span>
                {type !== 'con_tit' && <span>👨‍🏫 {instructorsNeeded} monitor(es)</span>}
              </div>
            )}
          </div>

          {/* Client */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Nombre *</label>
              <input type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)} autoFocus
                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500" placeholder="Cliente" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Teléfono *</label>
              <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500" placeholder="email@ej.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Atendido por *</label>
              <select value={staff} onChange={(e) => setStaff(e.target.value)} required
                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
                <option value="">—</option>
                {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Oficina</label>
              <select value={office} onChange={(e) => setOffice(e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
                <option value="">—</option>
                {OFFICES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving || totalSelected === 0}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg text-sm min-h-[44px]">
              {saving ? 'Guardando...' : `Reservar ${totalSelected} moto${totalSelected !== 1 ? 's' : ''} a las ${time}`}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 min-h-[44px]">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
