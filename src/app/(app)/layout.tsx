import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from './app-shell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <AppShell
      role={employee?.role ?? null}
      userName={employee?.full_name ?? user.email ?? ''}
      userRole={employee?.role ?? 'no role'}
    >
      {children}
    </AppShell>
  )
}
