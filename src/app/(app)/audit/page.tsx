import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AuditView from './audit-view'

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; staff?: string; action?: string }>
}) {
  const { date: dateParam, staff, action } = await searchParams
  const supabase = await createClient()

  // Check admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('employees').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') redirect('/planning')

  const date = dateParam || new Date().toISOString().slice(0, 10)

  // Fetch audit logs for the date
  const startOfDay = `${date}T00:00:00`
  const endOfDay = `${date}T23:59:59`

  let query = supabase
    .from('audit_log')
    .select('*')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .order('created_at', { ascending: false })

  if (staff) query = query.eq('performed_by', staff)
  if (action) query = query.eq('action', action)

  const { data: logs } = await query

  // Get staff list for filter
  const { data: employees } = await supabase
    .from('employees')
    .select('full_name')
    .eq('active', true)
    .order('full_name')

  return (
    <AuditView
      date={date}
      logs={logs ?? []}
      staffNames={(employees ?? []).map((e) => e.full_name)}
      currentStaff={staff ?? ''}
      currentAction={action ?? ''}
    />
  )
}
