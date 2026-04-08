'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ACTIVITY_TYPES } from '@/lib/config'

type Notice = {
  id: string
  date: string
  activity_type: string | null
  message: string
  type: string
  active: boolean
}

const TYPE_STYLES: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  discount: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', icon: '💰', label: 'Descuento' },
  warning:  { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', icon: '⚠️', label: 'Aviso' },
  info:     { bg: 'bg-blue-50',  border: 'border-blue-300',  text: 'text-blue-800',  icon: 'ℹ️', label: 'Info' },
}

export default function NoticesPanel({
  notices,
  date,
  activeTab,
  isAdmin,
}: {
  notices: Notice[]
  date: string
  activeTab: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)

  // Filter notices for current tab (or global notices with no activity_type)
  const visibleNotices = notices.filter(
    (n) => !n.activity_type || n.activity_type === activeTab
  )

  async function deleteNotice(id: string) {
    await supabase.from('notices').update({ active: false }).eq('id', id)
    router.refresh()
  }

  if (visibleNotices.length === 0 && !isAdmin) return null

  return (
    <div className="space-y-2">
      {/* Visible notices */}
      {visibleNotices.map((n) => {
        const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.info
        const actLabel = n.activity_type
          ? ACTIVITY_TYPES.find((a) => a.id === n.activity_type)?.label ?? n.activity_type
          : 'Todas'
        return (
          <div key={n.id} className={`${style.bg} border ${style.border} rounded-xl px-3 sm:px-4 py-2.5 flex items-start gap-2`}>
            <span className="text-lg shrink-0">{style.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
                  {style.label}
                </span>
                {n.activity_type && (
                  <span className="text-xs text-gray-500">{actLabel}</span>
                )}
              </div>
              <p className={`text-sm ${style.text} mt-0.5`}>{n.message}</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => deleteNotice(n.id)}
                className="text-gray-400 hover:text-red-500 text-sm shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/50"
                title="Eliminar aviso"
              >
                ✕
              </button>
            )}
          </div>
        )
      })}

      {/* Admin: add notice button / form */}
      {isAdmin && (
        <>
          {showForm ? (
            <AddNoticeForm
              date={date}
              activeTab={activeTab}
              onSaved={() => { setShowForm(false); router.refresh() }}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50/50 transition-colors min-h-[44px] sm:min-h-0"
            >
              + Añadir aviso para este día
            </button>
          )}
        </>
      )}
    </div>
  )
}

function AddNoticeForm({
  date,
  activeTab,
  onSaved,
  onCancel,
}: {
  date: string
  activeTab: string
  onSaved: () => void
  onCancel: () => void
}) {
  const supabase = createClient()
  const [noticeDate, setNoticeDate] = useState(date)
  const [message, setMessage] = useState('')
  const [type, setType] = useState('info')
  const [activityType, setActivityType] = useState<string>(activeTab)
  const [scope, setScope] = useState<'tab' | 'all'>('tab')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return setError('Escribe un mensaje.')
    setSaving(true)
    setError(null)

    const { error: err } = await supabase.from('notices').insert({
      date: noticeDate,
      activity_type: scope === 'all' ? null : activityType,
      message: message.trim(),
      type,
    })

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="border-2 border-sky-200 bg-sky-50/50 rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm text-gray-900">Nuevo aviso</h4>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center">&times;</button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Día</label>
            <input type="date" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)}
              className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0">
              <option value="info">ℹ️ Info</option>
              <option value="discount">💰 Descuento</option>
              <option value="warning">⚠️ Aviso importante</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Aplica a</label>
            <select value={scope} onChange={(e) => setScope(e.target.value as 'tab' | 'all')}
              className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0">
              <option value="all">Todas las actividades</option>
              <option value="tab">Solo una actividad</option>
            </select>
          </div>
          {scope === 'tab' && (
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Actividad</label>
              <select value={activityType} onChange={(e) => setActivityType(e.target.value)}
                className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px] sm:min-h-0">
                {ACTIVITY_TYPES.map((a) => (
                  <option key={a.id} value={a.id}>{a.emoji} {a.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="mb-2">
          <label className="block text-xs text-gray-500 mb-0.5">Mensaje</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            required
            className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Ej: Descuento 20% en Monster para grupos de +8 personas"
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving}
            className="px-4 py-2 sm:py-1.5 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400 text-white text-sm rounded-lg font-medium min-h-[44px] sm:min-h-0">
            {saving ? 'Guardando...' : 'Publicar aviso'}
          </button>
          <button type="button" onClick={onCancel}
            className="px-4 py-2 sm:py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 min-h-[44px] sm:min-h-0">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
