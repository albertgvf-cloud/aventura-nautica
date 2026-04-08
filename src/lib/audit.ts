import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function logAudit({
  reservationId,
  action,
  performedBy,
  activityType,
  clientName,
  details,
}: {
  reservationId?: string
  action: 'created' | 'cancelled' | 'modified' | 'arrived' | 'departed' | 'deleted' | 'reactivated'
  performedBy?: string
  activityType?: string
  clientName?: string
  details?: string
}) {
  try {
    await supabase.from('audit_log').insert({
      reservation_id: reservationId ?? null,
      action,
      performed_by: performedBy ?? null,
      activity_type: activityType ?? null,
      client_name: clientName ?? null,
      details: details ?? null,
    })
  } catch {
    // Silent fail — audit should never block operations
  }
}
