import Link from 'next/link'

type Customer = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  nationality: string | null
  created_at: string
}

export default function CustomersTable({ customers }: { customers: Customer[] }) {
  if (customers.length === 0) {
    return (
      <div className="p-8 bg-white rounded-xl border border-gray-200 text-center">
        <p className="text-gray-500">No customers yet.</p>
        <Link href="/customers/new" className="text-sky-600 hover:underline mt-2 inline-block">
          Add your first customer
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Name</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Email</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Phone</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Nationality</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {customers.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link href={`/customers/${c.id}`} className="text-sky-700 hover:underline font-medium">
                  {c.full_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">{c.email ?? '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{c.phone ?? '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{c.nationality ?? '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-500 text-right">
                {new Date(c.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
