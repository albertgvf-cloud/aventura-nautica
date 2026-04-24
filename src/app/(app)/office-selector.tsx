'use client'

import { useEffect, useState } from 'react'
import { OFFICES } from '@/lib/config'
import { getStoredOffice, setStoredOffice, subscribeOfficeChange } from '@/lib/office'

export default function OfficeSelector() {
  const [office, setOffice] = useState<string>('')

  useEffect(() => {
    setOffice(getStoredOffice())
    return subscribeOfficeChange((v) => setOffice(v))
  }, [])

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    setOffice(v)
    setStoredOffice(v)
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-600">
      <span className="hidden sm:inline">Oficina</span>
      <select
        value={office}
        onChange={onChange}
        className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-sky-500 min-h-[36px]"
      >
        <option value="">-- oficina --</option>
        {OFFICES.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}
