import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import CustomersTable from './customers-table'

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (q && q.trim()) {
    const term = `%${q.trim()}%`
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
  }

  const { data: customers, error } = await query

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <Link
          href="/customers/new"
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium text-sm"
        >
          + Add customer
        </Link>
      </div>

      <form method="get" className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name, email, or phone..."
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none text-gray-900"
        />
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
          {error.message}
        </div>
      )}

      <CustomersTable customers={customers ?? []} />
    </div>
  )
}
