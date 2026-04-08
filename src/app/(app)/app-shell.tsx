'use client'

import { useState, useEffect } from 'react'
import Sidebar from './sidebar'
import LogoutButton from './logout-button'

export default function AppShell({
  role,
  userName,
  userRole,
  children,
}: {
  role: string | null
  userName: string
  userRole: string
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change or resize to desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Desktop sidebar - always visible on lg+ */}
      <div className="hidden lg:block">
        <Sidebar role={role} onNavigate={() => {}} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar role={role} onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 h-14 lg:h-16 flex items-center justify-between px-3 sm:px-4 lg:px-6 shrink-0">
          {/* Hamburger button - visible on mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center justify-center w-10 h-10 -ml-1 rounded-lg hover:bg-gray-100 text-gray-700"
            aria-label="Abrir menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* App name on mobile (hidden on desktop since sidebar shows it) */}
          <span className="lg:hidden text-sm font-bold text-sky-700 truncate">Aventura Nautica</span>

          {/* Spacer for desktop */}
          <div className="hidden lg:block" />

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{userName}</p>
              <p className="text-xs text-gray-500 capitalize">{userRole}</p>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 overflow-hidden flex flex-col min-h-0">{children}</main>
      </div>
    </div>
  )
}
