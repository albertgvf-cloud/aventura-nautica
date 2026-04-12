'use client'

import { useState } from 'react'
import { JETS, ALL_SIN_TIT_JETS, ALL_CON_TIT_JETS, JETS_SLOTS, durationLabel, durationShort, timeToMinutes, addMinutesToTime } from '@/lib/config'
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
  const [checkTime, setCheckTime] = useState('')
  const [checkDuration, setCheckDuration] = useState(30)
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

  // Availability: count busy VX jets at each 10-min interval
  function getVXAvailability(): { time: number; free: number }[] {
    const totalVX = ALL_SIN_TIT_JETS.length
    const vxRes = active.filter((r) => ALL_SIN_TIT_JETS.some((j) => j.id === r.jet_id))
    const result: { time: number; free: number }[] = []
    for (let m = startMin; m < endMin; m += 10) {
      let busy = 0
      for (const r of vxRes) {
        const rs = timeToMinutes(r.time?.slice(0, 5) ?? '09:00')
        const re = rs + (r.duration_minutes ?? 60)
        if (m >= rs && m < re) busy++
      }
      result.push({ time: m, free: totalVX - busy })
    }
    return result
  }

  const vxAvailability = getVXAvailability()

  // Quick check: how many VX free for a given time + duration
  function getQuickCheckResult(): { free: number; total: number } | null {
    if (!checkTime) return null
    const totalVX = ALL_SIN_TIT_JETS.length
    const reqStart = timeToMinutes(checkTime)
    const reqEnd = reqStart + checkDuration
    const vxRes = active.filter((r) => ALL_SIN_TIT_JETS.some((j) => j.id === r.jet_id))
    const busyIds = new Set(
      vxRes.filter((r) => {
        const rs = timeToMinutes(r.time?.slice(0, 5) ?? '09:00')
        const re = rs + (r.duration_minutes ?? 60)
        return rs < reqEnd && re > reqStart
      }).map((r) => r.jet_id)
    )
    return { free: totalVX - busyIds.size, total: totalVX }
  }

  const quickCheckResult = getQuickCheckResult()
  const allDurations = [20, 30, 40, 60, 120]

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

  // ===== VIRTUAL ROW ASSIGNMENT FOR VX (pool mode) =====
  // All 16 VX rows shown. Reservations distributed for max efficiency:
  // - Same time (±15 min): excursions grouped together, circuits grouped together
  // - Different times: fill gaps in existing rows (reuse jets)
  function buildVirtualRows(): Reservation[][] {
    const totalVX = ALL_SIN_TIT_JETS.length
    const rows: Reservation[][] = Array.from({ length: totalVX }, () => [])

    const vxRes = active.filter((r) => ALL_SIN_TIT_JETS.some((j) => j.id === r.jet_id))

    // Sort: by time bucket (15 min), then excursions before circuits,
    // then by client name (keep same client's jets together), then duration desc
    const sorted = [...vxRes].sort((a, b) => {
      const tA = timeToMinutes(a.time?.slice(0, 5) ?? '09:00')
      const tB = timeToMinutes(b.time?.slice(0, 5) ?? '09:00')
      const bucketA = Math.floor(tA / 15)
      const bucketB = Math.floor(tB / 15)
      if (bucketA !== bucketB) return bucketA - bucketB
      // Same time bucket: excursions first
      const isExcA = a.activity.startsWith('Excursion') ? 0 : 1
      const isExcB = b.activity.startsWith('Excursion') ? 0 : 1
      if (isExcA !== isExcB) return isExcA - isExcB
      // Same type: group by client name
      const nameComp = a.client_name.localeCompare(b.client_name)
      if (nameComp !== 0) return nameComp
      // Same client: longest duration first
      const durA = a.duration_minutes ?? 60
      const durB = b.duration_minutes ?? 60
      if (durA !== durB) return durB - durA
      return tA - tB
    })

    function fitsInRow(rowIdx: number, rStart: number, rEnd: number): boolean {
      return !rows[rowIdx].some((b) => {
        const bStart = timeToMinutes(b.time?.slice(0, 5) ?? '09:00')
        const bEnd = bStart + (b.duration_minutes ?? 60)
        return bStart < rEnd && bEnd > rStart
      })
    }

    function rowHasSameTypeSameTime(rowIdx: number, isExcursion: boolean, timeBucket: number): boolean {
      return rows[rowIdx].some((b) => {
        const bIsExc = b.activity.startsWith('Excursion')
        const bBucket = Math.floor(timeToMinutes(b.time?.slice(0, 5) ?? '09:00') / 15)
        return bIsExc === isExcursion && bBucket === timeBucket
      })
    }

    for (const r of sorted) {
      const rStart = timeToMinutes(r.time?.slice(0, 5) ?? '09:00')
      const rEnd = rStart + (r.duration_minutes ?? 60)
      const isExcursion = r.activity.startsWith('Excursion')
      const timeBucket = Math.floor(rStart / 15)

      // Find all rows where this reservation fits
      const candidates: number[] = []
      for (let i = 0; i < totalVX; i++) {
        if (fitsInRow(i, rStart, rEnd)) candidates.push(i)
      }

      if (candidates.length === 0) {
        // Fallback (shouldn't happen with 16 rows)
        rows[totalVX - 1].push(r)
        continue
      }

      // Priority 1: row that has same client at same time (keep Lola's jets together)
      const sameClient = candidates.find((i) =>
        rows[i].some((b) => b.client_name === r.client_name && Math.floor(timeToMinutes(b.time?.slice(0, 5) ?? '09:00') / 15) === timeBucket)
      )
      if (sameClient !== undefined) {
        rows[sameClient].push(r)
        continue
      }

      // Priority 2: adjacent row to same client (next row after last row with this client)
      const lastClientRow = (() => {
        for (let i = totalVX - 1; i >= 0; i--) {
          if (rows[i].some((b) => b.client_name === r.client_name)) return i
        }
        return -1
      })()
      if (lastClientRow >= 0) {
        const adjacent = candidates.find((i) => i === lastClientRow + 1)
        if (adjacent !== undefined) { rows[adjacent].push(r); continue }
      }

      // Priority 3: row that has same-type bookings at the same time (excursions together)
      const sameTypeTime = candidates.find((i) => rowHasSameTypeSameTime(i, isExcursion, timeBucket))
      if (sameTypeTime !== undefined) {
        rows[sameTypeTime].push(r)
        continue
      }

      // Priority 4: row that already has bookings (fill gaps for efficiency)
      // Prefer the row with the most bookings (busiest jet = most efficient)
      const busyRows = candidates
        .filter((i) => rows[i].length > 0)
        .sort((a, b) => rows[b].length - rows[a].length)

      if (busyRows.length > 0) {
        rows[busyRows[0]].push(r)
        continue
      }

      // Priority 5: empty row adjacent to last used row of same type
      const lastSameTypeRow = (() => {
        for (let i = totalVX - 1; i >= 0; i--) {
          if (rows[i].some((b) => b.activity.startsWith('Excursion') === isExcursion)) return i
        }
        return -1
      })()

      if (lastSameTypeRow >= 0) {
        const nextRow = candidates.find((i) => i === lastSameTypeRow + 1)
        if (nextRow !== undefined) { rows[nextRow].push(r); continue }
      }

      // Otherwise first empty candidate
      rows[candidates[0]].push(r)
    }

    return rows
  }

  const virtualVXRows = buildVirtualRows()

  function ConTitJetRow({ jet }: { jet: { id: string; model: string; label: string } }) {
    const bookings = jetBookings(jet.id)
    const idx = ALL_CON_TIT_JETS.indexOf(jet)
    const stripeBg = idx % 2 === 0 ? 'bg-white' : 'bg-sky-50/40'
    return (
      <Row
        label={<span className="text-xs font-bold text-sky-800">{jet.model}</span>}
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
              className={`absolute rounded-lg flex items-center justify-center px-2 text-[11px] font-semibold text-white shadow-md cursor-pointer overflow-hidden ${b.arrived && !b.departed ? 'border-2 border-yellow-300 ring-2 ring-yellow-300/50' : 'border border-white/30'} ${b.arrived && !b.departed ? 'bg-yellow-500 hover:bg-yellow-600' : `${color.bg} ${color.hover}`} ${b.departed ? 'opacity-50' : ''}`}
              style={{ left: px(bStart), width: px(bStart + dur) - px(bStart), minWidth: 44, top: 4, bottom: 4 }}
              title={`${b.client_name} · ${b.activity} · ${b.time?.slice(0, 5)}–${addMinutesToTime(b.time?.slice(0, 5) ?? '09:00', dur)}${b.arrived ? ' · ✓ CLIENTE AQUÍ' : ''}`}
              onClick={(e) => { e.stopPropagation(); setSelectedRes(b) }}>
              <span className="truncate">{b.arrived && !b.departed ? '📍 ' : ''}<strong>{durationShort(dur)}</strong> {b.client_name}</span>
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

  function VXPoolRow({ bookings, idx }: { bookings: Reservation[]; idx: number }) {
    const stripeBg = idx % 2 === 0 ? 'bg-white' : 'bg-sky-50/40'
    const firstFreeVX = ALL_SIN_TIT_JETS[idx] ?? ALL_SIN_TIT_JETS[0]
    return (
      <Row
        label={<span className="text-xs font-bold text-sky-800">VX</span>}
        labelClass="bg-sky-100"
        rowClass={`border-b border-gray-200 hover:bg-blue-50/30 group h-12 ${stripeBg}`}
        onClick={(e) => handleRowClick(e, firstFreeVX.id)}
      >
        <GridLines />
        {bookings.map((b) => {
          const bStart = timeToMinutes(b.time?.slice(0, 5) ?? '09:00')
          const dur = b.duration_minutes ?? 60
          const color = bookingColor(b.activity)
          return (
            <div key={b.id}
              className={`absolute rounded-lg flex items-center justify-center px-2 text-[11px] font-semibold text-white shadow-md cursor-pointer overflow-hidden ${b.arrived && !b.departed ? 'border-2 border-yellow-300 ring-2 ring-yellow-300/50' : 'border border-white/30'} ${b.arrived && !b.departed ? 'bg-yellow-500 hover:bg-yellow-600' : `${color.bg} ${color.hover}`} ${b.departed ? 'opacity-50' : ''}`}
              style={{ left: px(bStart), width: px(bStart + dur) - px(bStart), minWidth: 44, top: 4, bottom: 4 }}
              title={`${b.client_name} · ${b.activity} · ${b.time?.slice(0, 5)}–${addMinutesToTime(b.time?.slice(0, 5) ?? '09:00', dur)}${b.arrived ? ' · ✓ CLIENTE AQUÍ' : ''}`}
              onClick={(e) => { e.stopPropagation(); setSelectedRes(b) }}>
              <span className="truncate">{b.arrived && !b.departed ? '📍 ' : ''}<strong>{color.prefix ? `${color.prefix} ` : ''}{durationShort(dur)}</strong> {b.client_name}</span>
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
      {/* QUICK AVAILABILITY CHECK */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-2">🔍 Consulta rápida de disponibilidad VX</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Hora salida</label>
            <select value={checkTime} onChange={(e) => setCheckTime(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
              <option value="">— selecciona —</option>
              {JETS_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Duración</label>
            <select value={checkDuration} onChange={(e) => setCheckDuration(Number(e.target.value))}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
              {allDurations.map((d) => <option key={d} value={d}>{durationLabel(d)}</option>)}
            </select>
          </div>
          {quickCheckResult && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
              quickCheckResult.free === 0 ? 'bg-red-100 text-red-800' :
              quickCheckResult.free <= 3 ? 'bg-amber-100 text-amber-800' :
              'bg-green-100 text-green-800'
            }`}>
              <span className="text-lg">{quickCheckResult.free === 0 ? '❌' : quickCheckResult.free <= 3 ? '⚠️' : '✅'}</span>
              <span>{quickCheckResult.free} VX libres de {quickCheckResult.total}</span>
              <span className="text-xs font-normal opacity-75">
                ({checkTime}–{addMinutesToTime(checkTime, checkDuration)})
              </span>
            </div>
          )}
          {checkTime && (
            <button type="button" onClick={() => setCheckTime('')}
              className="text-xs text-gray-400 hover:text-gray-600 underline">Limpiar</button>
          )}
        </div>
      </div>

      {/* GANTT TIMELINE — single wrapper so no space-y-4 gaps between header/axis/body */}
      <div>
        <div className="border border-gray-200 rounded-t-xl">
          <div className="px-3 sm:px-4 py-2.5 bg-gray-50 border-b border-gray-200 rounded-t-xl flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-900 text-sm">Timeline — Todas las motos</h3>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500" /> Excursión</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> Circuito</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600" /> Con tit.</span>
            </div>
          </div>
        </div>

        {/* TIME AXIS — sticky, no overflow ancestor between this and planning-view scroll */}
        <div className="sticky -top-3 sm:-top-4 lg:-top-6 z-40 border-b-2 border-gray-300 bg-white border-x border-gray-200" style={{ width: totalWidth, height: 32 }}>
          <div className="absolute top-0 bottom-0 bg-sky-100 border-r border-gray-300 z-10" style={{ width: MOTO_COL_W, position: 'sticky', left: 0 }} />
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

        <div className="relative z-0 border-x border-b border-gray-200 bg-white">
          {/* VX header */}
          <div className="relative border-b border-blue-200 bg-blue-50/50" style={{ width: totalWidth }}>
            <div className="sticky left-0 z-10 inline-block px-3 py-1.5 bg-blue-50 text-[10px] font-semibold text-blue-700">
              VX115 (×{ALL_SIN_TIT_JETS.length}) —
              <span className="inline-flex items-center gap-1 ml-1"><span className="w-2.5 h-2.5 rounded bg-orange-500 inline-block" /> {excCount} exc.</span>
              <span className="inline-flex items-center gap-1 ml-2"><span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" /> {circCount} circ.</span>
              <span className="inline-flex items-center gap-1 ml-2"><span className="w-2.5 h-2.5 rounded bg-green-600 inline-block" /> {titCount} con tit.</span>
            </div>
          </div>

          {/* VX rows — all 16 units, reservations distributed dynamically */}
          {virtualVXRows.map((bookings, i) => <VXPoolRow key={`vx-${i}`} bookings={bookings} idx={i} />)}

          {/* Availability summary row */}
          <Row label={<span className="text-[10px] font-bold text-emerald-700">📊 Libres</span>} labelClass="bg-emerald-50" rowClass="border-t-2 border-emerald-200 h-8">
            <div className="absolute inset-0 bg-emerald-50/30">
              {hours.map((h) => <div key={h} className="absolute top-0 h-full border-l border-gray-200" style={{ left: px(h * 60) }} />)}
              {vxAvailability.map((slot, i) => {
                const totalVX = ALL_SIN_TIT_JETS.length
                const pct = slot.free / totalVX
                const colorClass = slot.free === totalVX ? 'bg-emerald-100 text-emerald-600' :
                  slot.free === 0 ? 'bg-red-300 text-red-900' :
                  pct <= 0.25 ? 'bg-red-200 text-red-800' :
                  pct <= 0.5 ? 'bg-amber-200 text-amber-800' :
                  'bg-emerald-200 text-emerald-800'
                return (
                  <div key={i} className={`absolute top-1 bottom-1 flex items-center justify-center text-[9px] font-bold ${colorClass}`}
                    style={{ left: px(slot.time), width: px(slot.time + 10) - px(slot.time) }}
                    title={`${slot.free} VX libres a las ${String(Math.floor(slot.time / 60)).padStart(2, '0')}:${String(slot.time % 60).padStart(2, '0')}`}>
                    {slot.free}
                  </div>
                )
              })}
            </div>
          </Row>

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
          <SectionDivider text={`JETS CON TITULACIÓN`} className="border-green-300 bg-green-50 text-green-700" />
          {sortedConTit.map((jet) => <ConTitJetRow key={jet.id} jet={jet} />)}
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
