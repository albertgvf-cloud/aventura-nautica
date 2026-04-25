import { createClient } from '@/lib/supabase/server'
import { ACTIVITIES, PARASAILING, JETS } from '@/lib/config'
import { formatDateLong } from '@/lib/date'
import Link from 'next/link'

type Reservation = {
  id: string
  activity_type: string
  activity: string
  date: string
  time: string
  num_people: number
  client_name: string
  staff: string | null
  office: string | null
  status: string
  arrived: boolean
  departed: boolean
  jet_id: string | null
  notes: string | null
  incident_type: string | null
  incident_comment: string | null
  incident_resolution: string | null
  incident_refund_amount: number | null
  incident_resolved_by: string | null
  incident_authorized_by: string | null
  duration_minutes: number | null
  created_at: string
}

type AuditLog = {
  id: string
  reservation_id: string | null
  action: string
  performed_by: string | null
  activity_type: string | null
  client_name: string | null
  details: string | null
  created_at: string
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const selectedDate = params.date ?? today
  const dayStart = `${selectedDate}T00:00:00`
  const dayEnd = `${selectedDate}T23:59:59.999`

  const supabase = await createClient()

  const [resForDateRes, resEnteredRes, auditRes] = await Promise.all([
    supabase.from('reservations').select('*').eq('date', selectedDate),
    supabase.from('reservations').select('*').gte('created_at', dayStart).lte('created_at', dayEnd),
    supabase
      .from('audit_log')
      .select('*')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .order('created_at', { ascending: false }),
  ])

  const resForDate: Reservation[] = resForDateRes.data ?? []
  const resEntered: Reservation[] = resEnteredRes.data ?? []
  const audit: AuditLog[] = auditRes.data ?? []

  // ========== Aggregates ==========
  const active = resForDate.filter((r) => r.status !== 'Cancelada')
  const activeEntered = resEntered.filter((r) => r.status !== 'Cancelada')

  // By activity type
  const byType = (type: string) => active.filter((r) => r.activity_type === type)
  const nauticRes = byType('nautic')
  const parasailingRes = byType('parasailing')
  const jetsRes = byType('jets')
  const peopleIn = (rs: Reservation[]) => rs.reduce((s, r) => s + r.num_people, 0)

  const totalPeople = peopleIn(active)
  const totalMotos = jetsRes.length

  // Jets breakdown by duration + by category
  const jetsByDuration = new Map<number, number>()
  for (const r of jetsRes) {
    const d = r.duration_minutes ?? 60
    jetsByDuration.set(d, (jetsByDuration.get(d) ?? 0) + 1)
  }
  const jetsDurationList = Array.from(jetsByDuration.entries()).sort((a, b) => a[0] - b[0])
  const jetsExcursion = jetsRes.filter((r) => r.activity.startsWith('Excursion')).length
  const jetsCircuito = jetsRes.filter((r) => r.activity.startsWith('Circuito')).length
  const jetsConTit = jetsRes.length - jetsExcursion - jetsCircuito

  function durationLabelShort(mins: number): string {
    if (mins < 60) return `${mins}min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? `${h}h${m}m` : `${h}h`
  }

  // By activity name (for nautic breakdown)
  const byActivity: Record<string, { people: number; capacity: number; color: string }> = {}
  for (const t of ['nautic', 'parasailing']) {
    for (const a of ACTIVITIES[t] ?? []) {
      byActivity[a.name] = { people: 0, capacity: 0, color: a.color }
    }
  }
  for (const r of active) {
    if (byActivity[r.activity]) byActivity[r.activity].people += r.num_people
  }

  // By staff (comercial) — using reservations ENTERED today
  const byStaff = new Map<string, { count: number; people: number; incidents: number }>()
  for (const r of resEntered) {
    const key = r.staff ?? '— sin comercial —'
    const rec = byStaff.get(key) ?? { count: 0, people: 0, incidents: 0 }
    rec.count += 1
    rec.people += r.num_people
    if (r.incident_type) rec.incidents += 1
    byStaff.set(key, rec)
  }
  const staffList = Array.from(byStaff.entries()).sort((a, b) => b[1].count - a[1].count)

  // Incidents for the day — include both active and cancelled reservations with an incident
  const incidents = resForDate.filter((r) => r.incident_type)
  const cancelledToday = resForDate.filter((r) => r.status === 'Cancelada' && r.incident_type)

  // Refunds today (incident-based, for the selected date)
  const refundRows = resForDate.filter(
    (r) => r.incident_resolution === 'Cancelar + devolucion' && r.incident_refund_amount != null
  )
  const refundTotal = refundRows.reduce((s, r) => s + (r.incident_refund_amount ?? 0), 0)

  const voucherRows = resForDate.filter(
    (r) => r.incident_resolution === 'Cancelar + generar vale' && r.incident_refund_amount != null
  )
  const voucherTotal = voucherRows.reduce((s, r) => s + (r.incident_refund_amount ?? 0), 0)

  // Audit modifications (exclude the noisy ones)
  const modifications = audit.filter((a) => ['modified', 'cancelled', 'arrived', 'departed', 'reactivated'].includes(a.action))
  const createdViaAudit = audit.filter((a) => a.action === 'created')

  // Occupancy % per nautic activity (sum people / sum capacity over all slots isn't meaningful;
  // use: current people / total daily capacity = capacity * slots_per_day)
  const nauticActivities = ACTIVITIES.nautic ?? []

  // Format date
  const dateObj = new Date(selectedDate + 'T00:00:00')
  const dateLabel = formatDateLong(selectedDate)

  const prevDate = new Date(dateObj); prevDate.setDate(prevDate.getDate() - 1)
  const nextDate = new Date(dateObj); nextDate.setDate(nextDate.getDate() + 1)

  return (
    <div className="p-3 sm:p-6 overflow-auto h-full">
      {/* Header with date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">{dateLabel}</p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <Link
            href={`/dashboard?date=${prevDate.toISOString().slice(0, 10)}`}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
          >
            ←
          </Link>
          <input
            type="date"
            name="date"
            defaultValue={selectedDate}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium"
          >
            Ver
          </button>
          <Link
            href={`/dashboard?date=${nextDate.toISOString().slice(0, 10)}`}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
          >
            →
          </Link>
          {selectedDate !== today && (
            <Link
              href="/dashboard"
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-100"
            >
              Hoy
            </Link>
          )}
        </form>
      </div>

      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Reservas entradas hoy"
          value={String(resEntered.length)}
          hint={`${activeEntered.length} activas · ${peopleIn(activeEntered)} pers.`}
        />
        <StatCard
          label="Personas del día"
          value={String(totalPeople)}
          hint={`${active.length} reservas activas`}
        />
        <StatCard
          label="Motos reservadas"
          value={String(totalMotos)}
          hint={
            jetsDurationList.length > 0
              ? jetsDurationList.map(([d, c]) => `${c}×${durationLabelShort(d)}`).join(' · ')
              : '—'
          }
        />
        <StatCard
          label="Devoluciones del día"
          value={`${refundTotal.toFixed(2)}€`}
          hint={`${refundRows.length} reserva${refundRows.length !== 1 ? 's' : ''}`}
          accent={refundTotal > 0 ? 'red' : undefined}
        />
      </div>

      {/* Second row: vouchers + occupancy */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Vales emitidos hoy"
          value={`${voucherTotal.toFixed(2)}€`}
          hint={`${voucherRows.length} reserva${voucherRows.length !== 1 ? 's' : ''}`}
          accent={voucherTotal > 0 ? 'amber' : undefined}
        />
        <StatCard
          label="Incidencias"
          value={String(incidents.length)}
          hint={`${cancelledToday.length} resultaron en cancelación`}
          accent={incidents.length > 0 ? 'amber' : undefined}
        />
        <StatCard label="Parasailing (pers.)" value={String(peopleIn(parasailingRes))} hint={`${parasailingRes.length} reservas`} />
        <StatCard label="Actividades (pers.)" value={String(peopleIn(nauticRes))} hint={`${nauticRes.length} reservas`} />
      </div>

      {/* Personas por actividad náutica */}
      <Section title="Personas por actividad">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {nauticActivities.map((a) => {
            const p = byActivity[a.name]?.people ?? 0
            const count = nauticRes.filter((r) => r.activity === a.name).length
            return (
              <MiniStat
                key={a.name}
                label={a.name}
                value={String(p)}
                sub={`${count} reserva${count !== 1 ? 's' : ''}`}
                color={a.color}
              />
            )
          })}
          <MiniStat
            label="Parasailing"
            value={String(peopleIn(parasailingRes))}
            sub={`${parasailingRes.length} reservas`}
            color="#8b5cf6"
          />
        </div>
      </Section>

      {/* Jets por duración */}
      <Section title="Jets">
        <div className="flex flex-wrap gap-3">
          <div className="px-4 py-3 rounded-xl border-2 border-blue-500 bg-blue-50">
            <p className="text-xs font-semibold text-blue-700">Total motos</p>
            <p className="text-2xl font-bold text-gray-900">{totalMotos}</p>
            <p className="text-[10px] text-gray-500">
              {jetsExcursion} exc · {jetsCircuito} circ · {jetsConTit} con tit.
            </p>
          </div>
          {jetsDurationList.length === 0 ? (
            <p className="text-sm text-gray-500 self-center">Sin motos reservadas este día.</p>
          ) : (
            jetsDurationList.map(([d, c]) => (
              <div key={d} className="px-4 py-3 rounded-xl border border-blue-200 bg-white">
                <p className="text-xs font-semibold text-blue-700">{durationLabelShort(d)}</p>
                <p className="text-xl font-bold text-gray-900">{c}</p>
                <p className="text-[10px] text-gray-500">
                  {c === 1 ? 'moto' : 'motos'}
                </p>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* Reservas por comercial */}
      <Section title="Reservas entradas hoy por comercial">
        {staffList.length === 0 ? (
          <p className="text-gray-500 text-sm py-2">Todavía no hay reservas entradas este dia.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr className="text-left text-xs text-gray-600">
                  <th className="px-3 py-2">Comercial</th>
                  <th className="px-3 py-2 text-right">Reservas</th>
                  <th className="px-3 py-2 text-right">Personas</th>
                  <th className="px-3 py-2 text-right">Incidencias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffList.map(([staff, rec]) => (
                  <tr key={staff} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{staff}</td>
                    <td className="px-3 py-2 text-right font-semibold">{rec.count}</td>
                    <td className="px-3 py-2 text-right">{rec.people}</td>
                    <td className={`px-3 py-2 text-right ${rec.incidents > 0 ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}>
                      {rec.incidents || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Incidencias del día */}
      <Section title={`Incidencias (${incidents.length})`}>
        {incidents.length === 0 ? (
          <p className="text-gray-500 text-sm py-2">Sin incidencias este dia.</p>
        ) : (
          <div className="space-y-1.5">
            {incidents.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5"
              >
                <span className="font-mono text-xs text-gray-500">{r.time?.slice(0, 5)}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white text-gray-700 uppercase">
                  {r.activity_type}
                </span>
                <span className="font-semibold text-gray-900">{r.client_name}</span>
                <span className="text-gray-600">·</span>
                <span className="text-amber-700 font-medium">{r.incident_type}</span>
                {r.incident_resolution && (
                  <>
                    <span className="text-gray-600">→</span>
                    <span className="text-amber-800">{r.incident_resolution}</span>
                  </>
                )}
                {r.incident_resolved_by && (
                  <span className="text-xs text-gray-600">· gest: {r.incident_resolved_by}</span>
                )}
                {r.incident_authorized_by && (
                  <span className={`text-xs px-1 rounded ${
                    r.incident_authorized_by === 'Sin autorizacion' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>aut: {r.incident_authorized_by}</span>
                )}
                {r.incident_refund_amount != null && (
                  <span className="ml-auto font-bold text-red-700">{r.incident_refund_amount}€</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Modificaciones / Actividad del día (audit log) */}
      <Section title={`Actividad del día (${modifications.length + createdViaAudit.length})`}>
        {modifications.length + createdViaAudit.length === 0 ? (
          <p className="text-gray-500 text-sm py-2">Sin actividad registrada.</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-auto">
            {[...createdViaAudit, ...modifications]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 50)
              .map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 text-xs border-b border-gray-100 py-1.5"
                >
                  <span className="font-mono text-gray-400 w-12">
                    {new Date(a.created_at).toTimeString().slice(0, 5)}
                  </span>
                  <ActionBadge action={a.action} />
                  {a.performed_by && (
                    <span className="text-gray-600">{a.performed_by}</span>
                  )}
                  <span className="font-medium text-gray-900">{a.client_name ?? '—'}</span>
                  <span className="text-gray-500 truncate">{a.details}</span>
                </div>
              ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: 'red' | 'amber' | 'green'
}) {
  const accentClass =
    accent === 'red' ? 'border-red-300 bg-red-50' :
    accent === 'amber' ? 'border-amber-300 bg-amber-50' :
    accent === 'green' ? 'border-green-300 bg-green-50' :
    'border-gray-200 bg-white'
  return (
    <div className={`p-4 rounded-xl border ${accentClass}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1 truncate">{hint}</p>}
    </div>
  )
}

function MiniStat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="p-3 rounded-xl border-2 bg-white" style={{ borderColor: color }}>
      <p className="text-xs font-semibold" style={{ color }}>{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    created: { label: 'Creada', cls: 'bg-green-100 text-green-800' },
    modified: { label: 'Editada', cls: 'bg-sky-100 text-sky-800' },
    cancelled: { label: 'Cancelada', cls: 'bg-red-100 text-red-800' },
    reactivated: { label: 'Reactivada', cls: 'bg-emerald-100 text-emerald-800' },
    arrived: { label: 'Llegada', cls: 'bg-green-100 text-green-800' },
    departed: { label: 'Salida', cls: 'bg-blue-100 text-blue-800' },
    deleted: { label: 'Eliminada', cls: 'bg-gray-200 text-gray-700' },
  }
  const e = map[action] ?? { label: action, cls: 'bg-gray-100 text-gray-700' }
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${e.cls} shrink-0`}>{e.label}</span>
}
