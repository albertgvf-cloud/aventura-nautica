'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Customer = {
  id?: string
  full_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  nationality: string | null
  notes: string | null
}

export default function CustomerForm({ initial }: { initial?: Customer }) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState<Customer>(
    initial ?? { full_name: '', email: '', phone: '', date_of_birth: '', nationality: '', notes: '' }
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof Customer>(key: K, value: Customer[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      date_of_birth: form.date_of_birth || null,
      nationality: form.nationality || null,
      notes: form.notes || null,
    }

    const { error } = initial?.id
      ? await supabase.from('customers').update(payload).eq('id', initial.id)
      : await supabase.from('customers').insert(payload)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    router.push('/customers')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl space-y-4">
      <Field label="Full name *" required>
        <input
          type="text"
          required
          value={form.full_name}
          onChange={(e) => update('full_name', e.target.value)}
          className="input"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Email">
          <input
            type="email"
            value={form.email ?? ''}
            onChange={(e) => update('email', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            value={form.phone ?? ''}
            onChange={(e) => update('phone', e.target.value)}
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Date of birth">
          <input
            type="date"
            value={form.date_of_birth ?? ''}
            onChange={(e) => update('date_of_birth', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Nationality">
          <input
            type="text"
            value={form.nationality ?? ''}
            onChange={(e) => update('nationality', e.target.value)}
            className="input"
            placeholder="e.g. Spanish"
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          value={form.notes ?? ''}
          onChange={(e) => update('notes', e.target.value)}
          rows={3}
          className="input"
        />
      </Field>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400 text-white font-medium rounded-lg"
        >
          {saving ? 'Saving...' : initial?.id ? 'Save changes' : 'Create customer'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/customers')}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgb(209 213 219);
          border-radius: 0.5rem;
          color: rgb(17 24 39);
          outline: none;
        }
        .input:focus {
          border-color: transparent;
          box-shadow: 0 0 0 2px rgb(14 165 233);
        }
      `}</style>
    </form>
  )
}

function Field({ label, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  )
}
