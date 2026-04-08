import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import BookingForm from './booking-form'

export default async function NewBookingPage() {
  const supabase = await createClient()

  const [{ data: customers }, { data: variants }, { data: resources }] = await Promise.all([
    supabase.from('customers').select('id, full_name, email, phone').order('full_name').limit(500),
    supabase
      .from('activity_variants')
      .select('id, name, duration_minutes, max_participants, min_participants, activity_id, activities(name)')
      .eq('active', true)
      .order('name'),
    supabase.from('resources').select('*').eq('active', true).order('name'),
  ])

  return (
    <div>
      <div className="mb-6">
        <Link href="/bookings" className="text-sm text-sky-600 hover:underline">
          ← Back to bookings
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">New booking</h1>
      </div>
      <BookingForm
        customers={customers ?? []}
        variants={(variants ?? []) as never}
        resources={resources ?? []}
      />
    </div>
  )
}
