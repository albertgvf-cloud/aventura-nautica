import CustomerForm from '../customer-form'
import Link from 'next/link'

export default function NewCustomerPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/customers" className="text-sm text-sky-600 hover:underline">
          ← Back to customers
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Add customer</h1>
      </div>
      <CustomerForm />
    </div>
  )
}
