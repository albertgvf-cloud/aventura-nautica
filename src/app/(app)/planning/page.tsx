import { createClient } from '@/lib/supabase/server'
import PlanningView from './planning-view'

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tab?: string }>
}) {
  const { date: dateParam, tab } = await searchParams
  const supabase = await createClient()

  const date = dateParam || new Date().toISOString().slice(0, 10)

  const [{ data: reservations }, { data: employees }, { data: notices }, { data: me }] = await Promise.all([
    supabase.from('reservations').select('*').eq('date', date).order('time'),
    supabase.from('employees').select('full_name').eq('active', true).order('full_name'),
    supabase.from('notices').select('*').eq('date', date).eq('active', true).order('created_at', { ascending: false }),
    supabase.from('employees').select('role').eq('id', (await supabase.auth.getUser()).data.user?.id ?? '').maybeSingle(),
  ])

  return (
    <PlanningView
      date={date}
      tab={tab || 'nautic'}
      reservations={reservations ?? []}
      staffNames={(employees ?? []).map((e) => e.full_name)}
      notices={notices ?? []}
      isAdmin={me?.role === 'admin'}
    />
  )
}
