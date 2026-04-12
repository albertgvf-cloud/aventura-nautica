'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/audit'
import { useRouter } from 'next/navigation'
import { ALL_SIN_TIT_JETS, ALL_CON_TIT_JETS } from '@/lib/config'

const allJets = [...ALL_SIN_TIT_JETS, ...ALL_CON_TIT_JETS]

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
  notes: string | null
  jet_id?: string | null
  group_id?: string | null
  duration_minutes?: number | null
}

type GroupedReservation = {
  key: string
  reservations: Reservation[]
  client_name: string
  email: string | null
  phone: string | null
  time: string
  activity: string
  staff: string | null
  office: string | null
  status: string
  arrived: boolean
  num_people: number
  jetCount: number
  jetLabels: string[]
}

export default function ReservationList({
  reservations,
  date,
  activeTab,
}: {
  reservations: Reservation[]
  date: string
  activeTab?: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [search, setSearch] = useState('')

  const isJets = activeTab === 'jets'

  const filtered = search.trim()
    ? reservations.filter((r) => {
        const s = search.toLowerCase()
        return (
          r.client_name.toLowerCase().includes(s) ||
          r.email?.toLowerCase().includes(s) ||
          r.phone?.includes(s) ||
          r.activity.toLowerCase().includes(s) ||
          r.staff?.toLowerCase().includes(s) ||
          r.office?.toLowerCase().includes(s)
        )
      })
    : reservations

  // Group jet reservations by group_id or by client+time
  const grouped = useMemo((): GroupedReservation[] => {
    if (!isJets) {
      // Non-jets: each reservation is its own group
      return [...filtered]
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((r) => ({
          key: r.id,
          reservations: [r],
          client_name: r.client_name,
          email: r.email,
          phone: r.phone,
          time: r.time,
          activity: r.activity,
          staff: r.staff,
          office: r.office,
          status: r.status,
          arrived: r.arrived,
          num_people: r.num_people,
          jetCount: 0,
          jetLabels: [],
        }))
    }

    // Jets: group by group_id or by client+time
    const seen = new Set<string>()
    const groups: GroupedReservation[] = []

    const sorted = [...filtered].sort((a, b) => a.time.localeCompare(b.time))

    for (const r of sorted) {
      if (seen.has(r.id)) continue

      let members: Reservation[]
      if (r.group_id) {
        members = filtered.filter((s) => s.group_id === r.group_id)
      } else {
        members = filtered.filter(
          (s) => s.client_name === r.client_name && s.time?.slice(0, 5) === r.time?.slice(0, 5) && s.activity_type === 'jets'
        )
      }

      members.forEach((m) => seen.add(m.id))

      const jetLabels = members
        .map((m) => allJets.find((j) => j.id === m.jet_id)?.label ?? m.jet_id)
        .filter(Boolean) as string[]

      groups.push({
        key: r.group_id ?? r.id,
        reservations: members,
        client_name: r.client_name,
        email: r.email,
        phone: r.phone,
        time: r.time,
        activity: r.activity,
        staff: r.staff,
        office: r.office,
        status: r.status,
        arrived: members.every((m) => m.arrived),
        num_people: r.num_people,
        jetCount: members.length,
        jetLabels,
      })
    }

    return groups
  }, [filtered, isJets])

  const confirmed = grouped.filter((g) => g.status === 'Confirmada')
  const cancelled = grouped.filter((g) => g.status === 'Cancelada')
  const pending = grouped.filter((g) => g.status === 'Pendiente')

  async function toggleArrivedGroup(ids: string[], current: boolean, group: GroupedReservation) {
    await supabase.from('reservations').update({ arrived: !current }).in('id', ids)
    logAudit({
      reservationId: ids[0],
      action: 'arrived',
      clientName: group.client_name,
      activityType: isJets ? 'jets' : undefined,
      details: !current ? 'Marcado como llegado' : 'Desmarcado llegada',
    })
    router.refresh()
  }

  async function cancelGroup(ids: string[], group: GroupedReservation) {
    await supabase.from('reservations').update({ status: 'Cancelada' }).in('id', ids)
    logAudit({
      reservationId: ids[0],
      action: 'cancelled',
      clientName: group.client_name,
      activityType: isJets ? 'jets' : undefined,
      details: `${group.activity} a las ${group.time?.slice(0, 5)}`,
    })
    router.refresh()
  }

  async function deleteGroup(ids: string[], group: GroupedReservation) {
    if (!confirm(`Eliminar ${ids.length > 1 ? `${ids.length} registros de esta reserva` : 'esta reserva'} permanentemente?`)) return
    await supabase.from('reservations').delete().in('id', ids)
    logAudit({
      reservationId: ids[0],
      action: 'deleted',
      clientName: group.client_name,
      activityType: isJets ? 'jets' : undefined,
      details: `${group.activity} a las ${group.time?.slice(0, 5)}`,
    })
    router.refresh()
  }

  if (reservations.length === 0) {
    return (
      <div className="p-6 bg-white rounded-xl border border-gray-200 text-center">
        <p className="text-gray-500">No hay reservas para este dia y actividad.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-3 sm:px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <h2 className="font-semibold text-gray-900 shrink-0">Detalle de reservas</h2>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="w-full sm:flex-1 sm:max-w-md px-3 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0"
        />
        <div className="flex gap-2 text-xs shrink-0">
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full">{confirmed.length} conf.</span>
          {pending.length > 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{pending.length} pend.</span>}
          {cancelled.length > 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full">{cancelled.length} canc.</span>}
        </div>
      </div>

      {/* ===== MOBILE: Card layout ===== */}
      <div className="md:hidden divide-y divide-gray-100">
        {grouped.map((g) => {
          const isCancelled = g.status === 'Cancelada'
          const ids = g.reservations.map((r) => r.id)
          return (
            <div key={g.key} className={`p-3 ${isCancelled ? 'opacity-50' : ''} ${g.arrived ? 'bg-green-50/50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {!isCancelled && (
                    <input type="checkbox" checked={g.arrived}
                      onChange={() => toggleArrivedGroup(ids, g.arrived, g)}
                      className="w-5 h-5 mt-0.5 rounded border-gray-300 text-green-600 cursor-pointer accent-green-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium text-gray-900 ${isCancelled ? 'line-through' : ''}`}>{g.client_name}</span>
                      <StatusBadge status={g.status} />
                      {g.jetCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">{g.jetCount} motos</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                      <span className="font-mono">{g.time?.slice(0, 5)}</span>
                      <span>{g.activity}</span>
                      <span className="font-semibold text-gray-700">{g.num_people} pers.</span>
                    </div>
                    {g.jetLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {g.jetLabels.map((l, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">{l}</span>
                        ))}
                      </div>
                    )}
                    {(g.email || g.phone) && (
                      <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-gray-500">
                        {g.email && <span className="truncate max-w-[180px]">{g.email}</span>}
                        {g.phone && <span>{g.phone}</span>}
                      </div>
                    )}
                    {g.reservations[0]?.notes && (
                      <p className="mt-1 text-xs text-gray-500 italic">{g.reservations[0].notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {!isCancelled && (
                    <button onClick={() => cancelGroup(ids, g)}
                      className="w-9 h-9 flex items-center justify-center text-xs text-red-600 rounded-lg hover:bg-red-50 border border-red-200">✗</button>
                  )}
                  <button onClick={() => deleteGroup(ids, g)}
                    className="w-9 h-9 flex items-center justify-center text-xs text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 border border-gray-200">🗑</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ===== DESKTOP: Table layout ===== */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200">
            <tr>
              <th className="text-center px-3 py-2 text-xs text-gray-600">✓</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600">Hora</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600">Cliente</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600">Email</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600">Actividad</th>
              {isJets && <th className="text-center px-3 py-2 text-xs text-gray-600">Motos</th>}
              <th className="text-center px-3 py-2 text-xs text-gray-600">Pers.</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600">Telefono</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600">Atendido</th>
              <th className="text-left px-3 py-2 text-xs text-gray-600">Oficina</th>
              <th className="text-center px-3 py-2 text-xs text-gray-600">Estado</th>
              <th className="text-center px-3 py-2 text-xs text-gray-600"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {grouped.map((g) => {
              const isCancelled = g.status === 'Cancelada'
              const ids = g.reservations.map((r) => r.id)
              return (
                <tr key={g.key} className={`hover:bg-gray-50 ${isCancelled ? 'opacity-50' : ''} ${g.arrived ? 'bg-green-50/50' : ''}`}>
                  <td className="px-3 py-2 text-center">
                    {!isCancelled && (
                      <input type="checkbox" checked={g.arrived}
                        onChange={() => toggleArrivedGroup(ids, g.arrived, g)}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 cursor-pointer accent-green-600" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-700">{g.time?.slice(0, 5)}</td>
                  <td className={`px-3 py-2 font-medium text-gray-900 ${isCancelled ? 'line-through' : ''}`}>{g.client_name}</td>
                  <td className="px-3 py-2 text-gray-600">{g.email ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-700">
                    <div>{g.activity}</div>
                    {g.reservations[0]?.notes && (
                      <p className="text-xs text-gray-400 italic mt-0.5">{g.reservations[0].notes}</p>
                    )}
                  </td>
                  {isJets && (
                    <td className="px-3 py-2 text-center">
                      {g.jetCount > 0 && (
                        <div>
                          <span className="font-semibold text-blue-700">{g.jetCount}</span>
                          <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                            {g.jetLabels.map((l, i) => (
                              <span key={i} className="px-1 py-0 bg-blue-50 text-blue-600 text-[9px] rounded">{l}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-center font-semibold text-gray-900">{g.num_people}</td>
                  <td className="px-3 py-2 text-gray-600">{g.phone ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{g.staff ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{g.office ?? '—'}</td>
                  <td className="px-3 py-2 text-center"><StatusBadge status={g.status} /></td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      {!isCancelled && (
                        <button onClick={() => cancelGroup(ids, g)} className="text-xs text-red-600 hover:underline" title="Cancelar">✗</button>
                      )}
                      <button onClick={() => deleteGroup(ids, g)} className="text-xs text-gray-400 hover:text-red-600" title="Eliminar">🗑</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {search && grouped.length === 0 && (
        <div className="p-4 text-center text-sm text-gray-500">
          No se encontraron reservas para &quot;{search}&quot;
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Confirmada: 'bg-green-100 text-green-700',
    Pendiente: 'bg-amber-100 text-amber-700',
    Cancelada: 'bg-red-100 text-red-700',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs ${styles[status] ?? 'bg-gray-100'}`}>{status}</span>
}
