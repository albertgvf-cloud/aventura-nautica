'use client'

import { Fragment, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Activity = { name: string; capacity: number; hardMax: number; color: string }
type Reservation = {
  id: string
  activity: string
  time: string
  num_people: number
  status: string
  arrived: boolean
  departed: boolean
}

export default function TimeGrid({
  activities,
  reservations,
  timeSlots,
  onSlotClick,
}: {
  activities: Activity[]
  reservations: Reservation[]
  timeSlots: string[]
  onSlotClick: (slot: string, activityName: string) => void
}) {
  const supabase = createClient()
  const router = useRouter()
  // Mobile: show one activity at a time
  const [mobileActivityIdx, setMobileActivityIdx] = useState(0)
  const currentMobileActivity = activities[mobileActivityIdx] ?? activities[0]

  function getSlotData(slot: string, activityName: string) {
    const slotReservations = reservations.filter(
      (r) => r.time === slot + ':00' && r.activity === activityName && r.status !== 'Cancelada'
    )
    const people = slotReservations.reduce((sum, r) => sum + r.num_people, 0)
    const total = slotReservations.length
    const arrivedCount = slotReservations.filter((r) => r.arrived).length
    const allDeparted = total > 0 && slotReservations.every((r) => r.departed)
    return { people, total, arrivedCount, allDeparted, slotReservations }
  }

  async function toggleSlotDeparted(slot: string, activityName: string, currentlyDeparted: boolean) {
    const ids = reservations
      .filter((r) => r.time === slot + ':00' && r.activity === activityName && r.status !== 'Cancelada')
      .map((r) => r.id)
    if (ids.length === 0) return
    await supabase
      .from('reservations')
      .update({ departed: !currentlyDeparted })
      .in('id', ids)
    router.refresh()
  }

  return (
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
                  const { people, total, arrivedCount, allDeparted } = getSlotData(slot, currentMobileActivity.name)
                  const available = Math.max(0, currentMobileActivity.capacity - people)
                  const pct = currentMobileActivity.capacity > 0 ? Math.round((people / currentMobileActivity.capacity) * 100) : 0
                  const overCapacity = people > currentMobileActivity.capacity
                  const overHardMax = people > currentMobileActivity.hardMax
                  const hasBookings = people > 0
                  const allArrived = hasBookings && arrivedCount === total
                  const someArrived = hasBookings && arrivedCount > 0 && arrivedCount < total

                  const cellBg = overHardMax ? 'bg-red-50' :
                    overCapacity ? 'bg-amber-50' :
                    allDeparted ? 'bg-blue-50/50' :
                    allArrived ? 'bg-green-50/50' : ''

                  return (
                    <tr key={slot} className={`${slotIdx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
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
                            <span className={`text-[10px] leading-tight ${
                              allArrived ? 'text-green-600 font-semibold' :
                              someArrived ? 'text-amber-600' : 'text-gray-400'
                            }`}>
                              {allArrived ? '✓' : `${arrivedCount}/${total}`}
                            </span>
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
            {timeSlots.map((slot, slotIdx) => (
              <tr key={slot} className={`hover:bg-sky-50/30 ${slotIdx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                <td className="px-3 py-2 font-mono text-gray-700 font-medium border-r border-gray-200 sticky left-0 bg-white z-10">{slot}</td>
                {activities.map((a, i) => {
                  const { people, total, arrivedCount, allDeparted } = getSlotData(slot, a.name)
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
                            <span className={`text-[10px] leading-tight ${
                              allArrived ? 'text-green-600 font-semibold' :
                              someArrived ? 'text-amber-600' : 'text-gray-400'
                            }`}>
                              {allArrived ? '✓ todos' : someArrived ? `${arrivedCount}/${total}` : `0/${total}`}
                            </span>
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
            ))}
          </tbody>
        </table>
      </div>
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
