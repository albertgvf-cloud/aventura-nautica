'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { PARASAILING, PARASAILING_SLOTS } from '@/lib/config'

type Reservation = {
  id: string
  activity: string
  time: string
  num_people: number
  client_name: string
  email: string | null
  phone: string | null
  status: string
  arrived: boolean
  departed: boolean
  staff: string | null
  office: string | null
  incident_type: string | null
  incident_comment: string | null
}

export default function ParasailingGrid({
  reservations,
  onSlotClick,
}: {
  reservations: Reservation[]
  onSlotClick: (slot: string, activityName: string) => void
}) {
  const supabase = createClient()
  const router = useRouter()
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)

  function getBlockData(slot: string) {
    const blockReservations = reservations.filter(
      (r) => r.time?.slice(0, 5) === slot && r.activity === 'Parasailing' && r.status !== 'Cancelada'
    )
    const people = blockReservations.reduce((sum, r) => sum + r.num_people, 0)
    const arrivedPeople = blockReservations.filter((r) => r.arrived).reduce((sum, r) => sum + r.num_people, 0)
    const total = blockReservations.length
    const arrivedCount = blockReservations.filter((r) => r.arrived).length
    const allDeparted = total > 0 && blockReservations.every((r) => r.departed)
    return { blockReservations, people, arrivedPeople, total, arrivedCount, allDeparted }
  }

  // Calculate accumulated delay from previous overloaded departures
  function getAccumulatedDelay(slotIndex: number): number {
    let delay = 0
    for (let i = 0; i < slotIndex; i++) {
      const { people } = getBlockData(PARASAILING_SLOTS[i])
      if (people > PARASAILING.delayThreshold) {
        delay += (people - PARASAILING.delayThreshold) * PARASAILING.delayPerExtraPerson
      }
    }
    return delay
  }

  // Priority order: 09:00, 10:00, 11:00... 19:00, then 08:30 last
  const priorityOrder = [...PARASAILING_SLOTS.filter((s) => s !== '08:30'), '08:30']

  function firstNonFullSlotIndex(): number {
    for (const s of priorityOrder) {
      const { people } = getBlockData(s)
      const cap = s === '08:30' ? 4 : PARASAILING.maxPerDeparture
      if (people < cap) return PARASAILING_SLOTS.indexOf(s)
    }
    return PARASAILING_SLOTS.length
  }

  // Auto-distribute people into flight turns of 2-4
  function assignFlightTurns(people: number): number[] {
    if (people === 0) return []
    const turns: number[] = []
    let remaining = people
    while (remaining > 0) {
      if (remaining <= PARASAILING.flightGroupMax) {
        turns.push(remaining)
        remaining = 0
      } else if (remaining === 5) {
        turns.push(3); turns.push(2); remaining = 0
      } else {
        turns.push(Math.min(PARASAILING.flightGroupMax, remaining))
        remaining -= PARASAILING.flightGroupMax
      }
    }
    return turns
  }

  function addMinutes(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number)
    const total = h * 60 + m + mins
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  async function toggleSlotDeparted(slot: string, currentlyDeparted: boolean) {
    const slotReservations = reservations
      .filter((r) => r.time?.slice(0, 5) === slot && r.activity === 'Parasailing' && r.status !== 'Cancelada')
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

  async function toggleArrived(id: string, current: boolean) {
    await supabase.from('reservations').update({ arrived: !current }).eq('id', id)
    router.refresh()
  }

  // Capacity per slot: 08:30 = 4 (1 flight only), rest = 10
  function slotCapacity(slot: string): number {
    return slot === '08:30' ? 4 : PARASAILING.maxPerDeparture
  }
  function slotHardMax(slot: string): number {
    return slot === '08:30' ? 4 : PARASAILING.hardMaxPerDeparture
  }

  const firstNonFull = firstNonFullSlotIndex()

  // Daily totals
  const allPeople = PARASAILING_SLOTS.reduce((sum, slot) => sum + getBlockData(slot).people, 0)
  const activeBlocks = PARASAILING_SLOTS.filter((slot) => getBlockData(slot).people > 0).length
  const departedBlocks = PARASAILING_SLOTS.filter((slot) => getBlockData(slot).allDeparted).length

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-purple-800">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>🪂 <strong>Parasailing</strong> — Desde las 08:30</span>
          <span>✈️ Vuelos de {PARASAILING.flightGroupMin}-{PARASAILING.flightGroupMax} pax</span>
          <span>⚠️ Máx {PARASAILING.maxPerDeparture} pax/salida</span>
          <span>🌬️ Alerta viento después de las {PARASAILING.windWarningAfterHour}:00</span>
        </div>
      </div>

      {/* Global priority warning */}
      {firstNonFull < PARASAILING_SLOTS.length && (() => {
        const firstSlot = PARASAILING_SLOTS[firstNonFull]
        const { people } = getBlockData(firstSlot)
        const fCap = PARASAILING_SLOTS[firstNonFull] === '08:30' ? 4 : PARASAILING.maxPerDeparture
        const remaining = fCap - people
        return (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-xl px-3 sm:px-4 py-2.5 flex items-center gap-2">
            <span className="text-lg shrink-0">☀️</span>
            <p className="text-sm text-orange-900">
              <strong>Prioridad: llenar la salida de las {firstSlot}</strong> ({remaining} plazas) — siempre de más temprano a más tarde
            </p>
          </div>
        )
      })()}

      {/* Departure blocks */}
      {PARASAILING_SLOTS.map((slot, slotIndex) => {
        const { blockReservations, people, arrivedPeople, total, arrivedCount, allDeparted } = getBlockData(slot)
        const isExpanded = expandedBlock === slot
        const hasBookings = people > 0
        const flightTurns = assignFlightTurns(people)
        const cap = slotCapacity(slot)
        const hard = slotHardMax(slot)
        const overCapacity = people > cap
        const overHard = people > hard
        const allArrived = hasBookings && arrivedCount === total

        const delay = getAccumulatedDelay(slotIndex)
        const estimatedStart = delay > 0 ? addMinutes(slot, delay) : slot
        const estimatedEnd = addMinutes(estimatedStart, PARASAILING.departureDurationMinutes)
        const estimatedFlightTime = flightTurns.length * PARASAILING.minutesPerFlight

        const hourNum = parseInt(slot.split(':')[0])
        const isWindRisk = hourNum >= PARASAILING.windWarningAfterHour

        // Check if this slot is being filled before higher-priority slots
        const thisSlotPriorityIdx = priorityOrder.indexOf(slot)
        const firstNonFullPriorityIdx = priorityOrder.indexOf(PARASAILING_SLOTS[firstNonFull])
        const hasGapWarning = hasBookings && thisSlotPriorityIdx > firstNonFullPriorityIdx
        // Dim slots that are lower priority than the first unfilled (and have no bookings)
        const isDimmed = !hasBookings && thisSlotPriorityIdx > firstNonFullPriorityIdx

        // Delay this departure will cause to the next
        const localDelay = people > PARASAILING.delayThreshold
          ? (people - PARASAILING.delayThreshold) * PARASAILING.delayPerExtraPerson
          : 0

        return (
          <div
            key={slot}
            className={`bg-white rounded-xl border overflow-hidden transition-all ${
              allDeparted ? 'border-blue-300' :
              overHard ? 'border-red-300' :
              overCapacity ? 'border-amber-300' :
              hasGapWarning ? 'border-orange-300' :
              hasBookings ? 'border-purple-200' : 'border-gray-200'
            } ${isDimmed ? 'opacity-40' : ''}`}
          >
            {/* Block header */}
            <div
              className={`flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer hover:bg-gray-50/50 ${
                allDeparted ? 'bg-blue-50/50' : ''
              }`}
              onClick={() => setExpandedBlock(isExpanded ? null : slot)}
            >
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                {/* Time block */}
                <div className="shrink-0">
                  <span className="text-sm sm:text-base font-mono font-bold text-gray-900">{slot}</span>
                  {delay > 0 && (
                    <span className="text-[10px] sm:text-xs text-amber-600 ml-1" title={`Retraso acumulado: +${delay} min`}>
                      → {estimatedStart}
                    </span>
                  )}
                  <span className="text-[10px] sm:text-xs text-gray-400 ml-1">— {estimatedEnd}</span>
                </div>

                {/* Capacity bar */}
                <div className="hidden sm:flex items-center gap-2 flex-1">
                  <div className="w-28 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        overHard ? 'bg-red-500' :
                        overCapacity ? 'bg-amber-500' :
                        people === cap ? 'bg-purple-600' :
                        people > 0 ? 'bg-purple-400' : ''
                      }`}
                      style={{ width: `${Math.min(100, (people / cap) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-sm font-semibold ${
                    overHard ? 'text-red-600' :
                    overCapacity ? 'text-amber-700' :
                    people === cap ? 'text-purple-700' :
                    people > 0 ? 'text-purple-600' : 'text-gray-400'
                  }`}>
                    {people}/{cap}
                  </span>
                </div>

                {/* Mobile capacity */}
                <span className={`sm:hidden text-sm font-bold ${
                  overHard ? 'text-red-600' :
                  overCapacity ? 'text-amber-700' :
                  people > 0 ? 'text-purple-600' : 'text-gray-400'
                }`}>
                  {people}/{PARASAILING.maxPerDeparture}
                </span>

                {/* Warnings */}
                <div className="hidden md:flex items-center gap-1.5">
                  {isWindRisk && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded-full" title="Riesgo de viento por la tarde">
                      🌬️ viento
                    </span>
                  )}
                  {hasGapWarning && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full" title="Hay salidas anteriores sin llenar">
                      ⚠️ llenar antes
                    </span>
                  )}
                  {localDelay > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                      +{localDelay}min retraso
                    </span>
                  )}
                  {delay > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full">
                      acum. +{delay}min
                    </span>
                  )}
                </div>

              </div>

              {/* Status */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {hasBookings && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    arrivedPeople === people ? 'bg-green-100 text-green-700' :
                    arrivedPeople > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {arrivedPeople === people ? `✓ ${arrivedPeople} pax` : `${arrivedPeople}/${people} pax`}
                  </span>
                )}
                {hasBookings && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSlotDeparted(slot, allDeparted) }}
                    className={`text-xs px-2 py-1 rounded-full transition-colors min-h-[32px] ${
                      allDeparted ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                  >
                    {allDeparted ? '⛵ Salió' : '⛵'}
                  </button>
                )}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-gray-200">
                {/* Warnings bar (mobile) */}
                {(isWindRisk || hasGapWarning || localDelay > 0 || delay > 0) && (
                  <div className="md:hidden px-3 py-2 bg-amber-50 border-b border-amber-200 flex flex-wrap gap-1.5 text-[10px]">
                    {isWindRisk && <span className="px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded-full">🌬️ Riesgo viento tarde</span>}
                    {hasGapWarning && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">⚠️ Hay salidas anteriores sin llenar</span>}
                    {localDelay > 0 && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">+{localDelay}min retraso próx salida</span>}
                    {delay > 0 && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full">Retraso acumulado +{delay}min</span>}
                  </div>
                )}


                {/* Gap warning detail */}
                {hasGapWarning && (
                  <div className="px-3 sm:px-4 py-2 bg-orange-50 border-b border-orange-200 text-xs text-orange-800">
                    <strong>⚠️ Recordatorio:</strong> Hay salidas anteriores con plazas libres.
                    Llena primero las salidas de la mañana (menos viento, mejor experiencia para el cliente).
                  </div>
                )}

                {/* Client list */}
                {blockReservations.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-gray-500 mb-3">No hay reservas para esta salida.</p>
                    <button
                      onClick={() => onSlotClick(slot, 'Parasailing')}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium min-h-[44px]"
                    >
                      + Añadir reserva
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {blockReservations.map((r) => {
                      const isCancelled = r.status === 'Cancelada'
                      return (
                        <div
                          key={r.id}
                          className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 ${
                            isCancelled ? 'opacity-50' :
                            r.departed && !r.arrived ? 'bg-amber-50/50' :
                            r.arrived ? 'bg-green-50/50' : ''
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-medium text-sm text-gray-900 ${isCancelled ? 'line-through' : ''}`}>
                                {r.client_name}
                              </span>
                              <span className="text-xs font-semibold text-purple-600">{r.num_people} pax</span>
                              {r.departed && !r.arrived && (
                                <span className="text-[10px] text-amber-600">⚠ no llegó</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 text-xs text-gray-500">
                              {r.phone && <span>{r.phone}</span>}
                              {r.email && <span className="truncate max-w-[200px]">{r.email}</span>}
                              {r.staff && <span>· {r.staff}</span>}
                              {r.office && <span>· {r.office}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isCancelled && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleArrived(r.id, r.arrived) }}
                                className={`text-xs px-2.5 py-1.5 rounded-lg min-h-[44px] sm:min-h-0 whitespace-nowrap ${
                                  r.arrived ? 'bg-green-100 text-green-700 border border-green-300' : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                                }`}
                              >
                                {r.arrived ? '✓ Llegó' : 'Llegada'}
                              </button>
                            )}
                            <button
                              onClick={() => onSlotClick(slot, 'Parasailing')}
                              className="text-xs text-purple-600 hover:underline min-h-[44px] sm:min-h-0 px-2"
                            >
                              Detalle
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {/* Add button */}
                    <div className="p-3">
                      <button
                        onClick={() => onSlotClick(slot, 'Parasailing')}
                        className="w-full py-2 border-2 border-dashed border-purple-200 rounded-lg text-sm text-purple-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50/50 transition-colors min-h-[44px]"
                      >
                        + Añadir reserva en esta salida
                      </button>
                    </div>
                  </div>
                )}

                {/* Capacity warnings */}
                {overCapacity && !overHard && (
                  <div className="px-3 sm:px-4 py-2.5 bg-amber-50 text-[10px] sm:text-xs text-amber-700 border-t border-gray-200">
                    ⚠️ {people} pax — retraso estimado de +{localDelay}min en la siguiente salida.
                  </div>
                )}
                {overHard && (
                  <div className="px-3 sm:px-4 py-2.5 bg-red-50 text-[10px] sm:text-xs text-red-700 border-t border-gray-200">
                    🛑 {people} pax supera el máximo. Reubicar clientes a otra salida.
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Daily summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-2">Resumen del día</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Total personas</p>
            <p className="font-bold text-gray-900 text-lg">{allPeople}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Salidas con reservas</p>
            <p className="font-bold text-gray-900 text-lg">{activeBlocks}/{PARASAILING_SLOTS.length}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Salidas completadas</p>
            <p className="font-bold text-blue-600 text-lg">{departedBlocks}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Retraso total estimado</p>
            <p className={`font-bold text-lg ${getAccumulatedDelay(PARASAILING_SLOTS.length) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              +{getAccumulatedDelay(PARASAILING_SLOTS.length)} min
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
