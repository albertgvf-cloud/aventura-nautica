'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getResourceFilter } from '@/lib/resource-matching'

type Customer = { id: string; full_name: string; email: string | null; phone: string | null }
type Variant = {
  id: string
  name: string
  duration_minutes: number | null
  max_participants: number | null
  min_participants: number | null
  activities: { name: string } | null
}
type Resource = {
  id: string
  name: string
  type: string
  model: string | null
  capacity: number | null
  requires_license: boolean | null
}

type Source = 'direct_customer' | 'point_of_sale' | 'phone' | 'email' | 'agency'
type PaymentStatus = 'pending' | 'paid' | 'partial'
type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'online'

export default function BookingForm({
  customers,
  variants,
  resources,
}: {
  customers: Customer[]
  variants: Variant[]
  resources: Resource[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [source, setSource] = useState<Source>('direct_customer')
  const [variantId, setVariantId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [participants, setParticipants] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'ok' | 'conflict'>('idle')

  const variant = variants.find((v) => v.id === variantId)
  const totalPrice = participants * unitPrice

  // Compute compatible resources based on activity variant
  const compatibleResources = useMemo(() => {
    if (!variant) return []
    const filter = getResourceFilter(variant.name)
    if (!filter) return resources
    return resources.filter((r) => {
      if (r.type !== filter.type) return false
      if (filter.model !== undefined && r.model !== filter.model) return false
      if (filter.requires_license !== undefined && r.requires_license !== filter.requires_license) return false
      return true
    })
  }, [variant, resources])

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 50)
    const s = customerSearch.toLowerCase()
    return customers
      .filter(
        (c) =>
          c.full_name.toLowerCase().includes(s) ||
          c.email?.toLowerCase().includes(s) ||
          c.phone?.includes(s)
      )
      .slice(0, 50)
  }, [customers, customerSearch])

  // Compute start/end timestamps
  const { startISO, endISO } = useMemo(() => {
    if (!date || !startTime || !variant?.duration_minutes) return { startISO: '', endISO: '' }
    const start = new Date(`${date}T${startTime}:00`)
    const end = new Date(start.getTime() + variant.duration_minutes * 60_000)
    return { startISO: start.toISOString(), endISO: end.toISOString() }
  }, [date, startTime, variant])

  // Check availability whenever resource + time changes
  useEffect(() => {
    if (!resourceId || !startISO || !endISO) {
      setAvailability('idle')
      return
    }
    setAvailability('checking')
    const controller = new AbortController()
    ;(async () => {
      // Find any booking_item for this resource that overlaps [startISO, endISO)
      const { data, error } = await supabase
        .from('booking_items')
        .select('id, scheduled_start, scheduled_end, booking:bookings!inner(status)')
        .eq('resource_id', resourceId)
        .lt('scheduled_start', endISO)
        .gt('scheduled_end', startISO)
      if (controller.signal.aborted) return
      if (error) {
        setAvailability('idle')
        return
      }
      const hasConflict = (data ?? []).some(
        // @ts-expect-error joined relation
        (r) => r.booking?.status === 'confirmed'
      )
      setAvailability(hasConflict ? 'conflict' : 'ok')
    })()
    return () => controller.abort()
  }, [resourceId, startISO, endISO, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!customerId) return setError('Please select a customer.')
    if (!variantId) return setError('Please select an activity.')
    if (!startISO || !endISO) return setError('Please pick a date and time.')
    if (!resourceId) return setError('Please select a resource.')
    if (availability === 'conflict') return setError('This resource is already booked at that time.')
    if (participants < 1) return setError('Participants must be at least 1.')

    setSaving(true)

    // 1) Create booking
    const today = new Date().toISOString().slice(0, 10)
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .insert({
        customer_id: customerId,
        booking_date: today,
        status: 'confirmed',
        source,
        total_amount: totalPrice,
        payment_status: paymentStatus,
        payment_method: paymentMethod || null,
        notes: notes || null,
      })
      .select('id, reference')
      .single()

    if (bErr || !booking) {
      setError(bErr?.message ?? 'Could not create booking')
      setSaving(false)
      return
    }

    // 2) Create booking item
    const { error: iErr } = await supabase.from('booking_items').insert({
      booking_id: booking.id,
      activity_variant_id: variantId,
      resource_id: resourceId,
      scheduled_start: startISO,
      scheduled_end: endISO,
      participants,
      unit_price: unitPrice,
      total_price: totalPrice,
    })

    if (iErr) {
      setError(`Booking created but item failed: ${iErr.message}`)
      setSaving(false)
      return
    }

    router.push('/bookings')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl space-y-5">
      {/* Customer */}
      <section>
        <h2 className="font-semibold text-gray-900 mb-3">1. Customer</h2>
        <input
          type="search"
          value={customerSearch}
          onChange={(e) => setCustomerSearch(e.target.value)}
          placeholder="Search customer by name, email, phone..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 mb-2"
        />
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          size={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">— select a customer —</option>
          {filteredCustomers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name} {c.email ? `· ${c.email}` : ''} {c.phone ? `· ${c.phone}` : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          No match?{' '}
          <a href="/customers/new" target="_blank" className="text-sky-600 hover:underline">
            Add a new customer
          </a>{' '}
          (opens in new tab, then refresh this page).
        </p>
      </section>

      {/* Activity + time + resource */}
      <section>
        <h2 className="font-semibold text-gray-900 mb-3">2. Activity & time</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Activity</label>
            <select
              value={variantId}
              onChange={(e) => {
                setVariantId(e.target.value)
                setResourceId('')
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">— select activity —</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.activities?.name} › {v.name}
                  {v.duration_minutes ? ` (${v.duration_minutes}min)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {variant && (
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Resource ({compatibleResources.length} compatible)
              </label>
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">— select resource —</option>
                {compatibleResources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {availability === 'checking' && (
                <p className="text-xs text-gray-500 mt-1">Checking availability...</p>
              )}
              {availability === 'ok' && (
                <p className="text-xs text-green-600 mt-1">✓ Available</p>
              )}
              {availability === 'conflict' && (
                <p className="text-xs text-red-600 mt-1">✗ Already booked at this time</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Participants & price */}
      <section>
        <h2 className="font-semibold text-gray-900 mb-3">3. Participants & price</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Participants</label>
            <input
              type="number"
              min={1}
              max={variant?.max_participants ?? undefined}
              value={participants}
              onChange={(e) => setParticipants(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Unit price (€)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Total</label>
            <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 bg-gray-50 font-semibold">
              €{totalPrice.toFixed(2)}
            </div>
          </div>
        </div>
      </section>

      {/* Payment + source */}
      <section>
        <h2 className="font-semibold text-gray-900 mb-3">4. Payment & source</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as Source)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="direct_customer">Direct (customer)</option>
              <option value="point_of_sale">Point of sale</option>
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="agency">Agency</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Payment status</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">—</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="online">Online</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <label className="block text-sm text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500"
        />
      </section>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3 pt-2 border-t border-gray-200">
        <button
          type="submit"
          disabled={saving || availability === 'conflict'}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400 text-white font-medium rounded-lg"
        >
          {saving ? 'Saving...' : 'Create booking'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/bookings')}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
