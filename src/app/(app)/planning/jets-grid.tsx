'use client'

import { useState } from 'react'
import { JETS, ALL_SIN_TIT_JETS, ALL_CON_TIT_JETS, durationLabel, durationShort, timeToMinutes, addMinutesToTime } from '@/lib/config'
import JetDetailModal from './jet-detail-modal'
import JetQuickBook from './jet-quick-book'

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
  jet_id: string | null
  duration_minutes: number | null
  staff: string | null
  office: string | null
  notes: string | null
  group_id: string | null
}

const PX_PER_HOUR = 200
const MOTO_COL_W = 80

export default function JetsGrid({
  reservations, onSlotClick, staffNames, date,
}: {
  reservations: Reservation[]
  onSlotClick: (slot: string, activityName: string) => void
  staffNames: string[]
  date: string
}) {
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)
  const [quickBook, setQuickBook] = useState<{ jetId: string; time: string } | null>(null)
  const active = reservations.filter((r) => r.status !== 'Cancelada')

  const startMin = JETS.startHour * 60
  const endMin = JETS.endHour * 60
  const totalMin = endMin - startMin
  const totalHours = JETS.endHour - JETS.startHour
  const timelineWidth = totalHours * PX_PER_HOUR
  const totalWidth = MOTO_COL_W + timelineWidth

  function px(minutes: number) { return ((minutes - startMin) / totalMin) * timelineWidth }

  function jetBookings(jetId: string) { return active.filter((r) => r.jet_id === jetId) }

  function jetStatus(jetId: string): 'available' | 'busy' | 'next' {
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    for (const b of jetBookings(jetId)) {
      const bStart = timeToMinutes(b.time?.slice(0, 5) ?? '00:00')
      const bEnd = bStart + (b.duration_minutes ?? 60)
      if (nowMin >= bStart && nowMin < bEnd) return 'busy'
      if (bStart > nowMin && bStart - nowMin <= 30) return 'next'
    }
    return 'available'
  }

  function bookingColor(activity: string) {
    if (activity.startsWith('Excursion')) return { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', prefix: 'E' }
    if (activity.startsWith('Circuito')) return { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', prefix: 'C' }
    return { bg: 'bg-green-600', hover: 'hover:bg-green-700', prefix: '' }
  }

  function getInstructorPeaks() {
    const sinTitRes = active.filter((r) => r.activity.startsWith('Excursion') || r.activity.startsWith('Circuito'))
    const peaks: { time: string; count: number }[] = []
    for (let m = startMin; m < endMin; m += 10) {
      const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
      let jetsActive = 0
      for (const r of sinTitRes) {
        const rs = timeToMinutes(r.time?.slice(0, 5) ?? '00:00')
        const re = rs + (r.duration_minutes ?? 60)
        if (m >= rs && m < re) jetsActive++
      }
      if (jetsActive > 0) peaks.push({ time: t, count: Math.ceil(jetsActive / JETS.sinTitulacion.instructorRatio) })
    }
    return peaks
  }

  const maxInstructors = Math.max(0, ...getInstructorPeaks().map((p) => p.count))

  const hours: number[] = []
  for (let h = JETS.startHour; h <= JETS.endHour; h++) hours.push(h)
  const subMarks: number[] = []
  for (let m = startMin; m < endMin; m += 20) { if (m % 60 !== 0) subMarks.push(m) }

  const sortedConTit = ALL_CON_TIT_JETS

  // Count bookings by type for the summary
  const excCount = active.filter((r) => r.activity.startsWith('Excursion')).length
  const circCount = active.filter((r) => r.activity.startsWith('Circuito')).length
  const titCount = active.filter((r) => !r.activity.startsWith('Excursion') && !r.activity.startsWith('Circuito')).length
  const busyVX = ALL_SIN_TIT_JETS.filter((j) => jetStatus(j.id) === 'busy').length
  const busyConTit = ALL_CON_TIT_JETS.filter((j) => jetStatus(j.id) === 'busy').length
  const sinTitCount = active.filter((r) => r.activity.startsWith('Excursion') || r.activity.startsWith('Circuito')).length
  const conTitCount = active.filter((r) => !r.activity.startsWith('Excursion') && !r.activity.startsWith('Circuito')).length

  function handleRowClick(e: React.MouseEvent<HTMLDivElement>, jetId: string) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const clickMin = startMin + (x / timelineWidth) * totalMin
    const snapped = Math.round(clickMin / 10) * 10
    const h = Math.floor(snapped / 60)
    const m = snapped % 60
    setQuickBook({ jetId, time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` })
  }

  // Grid lines rendered inside a timeline cell
  function GridLines() {
    return <>
      {hours.map((h) => <div key={h} className="absolute top-0 h-full border-l-2 border-gray-200" style={{ left: px(h * 60) }} />)}
      {subMarks.map((m) => <div key={m} className="absolute top-0 h-full border-l border-dashed border-gray-100" style={{ left: px(m) }} />)}
    </>
  }

  // A full-width row with sticky left label
  function Row({ label, labelClass, children, rowClass, onClick }: {
    label: React.ReactNode; labelClass?: string; children?: React.ReactNode; rowClass?: string
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  }) {
    const h = rowClass?.includes('h-12') ? 48 : rowClass?.includes('h-8') ? 32 : 48
    return (
      <div className={`relative ${rowClass ?? ''}`} style={{ width: totalWidth, height: h }}>
        <div className={`absolute left-0 top-0 z-10 border-r border-gray-300 flex items-center justify-center ${labelClass ?? 'bg-white'}`}
          style={{ width: MOTO_COL_W, height: h, position: 'sticky', left: 0 }}>
          {label}
        </div>
        <div className="absolute overflow-hidden" style={{ left: MOTO_COL_W, top: 0, width: timelineWidth, height: h }} onClick={onClick}>
          {children}
        </div>
      </div>
    )
  }

  // Section divider with sticky text
  function SectionDivider({ text, className }: { text: string; className: string }) {
    return (
      <div className={`relative border-y ${className}`} style={{ width: totalWidth }}>
        <div className={`sticky left-0 z-10 inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${className}`}>
          {text}
        </div>
      </div>
    )
  }

  let jetRowIndex = 0
  function JetRow({ jet, section }: { jet: { id: string; model: string; label: string }; section: 'vx' | 'con' }) {
    const bookings = jetBookings(jet.id)
    const idx = jetRowIndex++
    const stripeBg = idx % 2 === 0 ? 'bg-white' : 'bg-sky-50/40'
    return (
      <Row
        label={section === 'vx'
          ? <span className="text-xs font-bold text-sky-800">{jet.label}</span>
          : <span className="text-xs font-bold text-sky-800">{jet.model}</span>
        }
        labelClass="bg-sky-100"
        rowClass={`border-b border-gray-200 hover:bg-blue-50/30 group h-12 ${stripeBg}`}
        onClick={(e) => handleRowClick(e, jet.id)}
      >
        <GridLines />
        {bookings.map((b) => {
          const bStart = timeToMinutes(b.time?.slice(0, 5) ?? '09:00')
          const dur = b.duration_minutes ?? 60
          const color = bookingColor(b.activity)
          return (
            <div key={b.id}
              className={`absolute rounded-lg flex items-center justify-center px-2 text-[11px] font-semibold text-white shadow-md cursor-pointer overflow-hidden border border-white/30 ${color.bg} ${color.hover} ${b.departed ? 'opacity-50' : ''}`}
              style={{ left: px(bStart), width: px(bStart + dur) - px(bStart), minWidth: 44, top: 4, bottom: 4 }}
              title={`${b.client_name} · ${b.activity} · ${b.time?.slice(0, 5)}–${addMinutesToTime(b.time?.slice(0, 5) ?? '09:00', dur)}`}
              onClick={(e) => { e.stopPropagation(); setSelectedRes(b) }}>
              <span className="truncate"><strong>{color.prefix ? `${color.prefix} ` : ''}{!b.activity.startsWith('Excursion') && !b.activity.startsWith('Circuito') && b.jet_id?.startsWith('VX') ? 'VX115 ' : ''}{durationShort(dur)}</strong> {b.client_name}</span>
            </div>
          )
        })}
        {bookings.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-300 group-hover:text-blue-400 transition-colors">
            + clic para reservar
          </div>
        )}
      </Row>
    )
  }

  return (
    <div className="space-y-4">
      {/* GANTT TIMELINE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-3 sm:px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900 text-sm">Timeline — Todas las motos</h3>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500" /> Excursión</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> Circuito</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600" /> Con tit.</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Time axis — sticky within vertical scroll */}
          <div className="sticky top-0 z-30 border-b-2 border-gray-300 bg-white" style={{ width: totalWidth, height: 32 }}>
            <div className="sticky left-0 z-10 absolute top-0 bottom-0 bg-sky-100 border-r border-gray-300" style={{ width: MOTO_COL_W }} />
            <div className="absolute top-0 bottom-0" style={{ left: MOTO_COL_W, width: timelineWidth }}>
              {subMarks.map((m) => (
                <div key={m} className="absolute top-0 h-full border-l border-dashed border-gray-200" style={{ left: px(m) }}>
                  <span className="text-[8px] text-gray-300 pl-0.5 absolute bottom-0.5">:{String(m % 60).padStart(2, '0')}</span>
                </div>
              ))}
              {hours.slice(0, -1).map((h) => (
                <div key={h} className="absolute top-0 h-full border-l-2 border-gray-400 bg-white" style={{ left: px(h * 60), width: PX_PER_HOUR }}>
                  <span className="flex items-center justify-center w-full h-full text-sm font-bold text-gray-700">{h}:00</span>
                </div>
              ))}
              <div className="absolute top-0 h-full border-l-2 border-gray-400" style={{ left: px(JETS.endHour * 60) }} />
            </div>
          </div>

          {/* VX header */}
          <div className="relative border-b border-blue-200 bg-blue-50/50" style={{ width: totalWidth }}>
            <div className="sticky left-0 z-10 inline-block px-3 py-1.5 bg-blue-50 text-[10px] font-semibold text-blue-700">
              VX115 (×{ALL_SIN_TIT_JETS.length}) —
              <span className="inline-flex items-center gap-1 ml-1"><span className="w-2.5 h-2.5 rounded bg-orange-500 inline-block" /> {excCount} exc.</span>
              <span className="inline-flex items-center gap-1 ml-2"><span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" /> {circCount} circ.</span>
              <span className="inline-flex items-center gap-1 ml-2"><span className="w-2.5 h-2.5 rounded bg-green-600 inline-block" /> {titCount} con tit.</span>
            </div>
          </div>

          {/* All VX rows in fixed order — colors distinguish type */}
          {ALL_SIN_TIT_JETS.map((jet) => <JetRow key={jet.id} jet={jet} section="vx" />)}

          {/* Instructor row */}
          <Row label={<span className="text-[10px] font-bold text-blue-700">👨‍🏫 Monitor</span>} labelClass="bg-sky-100" rowClass="border-t-2 border-blue-200 h-8">
            <div className="absolute inset-0 bg-blue-50/30">
              {hours.map((h) => <div key={h} className="absolute top-0 h-full border-l border-gray-200" style={{ left: px(h * 60) }} />)}
              {getInstructorPeaks().map((p, i) => {
                const m = timeToMinutes(p.time)
                return (
                  <div key={i} className={`absolute top-1 bottom-1 flex items-center justify-center text-[10px] font-bold ${
                    p.count >= 3 ? 'bg-red-200 text-red-800' : p.count >= 2 ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'
                  }`} style={{ left: px(m), width: px(m + 10) - px(m) }}>{p.count}</div>
                )
              })}
            </div>
          </Row>

          {/* Con tit */}
          <SectionDivider text={`CON TITULACIÓN — ESPECIALES (×${ALL_CON_TIT_JETS.length}) · SIN MONITOR`} className="border-green-300 bg-green-50 text-green-700" />
          {sortedConTit.map((jet) => <JetRow key={jet.id} jet={jet} section="con" />)}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-2">Resumen del día — Jets</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><p className="text-gray-500 text-xs">Reservas sin tit.</p><p className="font-bold text-blue-600 text-lg">{sinTitCount}</p></div>
          <div><p className="text-gray-500 text-xs">Reservas con tit.</p><p className="font-bold text-green-600 text-lg">{conTitCount}</p></div>
          <div><p className="text-gray-500 text-xs">Monitores pico</p><p className="font-bold text-gray-900 text-lg">{maxInstructors}</p></div>
          <div><p className="text-gray-500 text-xs">Motos libres ahora</p><p className="font-bold text-green-600 text-lg">{ALL_SIN_TIT_JETS.length - busyVX + ALL_CON_TIT_JETS.length - busyConTit}</p></div>
        </div>
      </div>

      {selectedRes && <JetDetailModal reservation={selectedRes} allReservations={reservations} staffNames={staffNames} onClose={() => setSelectedRes(null)} />}
      {quickBook && <JetQuickBook jetId={quickBook.jetId} time={quickBook.time} staffNames={staffNames} date={date} existingReservations={reservations} onClose={() => setQuickBook(null)} />}
    </div>
  )
}
