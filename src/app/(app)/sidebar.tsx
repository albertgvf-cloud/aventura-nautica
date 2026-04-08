'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/planning',  label: 'Planning',  icon: '📅' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/audit',     label: 'Auditoría', icon: '🔍', adminOnly: true },
]

export default function Sidebar({
  role,
  onNavigate,
}: {
  role: string | null
  onNavigate: () => void
}) {
  const pathname = usePathname()

  return (
    <aside className="w-64 lg:w-52 h-full bg-gradient-to-b from-sky-700 to-blue-900 text-white flex flex-col">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg p-1 shrink-0">
            <Image src="/logo.svg" alt="Aventura Nàutica" width={36} height={36} className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">Aventura Nàutica</h1>
            <p className="text-[10px] text-sky-200">Gestió de reserves</p>
          </div>
        </div>
        {/* Close button for mobile drawer */}
        <button
          onClick={onNavigate}
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
          aria-label="Cerrar menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="flex-1 py-4">
        {items.filter((i) => !('adminOnly' in i && i.adminOnly) || role === 'admin').map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-5 py-3 lg:py-2.5 text-sm transition-colors min-h-[44px] ${
                active
                  ? 'bg-white/15 text-white border-l-4 border-white'
                  : 'text-sky-100 hover:bg-white/10 border-l-4 border-transparent'
              }`}
            >
              <span className="text-lg lg:text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-white/10 text-xs text-sky-300">
        {role && <p className="capitalize">{role}</p>}
      </div>
    </aside>
  )
}
