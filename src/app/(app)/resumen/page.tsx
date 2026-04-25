import { createClient } from '@/lib/supabase/server'
import { ALL_SIN_TIT_JETS, ALL_CON_TIT_JETS } from '@/lib/config'
import { formatDateResumen } from '@/lib/date'
import ResumenClient from './resumen-client'

type Reservation = {
  id: string
  activity_type: string
  activity: string
  date: string
  time: string
  num_people: number
  client_name: string
  status: string
  jet_id: string | null
  duration_minutes: number | null
  group_id: string | null
}

const allJets = [...ALL_SIN_TIT_JETS, ...ALL_CON_TIT_JETS]

function durationShort(mins: number): string {
  if (mins < 60) return `${mins}'`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h${m}m` : `${h}h`
}

export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const selectedDate = params.date ?? today

  const supabase = await createClient()
  const { data } = await supabase
    .from('reservations')
    .select('*')
    .eq('date', selectedDate)
    .neq('status', 'Cancelada')
    .order('time')

  const reservations: Reservation[] = data ?? []

  const dateLabel = formatDateResumen(selectedDate)

  // ===== Build text sections =====
  const nauticRes = reservations
    .filter((r) => r.activity_type === 'nautic')
    .sort((a, b) => a.time.localeCompare(b.time))

  const parasailingRes = reservations
    .filter((r) => r.activity_type === 'parasailing')
    .sort((a, b) => a.time.localeCompare(b.time))

  // Group jets by group_id (or singleton) and split by category (sin/con tit)
  const jetsRes = reservations.filter((r) => r.activity_type === 'jets')
  const seen = new Set<string>()
  type JetGroup = {
    time: string
    kind: 'exc' | 'cir' | 'tit'
    activity: string
    durationMin: number
    count: number
    client_name: string
    models: string[]
  }
  const jetGroups: JetGroup[] = []
  for (const r of jetsRes) {
    if (seen.has(r.id)) continue
    const members = r.group_id
      ? jetsRes.filter((s) => s.group_id === r.group_id)
      : [r]
    members.forEach((m) => seen.add(m.id))
    const time = r.time?.slice(0, 5) ?? ''
    const durationMin = r.duration_minutes ?? 60
    const kind: JetGroup['kind'] = r.activity.startsWith('Excursion')
      ? 'exc'
      : r.activity.startsWith('Circuito')
      ? 'cir'
      : 'tit'
    const models = Array.from(new Set(members.map((m) => allJets.find((j) => j.id === m.jet_id)?.model ?? '').filter(Boolean)))
    jetGroups.push({
      time,
      kind,
      activity: r.activity,
      durationMin,
      count: members.length,
      client_name: r.client_name,
      models,
    })
  }
  jetGroups.sort((a, b) => a.time.localeCompare(b.time))

  const sinLicGroups = jetGroups.filter((g) => g.kind !== 'tit')
  const conLicGroups = jetGroups.filter((g) => g.kind === 'tit')

  const lines: string[] = []
  lines.push(`📅 ${dateLabel}`)
  lines.push('')

  lines.push('ACTIVIDADES 🏄‍♂️🪂:')
  if (nauticRes.length === 0) {
    lines.push('• sin reservas')
  } else {
    for (const r of nauticRes) {
      lines.push(`• ${r.time.slice(0, 5)}h ${r.activity} x${r.num_people} - ${r.client_name}`)
    }
  }
  lines.push('')

  lines.push('MOTOS DE AGUA SIN LICENCIA 🛵💨🌊:')
  if (sinLicGroups.length === 0) {
    lines.push('• sin reservas')
  } else {
    for (const g of sinLicGroups) {
      const typeLabel = g.kind === 'exc' ? 'Excursion' : 'Circuito'
      lines.push(`• ${g.time} ${typeLabel} x${g.count} (${durationShort(g.durationMin)}) - ${g.client_name}`)
    }
  }
  lines.push('')

  lines.push('MOTOS DE AGUA CON LICENCIA 🛥️🌊:')
  if (conLicGroups.length === 0) {
    lines.push('• sin reservas')
  } else {
    for (const g of conLicGroups) {
      const model = g.models[0] ?? ''
      lines.push(`• ${g.time} ${model} x${g.count} (${durationShort(g.durationMin)}) - ${g.client_name}`)
    }
  }
  lines.push('')

  lines.push('PARASAILING 🪂:')
  if (parasailingRes.length === 0) {
    lines.push('• sin reservas')
  } else {
    for (const r of parasailingRes) {
      lines.push(`• ${r.time.slice(0, 5)} vuelo x${r.num_people} - ${r.client_name}`)
    }
  }

  const text = lines.join('\n')

  return (
    <ResumenClient text={text} selectedDate={selectedDate} today={today} dateLabel={dateLabel} />
  )
}
