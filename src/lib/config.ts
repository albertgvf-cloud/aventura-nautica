// Aventura Nautica configuration — all business rules in one place

export const OFFICES = ['Santa 1', 'Santa 2', 'Plataforma', 'Roses', 'Empu'] as const

export const STATUSES = ['Confirmada', 'Pendiente', 'Cancelada', 'Realizada'] as const

export const INCIDENT_TYPES = ['Mal tiempo', 'Problema tecnico AN', 'Problema del cliente'] as const

export const ACTIVITY_TYPES = [
  { id: 'nautic', label: 'Actividades', emoji: '🚤' },
  { id: 'parasailing', label: 'Parasailing', emoji: '🪂' },
  { id: 'jets', label: 'Jets', emoji: '🏄' },
] as const

// Activities per type, with capacity and hard max per slot
export const ACTIVITIES: Record<string, { name: string; capacity: number; hardMax: number; color: string }[]> = {
  nautic: [
    { name: 'MONSTER', capacity: 10, hardMax: 11, color: '#ef4444' },
    { name: 'CRAZY', capacity: 6, hardMax: 7, color: '#f97316' },
    { name: 'BANANA', capacity: 12, hardMax: 14, color: '#22c55e' },
  ],
  parasailing: [
    { name: 'Parasailing', capacity: 10, hardMax: 12, color: '#8b5cf6' },
  ],
  jets: [
    { name: 'Jet individual', capacity: 22, hardMax: 22, color: '#3b82f6' },
    { name: 'Jet grupo', capacity: 5, hardMax: 5, color: '#06b6d4' },
  ],
}

// ===== PARASAILING OPERATIONS CONFIG =====
export const PARASAILING = {
  maxPerDeparture: 10,        // ideal max — beyond this, delays cascade
  hardMaxPerDeparture: 12,    // absolute max
  flightGroupMin: 2,          // min per flight (heavy passengers)
  flightGroupMax: 4,          // max per flight (light passengers)
  minutesPerFlight: 10,       // ~10 min per flight turn
  departureDurationMinutes: 60,
  // Delay estimation: each person beyond 8 adds ~5 min delay to next departure
  delayPerExtraPerson: 5,
  delayThreshold: 8,          // start showing delay warning at 8+ people
  // Wind risk: after this hour, wind warning
  windWarningAfterHour: 13,
}

// Parasailing departures: 08:30, 09:00, then every 1h (10:00, 11:00, ... 19:00)
export function generateParasailingSlots(): string[] {
  const slots = ['08:30', '09:00']
  for (let h = 10; h <= 19; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
  }
  return slots
}
export const PARASAILING_SLOTS = generateParasailingSlots()

// ===== JETS OPERATIONS CONFIG =====
type JetDef = { id: string; model: string; label: string }

function makeFleet(prefix: string, model: string, count: number): JetDef[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    model,
    label: `${prefix} #${i + 1}`,
  }))
}

export const JETS = {
  startHour: 9,
  endHour: 20,
  totalMinutes: (20 - 9) * 60, // 660 min
  sinTitulacion: {
    fleet: makeFleet('VX', 'VX115', 16),
    durations: {
      excursion: [30, 40, 60, 120] as number[],
      circuit: [20, 30] as number[],
    },
    instructorRatio: 4, // 1 instructor per 4 jets
    rules: {
      excursionsSameDuration: true,
      circuitsCanMix: true,
    },
  },
  conTitulacion: {
    fleet: [
      { id: 'JB-01', model: 'Jet Blaster', label: 'Jet Blaster' },
      { id: 'EX100-01', model: 'EX100', label: 'EX100 #1' },
      { id: 'EX100-02', model: 'EX100', label: 'EX100 #2' },
      { id: 'VXHO-01', model: 'VXHO', label: 'VXHO' },
      { id: 'FX180-01', model: 'FX180', label: 'FX180' },
    ] as JetDef[],
    durations: [60, 120, 240, 480] as number[], // 1h, 2h, 4h, 8h
  },
  colors: {
    excursion: '#2563eb',
    circuit: '#06b6d4',
    conTit: '#8b5cf6',
    available: '#22c55e',
    busy: '#ef4444',
    nextBooking: '#f59e0b',
  },
}

// All jets combined for availability checks
export const ALL_SIN_TIT_JETS = JETS.sinTitulacion.fleet
export const ALL_CON_TIT_JETS = JETS.conTitulacion.fleet
export const ALL_JETS = [...ALL_SIN_TIT_JETS, ...ALL_CON_TIT_JETS]

// Jets time slots for departure picker (every 10 min from 09:00 to 19:50)
export function generateJetsSlots(): string[] {
  const slots: string[] = []
  for (let h = JETS.startHour; h < JETS.endHour; h++) {
    for (let m = 0; m < 60; m += 10) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
}
export const JETS_SLOTS = generateJetsSlots()

// Duration labels
export function durationLabel(mins: number): string {
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h${m}m` : `${h}h`
}

export function durationShort(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h${m}m` : `${h}h`
}

// Time helpers
export function addMinutesToTime(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Time slots from 9:30 to 20:00 (every 30 min) — for nautic and other activities
export function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 9; h <= 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 9 && m < 30) continue
      if (h === 20 && m > 0) continue
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
}
export const TIME_SLOTS = generateTimeSlots()
