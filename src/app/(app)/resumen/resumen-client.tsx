'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ResumenClient({
  text,
  selectedDate,
  today,
  dateLabel,
}: {
  text: string
  selectedDate: string
  today: string
  dateLabel: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select textarea content
      const ta = document.getElementById('resumen-text') as HTMLTextAreaElement | null
      ta?.select()
    }
  }

  function handleWhatsApp() {
    const encoded = encodeURIComponent(text)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }

  const dateObj = new Date(selectedDate + 'T00:00:00')
  const prevDate = new Date(dateObj)
  prevDate.setDate(prevDate.getDate() - 1)
  const nextDate = new Date(dateObj)
  nextDate.setDate(nextDate.getDate() + 1)

  return (
    <div className="p-3 sm:p-6 overflow-auto h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Resumen para WhatsApp</h1>
          <p className="text-sm text-gray-500 capitalize">{dateLabel}</p>
        </div>
        <form method="get" className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/resumen?date=${prevDate.toISOString().slice(0, 10)}`}
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
            href={`/resumen?date=${nextDate.toISOString().slice(0, 10)}`}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
          >
            →
          </Link>
          {selectedDate !== today && (
            <Link
              href="/resumen"
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-100"
            >
              Hoy
            </Link>
          )}
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            onClick={handleCopy}
            className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] ${
              copied ? 'bg-green-600 text-white' : 'bg-sky-600 hover:bg-sky-700 text-white'
            }`}
          >
            {copied ? '✓ Copiado' : '📋 Copiar texto'}
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 text-white min-h-[44px]"
          >
            📱 Abrir en WhatsApp
          </button>
          <span className="text-xs text-gray-500">
            Pega el texto en el grupo del equipo
          </span>
        </div>

        <textarea
          id="resumen-text"
          readOnly
          value={text}
          className="w-full font-mono text-sm text-gray-900 border border-gray-200 rounded-lg p-3 bg-gray-50 outline-none focus:ring-2 focus:ring-sky-500"
          rows={Math.max(12, text.split('\n').length + 1)}
        />
      </div>
    </div>
  )
}
