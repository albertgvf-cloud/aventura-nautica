import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CustomerForm from '../customer-form'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!customer) notFound()

  return (
    <div>
      <div className="mb-6">
        <Link href="/customers" className="text-sm text-sky-600 hover:underline">
          ← Back to customers
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{customer.full_name}</h1>
      </div>
      <CustomerForm initial={customer} />
    </div>
  )
}
