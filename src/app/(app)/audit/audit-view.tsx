'use client'

import { useRouter } from 'next/navigation'

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

const ACTION_STYLES: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  created:     { bg: 'bg-green-100', text: 'text-green-800', label: 'Creada', icon: '✅' },
  cancelled:   { bg: 'bg-red-100',   text: 'text-red-800',   label: 'Cancelada', icon: '❌' },
  modified:    { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Modificada', icon: '✏️' },
  arrived:     { bg: 'bg-blue-100',  text: 'text-blue-800',  label: 'Llegada', icon: '📍' },
  departed:    { bg: 'bg-cyan-100',  text: 'text-cyan-800',  label: 'Salida', icon: '⛵' },
  deleted:     { bg: 'bg-gray-100',  text: 'text-gray-800',  label: 'Eliminada', icon: '🗑' },
  reactivated: { bg: 'bg-purple-100',text: 'text-purple-800',label: 'Reactivada', icon: '↩️' },
}

const ACTIVITY_LABELS: Record<string, string> = {
  nautic: 'Náuticas', parasailing: 'Parasailing', jets: 'Jets',
}

export default function AuditView({
  date, logs, staffNames, currentStaff, currentAction,
}: {
  date: string
  logs: AuditLog[]
  staffNames: string[]
  currentStaff: string
  currentAction: string
}) {
  const router = useRouter()

  function applyFilters(newStaff?: string, newAction?: string) {
    const s = newStaff ?? currentStaff
    const a = newAction ?? currentAction
    const params = new URLSearchParams()
    params.set('date', date)
    if (s) params.set('staff', s)
    if (a) params.set('action', a)
    router.push(`/audit?${params.toString()}`)
    router.refresh()
  }

  function changeDate(newDate: string) {
    const params = new URLSearchParams()
    params.set('date', newDate)
    if (currentStaff) params.set('staff', currentStaff)
    if (currentAction) params.set('action', currentAction)
    router.push(`/audit?${params.toString()}`)
    router.refresh()
  }

  // Summary counts
  const created = logs.filter((l) => l.action === 'created').length
  const cancelled = logs.filter((l) => l.action === 'cancelled').length
  const modified = logs.filter((l) => l.action === 'modified').length
  const deleted = logs.filter((l) => l.action === 'deleted').length

  // Per-staff breakdown
  const staffBreakdown: Record<string, Record<string, number>> = {}
  for (const log of logs) {
    const name = log.performed_by ?? 'Desconocido'
    if (!staffBreakdown[name]) staffBreakdown[name] = {}
    staffBreakdown[name][log.action] = (staffBreakdown[name][log.action] ?? 0) + 1
  }

  const dateObj = new Date(date + 'T00:00:00')
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const dateLabel = `${dayNames[dateObj.getDay()]}, ${dateObj.getDate()} ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-gray-50 px-3 sm:px-4 lg:px-6 pb-3 pt-3 space-y-3 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">🔍 Auditoría</h1>
            <p className="text-sm text-gray-500">Registro de actividad — Solo administración</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); changeDate(d.toISOString().slice(0, 10)) }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 text-sm">←</button>
            <input type="date" value={date} onChange={(e) => changeDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
            <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); changeDate(d.toISOString().slice(0, 10)) }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 text-sm">→</button>
          </div>
        </div>
        <p className="text-sm font-medium text-gray-700">{dateLabel}</p>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select value={currentStaff} onChange={(e) => applyFilters(e.target.value, undefined)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">Todos los comerciales</option>
            {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={currentAction} onChange={(e) => applyFilters(undefined, e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">Todas las acciones</option>
            <option value="created">Creadas</option>
            <option value="cancelled">Canceladas</option>
            <option value="modified">Modificadas</option>
            <option value="deleted">Eliminadas</option>
            <option value="reactivated">Reactivadas</option>
            <option value="arrived">Llegadas</option>
            <option value="departed">Salidas</option>
          </select>
          {(currentStaff || currentAction) && (
            <button onClick={() => { router.push(`/audit?date=${date}`); router.refresh() }}
              className="px-2 py-1.5 text-sm text-gray-500 hover:text-red-500">✕ Limpiar filtros</button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Reservas creadas" value={created} icon="✅" color="text-green-600" />
          <SummaryCard label="Cancelaciones" value={cancelled} icon="❌" color="text-red-600" />
          <SummaryCard label="Modificaciones" value={modified} icon="✏️" color="text-amber-600" />
          <SummaryCard label="Eliminaciones" value={deleted} icon="🗑" color="text-gray-600" />
        </div>

        {/* Per-staff breakdown */}
        {Object.keys(staffBreakdown).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 text-sm">Actividad por comercial</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-gray-600">Comercial</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-600">Creadas</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-600">Canceladas</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-600">Modificadas</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-600">Eliminadas</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(staffBreakdown).map(([name, actions]) => {
                  const total = Object.values(actions).reduce((s, n) => s + n, 0)
                  const hasCancels = (actions.cancelled ?? 0) > 0 || (actions.deleted ?? 0) > 0
                  return (
                    <tr key={name} className={`hover:bg-gray-50 ${hasCancels ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-2 font-medium text-gray-900">{name}</td>
                      <td className="text-center px-2 py-2 text-green-700 font-semibold">{actions.created ?? 0}</td>
                      <td className={`text-center px-2 py-2 font-semibold ${(actions.cancelled ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{actions.cancelled ?? 0}</td>
                      <td className={`text-center px-2 py-2 font-semibold ${(actions.modified ?? 0) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{actions.modified ?? 0}</td>
                      <td className={`text-center px-2 py-2 font-semibold ${(actions.deleted ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{actions.deleted ?? 0}</td>
                      <td className="text-center px-2 py-2 font-bold text-gray-900">{total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Historial de acciones</h2>
            <span className="text-xs text-gray-500">{logs.length} registros</span>
          </div>
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No hay actividad registrada para este día.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {logs.map((log) => {
                const style = ACTION_STYLES[log.action] ?? ACTION_STYLES.modified
                const time = new Date(log.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                return (
                  <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50">
                    <span className="text-lg shrink-0">{style.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                        {log.activity_type && (
                          <span className="text-xs text-gray-500">{ACTIVITY_LABELS[log.activity_type] ?? log.activity_type}</span>
                        )}
                        {log.client_name && (
                          <span className="text-sm font-medium text-gray-900">{log.client_name}</span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-sm text-gray-600 mt-0.5">{log.details}</p>
                      )}
                      <div className="flex gap-3 mt-1 text-xs text-gray-400">
                        <span>🕐 {time}</span>
                        {log.performed_by && <span>👤 {log.performed_by}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
