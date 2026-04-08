import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function BookingsPage() {
  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, reference, booking_date, status, source, total_amount, payment_status, created_at,
      customers(full_name, email, phone),
      booking_items(
        id, scheduled_start, scheduled_end, participants, total_price,
        activity_variants(name, activities(name)),
        resources(name)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <Link
          href="/bookings/new"
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium text-sm"
        >
          + New booking
        </Link>
      </div>

      {!bookings || bookings.length === 0 ? (
        <div className="p-8 bg-white rounded-xl border border-gray-200 text-center">
          <p className="text-gray-500">No bookings yet.</p>
          <Link href="/bookings/new" className="text-sky-600 hover:underline mt-2 inline-block">
            Create your first booking
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Ref</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Activity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">When</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Pax</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Payment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((b) => {
                const item = (b as any).booking_items?.[0]
                const customer = (b as any).customers
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{b.reference}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{customer?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item?.activity_variants?.name ?? '—'}
                      <div className="text-xs text-gray-500">{item?.resources?.name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item?.scheduled_start ? new Date(item.scheduled_start).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item?.participants ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-semibold text-right">
                      €{Number(b.total_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <PaymentBadge status={b.payment_status} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    completed: 'bg-blue-100 text-blue-700',
    no_show: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${styles[status] ?? 'bg-gray-100'}`}>
      {status}
    </span>
  )
}

function PaymentBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    partial: 'bg-orange-100 text-orange-700',
    refunded: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${styles[status] ?? 'bg-gray-100'}`}>
      {status}
    </span>
  )
}
