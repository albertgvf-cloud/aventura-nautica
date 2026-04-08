import { createClient } from '@/lib/supabase/server'

export default async function EmployeesPage() {
  const supabase = await createClient()
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .order('full_name')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Employees</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees?.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{e.full_name}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{e.email}</td>
                <td className="px-4 py-3 text-sm text-gray-700 capitalize">{e.role}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${e.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {e.active ? 'active' : 'inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500 mt-4">
        💡 To add new employees: create the user in Supabase Auth, then add them to the employees table with their role.
      </p>
    </div>
  )
}
