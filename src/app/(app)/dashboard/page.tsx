import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Count resources, customers, activities (placeholder stats for now)
  const [
    { count: customerCount },
    { count: resourceCount },
    { count: activityCount },
  ] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('resources').select('*', { count: 'exact', head: true }),
    supabase.from('activity_variants').select('*', { count: 'exact', head: true }),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Bookings today" value="0" hint="—" />
        <StatCard label="Revenue today" value="€0" hint="—" />
        <StatCard label="Customers" value={`${customerCount ?? 0}`} hint="total" />
        <StatCard label="Resources" value={`${resourceCount ?? 0}`} hint="jets, parasailing" />
      </div>

      <div className="p-6 bg-white rounded-xl border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Setup complete 🎉</h2>
        <p className="text-gray-600">
          {activityCount} activity variants and {resourceCount} resources are ready.
          Next: add customers and create your first booking.
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="p-5 bg-white rounded-xl border border-gray-200">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  )
}
