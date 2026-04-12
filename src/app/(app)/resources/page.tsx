import { createClient } from '@/lib/supabase/server'

export default async function ResourcesPage() {
  const supabase = await createClient()
  const { data: resources } = await supabase
    .from('resources')
    .select('*')
    .order('type')
    .order('name')

  const grouped = (resources ?? []).reduce<Record<string, typeof resources>>((acc, r) => {
    (acc[r.type] ||= []).push(r)
    return acc
  }, {})

  const labels: Record<string, string> = {
    jet_ski: 'Jet Skis',
    parasail_boat: 'Parasail Boats',
    nautic_boat: 'Nautic Boats',
  }

  // Filter out boat and catamaran resources
  delete grouped['boat']
  delete grouped['catamaran']

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Resources</h1>
      <div className="space-y-6">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{labels[type] ?? type}</h2>
              <span className="text-sm text-gray-500">{items?.length} items</span>
            </div>
            <div className="divide-y divide-gray-100">
              {items?.map((r) => (
                <div key={r.id} className="px-4 py-2 flex justify-between text-sm">
                  <span className="font-medium text-gray-900">{r.name}</span>
                  <span className="text-gray-500">
                    {r.model} · {r.capacity} pax {r.requires_license ? '· license' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
