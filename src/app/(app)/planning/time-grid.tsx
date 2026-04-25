'use client'

import { Fragment, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatDateLong } from '@/lib/date'

type Activity = { name: string; capacity: number; hardMax: number; color: string }
type Reservation = {
  id: string
  activity: string
  time: string
  num_people: number
  client_name: string
  status: string
  arrived: boolean
  departed: boolean
}

export default function TimeGrid({
  activities,
  reservations,
  timeSlots,
  onSlotClick,
  date,
}: {
  activities: Activity[]
  reservations: Reservation[]
  timeSlots: string[]
  onSlotClick: (slot: string, activityName: string, reservationId?: string) => void
  date: string
}) {
  const supabase = createClient()
  const router = useRouter()
  // Mobile: show one activity at a time
  const [mobileActivityIdx, setMobileActivityIdx] = useState(0)
  const currentMobileActivity = activities[mobileActivityIdx] ?? activities[0]
  // Expanded slot for showing individual client checkboxes
  const [expandedSlot, setExpandedSlot] = useState<{ slot: string; activity: string } | null>(null)
  // View mode: timeline (grid) or A4 printable list
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline')

  function getSlotData(slot: string, activityName: string) {
    const slotReservations = reservations.filter(
      (r) => r.time === slot + ':00' && r.activity === activityName && r.status !== 'Cancelada'
    )
    const people = slotReservations.reduce((sum, r) => sum + r.num_people, 0)
    const arrivedPeople = slotReservations.filter((r) => r.arrived).reduce((sum, r) => sum + r.num_people, 0)
    const total = slotReservations.length
    const arrivedCount = slotReservations.filter((r) => r.arrived).length
    const allDeparted = total > 0 && slotReservations.every((r) => r.departed)
    return { people, arrivedPeople, total, arrivedCount, allDeparted, slotReservations }
  }

  async function toggleClientArrived(id: string, current: boolean) {
    await supabase.from('reservations').update({ arrived: !current }).eq('id', id)
    router.refresh()
  }

  async function toggleSlotDeparted(slot: string, activityName: string, currentlyDeparted: boolean) {
    const slotReservations = reservations
      .filter((r) => r.time === slot + ':00' && r.activity === activityName && r.status !== 'Cancelada')
    if (slotReservations.length === 0) return

    if (!currentlyDeparted) {
      // Marking departure: arrived clients → Realizada, non-arrived → just mark departed
      const arrivedIds = slotReservations.filter((r) => r.arrived).map((r) => r.id)
      const notArrivedIds = slotReservations.filter((r) => !r.arrived).map((r) => r.id)
      if (arrivedIds.length > 0) {
        await supabase.from('reservations').update({ departed: true, status: 'Realizada' }).in('id', arrivedIds)
      }
      if (notArrivedIds.length > 0) {
        await supabase.from('reservations').update({ departed: true }).in('id', notArrivedIds)
      }
    } else {
      // Unmarking departure
      const allIds = slotReservations.map((r) => r.id)
      await supabase.from('reservations').update({ departed: false, status: 'Confirmada' }).in('id', allIds)
    }
    router.refresh()
  }

  function toggleExpanded(slot: string, activity: string) {
    if (expandedSlot?.slot === slot && expandedSlot?.activity === activity) {
      setExpandedSlot(null)
    } else {
      setExpandedSlot({ slot, activity })
    }
  }

  // Inline client list for a slot
  function ClientCheckboxList({ slot, activityName }: { slot: string; activityName: string }) {
    const { slotReservations } = getSlotData(slot, activityName)
    if (slotReservations.length === 0) return null
    return (
      <div className="py-1.5 px-2 space-y-1">
        {slotReservations.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 py-1 px-1 rounded hover:bg-gray-50">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-sm ${r.arrived ? 'text-green-700 font-medium' : 'text-gray-700'}`}>
                {r.client_name}
              </span>
              <span className="text-xs text-gray-400">{r.num_people} pax</span>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => toggleClientArrived(r.id, r.arrived)}
                className={`text-xs px-2.5 py-1 rounded-lg whitespace-nowrap font-medium ${
                  r.arrived ? 'bg-green-600 text-white border border-green-600' : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {r.arrived ? '✓ Llegado' : 'Llegado'}
              </button>
              <button
                onClick={() => onSlotClick(slot, activityName, r.id)}
                className="text-xs px-2.5 py-1 rounded-lg whitespace-nowrap font-medium border border-sky-300 text-sky-700 hover:bg-sky-50"
              >
                Detalle
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* View mode toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'timeline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            📊 Parrilla
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            📄 Lista A4
          </button>
        </div>
        {viewMode === 'list' && (
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium"
          >
            🖨️ Imprimir
          </button>
        )}
      </div>

      {viewMode === 'list' && (
        <ActivitiesPrintView activities={activities} reservations={reservations} timeSlots={timeSlots} date={date} />
      )}

      {viewMode === 'timeline' && (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ===== MOBILE VIEW: Activity selector tabs + simplified grid ===== */}
      <div className="md:hidden">
        {/* Activity tabs for mobile */}
        <div className="overflow-x-auto border-b border-gray-200 scrollbar-hide">
          <div className="flex min-w-max">
            {activities.map((a, i) => (
              <button
                key={a.name}
                onClick={() => setMobileActivityIdx(i)}
                className={`flex-1 whitespace-nowrap px-3 py-2.5 text-xs font-semibold transition-colors min-h-[44px] border-b-2 ${
                  mobileActivityIdx === i
                    ? 'border-current bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                style={mobileActivityIdx === i ? { color: a.color } : undefined}
              >
                {a.name} ({a.capacity})
              </button>
            ))}
          </div>
        </div>

        {/* Mobile simplified table for one activity */}
        {currentMobileActivity && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10 w-16">HORA</th>
                  <th className="px-2 py-2 text-xs text-gray-500 text-center">Pers.</th>
                  <th className="px-2 py-2 text-xs text-gray-500 text-center">Disp.</th>
                  <th className="px-2 py-2 text-xs text-gray-500 text-center">%</th>
                  <th className="px-2 py-2 text-xs text-gray-500 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot, slotIdx) => {
                  const { people, arrivedPeople, total, arrivedCount, allDeparted } = getSlotData(slot, currentMobileActivity.name)
                  const available = Math.max(0, currentMobileActivity.capacity - people)
                  const pct = currentMobileActivity.capacity > 0 ? Math.round((people / currentMobileActivity.capacity) * 100) : 0
                  const overCapacity = people > currentMobileActivity.capacity
                  const overHardMax = people > currentMobileActivity.hardMax
                  const hasBookings = people > 0
                  const allArrived = hasBookings && arrivedCount === total
                  const someArrived = hasBookings && arrivedCount > 0 && arrivedCount < total
                  const isExpanded = expandedSlot?.slot === slot && expandedSlot?.activity === currentMobileActivity.name

                  const cellBg = overHardMax ? 'bg-red-50' :
                    overCapacity ? 'bg-amber-50' :
                    allDeparted ? 'bg-blue-50/50' :
                    allArrived ? 'bg-green-50/50' : ''

                  return (
                    <Fragment key={slot}>
                      <tr className={`${slotIdx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                        <td className="px-3 py-2.5 font-mono text-gray-700 font-medium border-r border-gray-200 sticky left-0 bg-white z-10 min-h-[44px]">
                          {slot}
                        </td>
                        <td
                          className={`px-2 py-2.5 text-center font-semibold min-h-[44px] cursor-pointer active:bg-sky-100 ${cellBg} ${
                            overHardMax ? 'text-red-600' :
                            overCapacity ? 'text-amber-700' :
                            allDeparted ? 'text-blue-600' :
                            allArrived ? 'text-green-700' :
                            hasBookings ? 'text-sky-700' : 'text-gray-400'
                          }`}
                          onClick={() => onSlotClick(slot, currentMobileActivity.name)}
                        >
                          {hasBookings ? people : '+'}
                        </td>
                        <td className={`px-2 py-2.5 text-center ${cellBg} ${
                          overHardMax ? 'text-red-600 font-bold' :
                          available === 0 ? 'text-red-600 font-bold' : 'text-green-600'
                        }`}>
                          {available}
                        </td>
                        <td className={`px-2 py-2.5 text-center ${cellBg}`}>
                          <OccupancyBar pct={pct} color={currentMobileActivity.color} overCapacity={overCapacity} overHardMax={overHardMax} />
                        </td>
                        <td className={`px-1 py-2.5 text-center ${cellBg}`}>
                          {hasBookings && (
                            <div className="flex flex-col items-center gap-0.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleExpanded(slot, currentMobileActivity.name) }}
                                className={`text-[10px] leading-tight px-1.5 py-1 rounded-full transition-colors min-w-[32px] min-h-[28px] ${
                                  arrivedPeople === people ? 'bg-green-100 text-green-700 font-semibold' :
                                  arrivedPeople > 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'
                                }`}
                                title="Clic para marcar llegadas individualmente"
                              >
                                {arrivedPeople === people ? '✓' : `${arrivedPeople}/${people}`}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleSlotDeparted(slot, currentMobileActivity.name, allDeparted) }}
                                className={`text-[10px] leading-tight px-1.5 py-1 rounded-full transition-colors min-w-[32px] min-h-[28px] ${
                                  allDeparted
                                    ? 'bg-blue-100 text-blue-700 font-semibold'
                                    : 'bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-600'
                                }`}
                                title={allDeparted ? 'Actividad salio' : 'Marcar salida'}
                              >
                                {allDeparted ? '⛵' : '⛵'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {/* Expanded client checkboxes */}
                      {isExpanded && hasBookings && (
                        <tr>
                          <td colSpan={5} className="bg-green-50/30 border-b border-green-200">
                            <ClientCheckboxList slot={slot} activityName={currentMobileActivity.name} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== DESKTOP VIEW: Full table with all activities ===== */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          {/* Activity group headers */}
          <thead>
            <tr>
              <th rowSpan={2} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 w-16 bg-gray-50 border-b-2 border-gray-300 sticky left-0 z-10">
                HORA
              </th>
              {activities.map((a, i) => (
                <th
                  key={a.name}
                  colSpan={4}
                  className={`text-center font-bold py-3 text-sm border-b-2 ${
                    i > 0 ? 'border-l-[3px] border-l-gray-300' : ''
                  }`}
                  style={{
                    color: a.color,
                    borderBottomColor: a.color,
                    backgroundColor: `${a.color}10`,
                  }}
                >
                  {a.name} ({a.capacity})
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50">
              {activities.map((a, i) => (
                <Fragment key={a.name}>
                  <th className={`px-2 py-1.5 text-xs text-gray-500 text-center border-b border-gray-200 ${i > 0 ? 'border-l-[3px] border-l-gray-300' : ''}`}>Res.</th>
                  <th className="px-2 py-1.5 text-xs text-gray-500 text-center border-b border-gray-200">Disp.</th>
                  <th className="px-2 py-1.5 text-xs text-gray-500 text-center border-b border-gray-200">%</th>
                  <th className="px-2 py-1.5 text-xs text-gray-500 text-center border-b border-gray-200">Estado</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((slot, slotIdx) => {
              // Check if any activity in this slot is expanded
              const expandedActivity = expandedSlot?.slot === slot ? expandedSlot.activity : null
              return (
                <Fragment key={slot}>
                  <tr className={`hover:bg-sky-50/30 ${slotIdx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="px-3 py-2 font-mono text-gray-700 font-medium border-r border-gray-200 sticky left-0 bg-white z-10">{slot}</td>
                    {activities.map((a, i) => {
                      const { people, arrivedPeople, total, arrivedCount, allDeparted } = getSlotData(slot, a.name)
                      const available = Math.max(0, a.capacity - people)
                      const pct = a.capacity > 0 ? Math.round((people / a.capacity) * 100) : 0
                      const overCapacity = people > a.capacity
                      const overHardMax = people > a.hardMax
                      const hasBookings = people > 0
                      const allArrived = hasBookings && arrivedCount === total
                      const someArrived = hasBookings && arrivedCount > 0 && arrivedCount < total

                      const cellBg = overHardMax ? 'bg-red-50' :
                        overCapacity ? 'bg-amber-50' :
                        allDeparted ? 'bg-blue-50/50' :
                        allArrived ? 'bg-green-50/50' : ''

                      return (
                        <Fragment key={a.name}>
                          {/* Reservations count */}
                          <td
                            className={`px-2 py-2 text-center font-semibold cursor-pointer hover:bg-sky-100 transition-colors ${cellBg} ${
                              i > 0 ? 'border-l-[3px] border-l-gray-300' : ''
                            } ${
                              overHardMax ? 'text-red-600' :
                              overCapacity ? 'text-amber-700' :
                              allDeparted ? 'text-blue-600' :
                              allArrived ? 'text-green-700' :
                              hasBookings ? 'text-sky-700' : 'text-gray-400 hover:text-sky-600'
                            }`}
                            onClick={() => onSlotClick(slot, a.name)}
                            title={hasBookings ? `${arrivedCount}/${total} llegaron — clic para detalle` : 'Clic para añadir reserva'}
                          >
                            {hasBookings ? people : '+'}
                          </td>
                          {/* Available */}
                          <td className={`px-2 py-2 text-center ${cellBg} ${
                            overHardMax ? 'text-red-600 font-bold' :
                            available === 0 ? 'text-red-600 font-bold' : 'text-green-600'
                          }`}>
                            {available}
                          </td>
                          {/* Occupancy bar */}
                          <td className={`px-2 py-2 text-center ${cellBg}`}>
                            <OccupancyBar pct={pct} color={a.color} overCapacity={overCapacity} overHardMax={overHardMax} />
                          </td>
                          {/* Status */}
                          <td className={`px-1 py-2 text-center ${cellBg}`}>
                            {hasBookings && (
                              <div className="flex flex-col items-center gap-0.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleExpanded(slot, a.name) }}
                                  className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                                    arrivedPeople === people ? 'bg-green-100 text-green-700 font-semibold hover:bg-green-200' :
                                    arrivedPeople > 0 ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'
                                  }`}
                                  title="Clic para marcar llegadas individualmente"
                                >
                                  {arrivedPeople === people ? `✓ ${arrivedPeople}` : `${arrivedPeople}/${people}`}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleSlotDeparted(slot, a.name, allDeparted) }}
                                  className={`text-[10px] leading-tight px-1.5 py-0.5 rounded-full transition-colors ${
                                    allDeparted
                                      ? 'bg-blue-100 text-blue-700 font-semibold'
                                      : 'bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-600'
                                  }`}
                                  title={allDeparted ? 'Actividad salio — clic para desmarcar' : 'Marcar salida de actividad'}
                                >
                                  {allDeparted ? '⛵ Salio' : '⛵'}
                                </button>
                              </div>
                            )}
                          </td>
                        </Fragment>
                      )
                    })}
                  </tr>
                  {/* Expanded client checkboxes row */}
                  {expandedActivity && (
                    <tr>
                      <td className="sticky left-0 bg-white z-10 border-r border-gray-200" />
                      {activities.map((a, i) => (
                        <td
                          key={a.name}
                          colSpan={4}
                          className={`${i > 0 ? 'border-l-[3px] border-l-gray-300' : ''} ${
                            a.name === expandedActivity ? 'bg-green-50/30 border-b border-green-200' : ''
                          }`}
                        >
                          {a.name === expandedActivity && (
                            <ClientCheckboxList slot={slot} activityName={a.name} />
                          )}
                        </td>
                      ))}
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
      )}

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}

function ActivitiesPrintView({
  activities,
  reservations,
  timeSlots,
  date,
}: {
  activities: Activity[]
  reservations: Reservation[]
  timeSlots: string[]
  date: string
}) {
  const dateLabel = formatDateLong(date)
  const active = reservations.filter((r) => r.status !== 'Cancelada')
  const totalRes = active.length
  const totalPeople = active.reduce((s, r) => s + r.num_people, 0)

  function slotRes(slot: string, activityName: string) {
    return active.filter((r) => r.time === slot + ':00' && r.activity === activityName)
  }

  // Keep only slots where at least one activity has a booking
  const usedSlots = timeSlots.filter((slot) =>
    activities.some((a) => slotRes(slot, a.name).length > 0)
  )

  return (
    <div className="print-area bg-white rounded-xl border border-gray-200 p-3 text-[11px]">
      <div className="flex items-end justify-between border-b-2 border-gray-900 pb-2 mb-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">Planning Actividades</h2>
          <p className="text-[11px] text-gray-600">{dateLabel}</p>
        </div>
        <div className="flex gap-3 text-[10px] text-gray-700 font-medium">
          {activities.map((a) => (
            <span key={a.name} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: a.color }} /> {a.name}
            </span>
          ))}
          <span className="text-gray-500">· {totalRes} reservas · {totalPeople} pers.</span>
        </div>
      </div>

      {usedSlots.length === 0 ? (
        <p className="text-center text-gray-500 py-6 text-sm">Sin reservas este dia.</p>
      ) : (
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="border-b-2 border-gray-800 bg-gray-50 text-left">
              <th className="px-1.5 py-1 font-bold text-[11px]" style={{ width: 60 }}>Hora</th>
              {activities.map((a) => (
                <th key={a.name} className="px-1.5 py-1 font-bold text-[11px]" style={{ color: a.color }}>
                  {a.name} <span className="text-gray-400 font-normal">({a.capacity})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usedSlots.map((slot) => (
              <tr key={slot} className="border-b border-gray-200 align-top">
                <td className="px-1.5 py-1 font-mono font-bold border-r border-gray-300">{slot}</td>
                {activities.map((a) => {
                  const rs = slotRes(slot, a.name)
                  const people = rs.reduce((s, r) => s + r.num_people, 0)
                  const over = people > a.capacity
                  return (
                    <td key={a.name} className="px-1.5 py-1 border-r border-gray-200">
                      {rs.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 mb-0.5">
                            <span
                              className="px-1 rounded text-white font-bold text-[10px]"
                              style={{ backgroundColor: a.color }}
                            >
                              {people}/{a.capacity}
                              {over && ' ⚠'}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-800 leading-tight">
                            {rs.map((r, i) => (
                              <div key={r.id}>
                                {i > 0 && <span className="text-gray-400">· </span>}
                                <span className="font-semibold">{r.client_name}</span>
                                <span className="text-gray-500"> ({r.num_people})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function OccupancyBar({ pct, color, overCapacity, overHardMax }: { pct: number; color: string; overCapacity: boolean; overHardMax: boolean }) {
  let bg: string, fill: string

  if (overHardMax) {
    bg = 'bg-red-200'; fill = 'bg-red-600'
  } else if (overCapacity) {
    bg = 'bg-amber-200'; fill = 'bg-amber-500'
  } else if (pct === 0) {
    bg = 'bg-gray-100'; fill = 'bg-gray-200'
  } else {
    bg = 'bg-gray-100'; fill = ''
  }

  return (
    <div className={`w-10 md:w-12 h-3 rounded-full ${bg} overflow-hidden mx-auto`}>
      <div
        className={`h-full rounded-full ${fill}`}
        style={!fill ? { backgroundColor: color, opacity: pct < 50 ? 0.4 : pct < 80 ? 0.6 : 0.85, width: `${Math.min(100, pct)}%` } : { width: `${Math.min(100, pct)}%` }}
      />
    </div>
  )
}
