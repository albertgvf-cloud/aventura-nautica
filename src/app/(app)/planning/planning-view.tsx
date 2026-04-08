'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ACTIVITY_TYPES, ACTIVITIES, TIME_SLOTS, PARASAILING_SLOTS } from '@/lib/config'
import TimeGrid from './time-grid'
import ParasailingGrid from './parasailing-grid'
import JetsGrid from './jets-grid'
import JetsForm from './jets-form'
import ReservationForm from './reservation-form'
import ReservationList from './reservation-list'
import SlotModal from './slot-modal'
import NoticesPanel from './notices-panel'

type Notice = {
  id: string
  date: string
  activity_type: string | null
  message: string
  type: string
  active: boolean
}

type Reservation = {
  id: string
  activity_type: string
  activity: string
  date: string
  time: string
  num_people: number
  client_name: string
  email: string | null
  phone: string | null
  staff: string | null
  office: string | null
  status: string
  arrived: boolean
  departed: boolean
  actual_time: string | null
  notes: string | null
}

export default function PlanningView({
  date,
  tab,
  reservations,
  staffNames,
  notices = [],
  isAdmin = false,
}: {
  date: string
  tab: string
  reservations: Reservation[]
  staffNames: string[]
  notices?: Notice[]
  isAdmin?: boolean
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(tab)
  const [modal, setModal] = useState<{ slot: string; activityName: string } | null>(null)

  const activeReservations = reservations.filter(
    (r) => r.activity_type === activeTab && r.status !== 'Cancelada'
  )
  const allForTab = reservations.filter((r) => r.activity_type === activeTab)
  const activities = ACTIVITIES[activeTab] ?? []
  const isParasailing = activeTab === 'parasailing'
  const isJets = activeTab === 'jets'

  function changeDate(offset: number) {
    const d = new Date(date)
    d.setDate(d.getDate() + offset)
    router.push(`/planning?date=${d.toISOString().slice(0, 10)}&tab=${activeTab}`)
    router.refresh()
  }

  function goToDate(newDate: string) {
    router.push(`/planning?date=${newDate}&tab=${activeTab}`)
    router.refresh()
  }

  function switchTab(tabId: string) {
    setActiveTab(tabId)
    router.push(`/planning?date=${date}&tab=${tabId}`, { scroll: false })
  }

  function handleSlotClick(slot: string, activityName: string) {
    setModal({ slot, activityName })
  }

  // Format date nicely
  const dateObj = new Date(date + 'T00:00:00')
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const dateLabel = `${dayNames[dateObj.getDay()]}, ${dateObj.getDate()} ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`
  // Short date for mobile
  const dateLabelShort = `${dayNames[dateObj.getDay()].slice(0, 3)}, ${dateObj.getDate()} ${monthNames[dateObj.getMonth()].slice(0, 3)}`

  // Total people count
  const totalPeople = activeReservations.reduce((sum, r) => sum + r.num_people, 0)

  // Get reservations for the modal slot
  const modalActivity = modal ? activities.find((a) => a.name === modal.activityName) : null
  const modalReservations = modal
    ? allForTab.filter(
        (r) => r.activity === modal.activityName && r.time?.slice(0, 5) === modal.slot
      )
    : []

  return (
    <div className="flex flex-col h-full">
      {/* Fixed top bar: date + tabs + notices — never scrolls */}
      <div className="shrink-0 bg-gray-50 px-3 sm:px-4 lg:px-6 pb-3 pt-3 space-y-3 border-b border-gray-200 shadow-sm z-20">

      {/* Date navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => changeDate(-1)}
            className="px-2 sm:px-3 py-2 sm:py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium text-sm min-h-[44px] sm:min-h-0"
            aria-label="Dia anterior"
          >
            <span className="sm:hidden">&larr;</span>
            <span className="hidden sm:inline">&larr; Ayer</span>
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => goToDate(e.target.value)}
            className="flex-1 sm:flex-none px-2 sm:px-3 py-2 sm:py-1.5 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-sky-500 text-sm min-h-[44px] sm:min-h-0"
          />
          <button
            onClick={() => changeDate(1)}
            className="px-2 sm:px-3 py-2 sm:py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium text-sm min-h-[44px] sm:min-h-0"
            aria-label="Dia siguiente"
          >
            <span className="sm:hidden">&rarr;</span>
            <span className="hidden sm:inline">Manana &rarr;</span>
          </button>
        </div>
        <div className="text-left sm:text-right">
          {/* Full date on sm+, short on mobile */}
          <p className="text-base sm:text-lg font-semibold text-gray-900">
            <span className="hidden sm:inline">{dateLabel}</span>
            <span className="sm:hidden">{dateLabelShort}</span>
          </p>
          <p className="text-xs sm:text-sm text-gray-500">
            {activeReservations.length} reservas · {totalPeople} personas
          </p>
        </div>
      </div>

      {/* Activity type tabs */}
      <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
        <div className="grid grid-cols-5 gap-2 sm:gap-3 min-w-max sm:min-w-0">
          {ACTIVITY_TYPES.map((t) => {
            const count = reservations.filter(
              (r) => r.activity_type === t.id && r.status !== 'Cancelada'
            ).length
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`whitespace-nowrap px-4 sm:px-5 py-2.5 sm:py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] sm:min-h-0 border-2 ${
                  activeTab === t.id
                    ? 'bg-white text-gray-900 shadow-md border-sky-400'
                    : 'bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-white border-transparent hover:border-gray-200'
                }`}
              >
                {t.emoji} {t.label}
                {count > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === t.id ? 'bg-sky-100 text-sky-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Admin notices */}
      <NoticesPanel notices={notices} date={date} activeTab={activeTab} isAdmin={isAdmin} />

      </div>

      <div className="flex-1 overflow-auto space-y-3 sm:space-y-4 p-3 sm:p-4 lg:p-6">

      {/* Quick add form — jets has its own form */}
      {isJets ? (
        <JetsForm date={date} reservations={allForTab} staffNames={staffNames} />
      ) : (
        <ReservationForm
          date={date}
          activityType={activeTab}
          activities={activities}
          staffNames={staffNames}
          timeSlots={isParasailing ? PARASAILING_SLOTS : TIME_SLOTS}
        />
      )}

      {/* Activity grid — each major type has its own view */}
      {isJets ? (
        <JetsGrid reservations={allForTab} onSlotClick={handleSlotClick} staffNames={staffNames} date={date} />
      ) : isParasailing ? (
        <ParasailingGrid reservations={allForTab} onSlotClick={handleSlotClick} />
      ) : (
        <TimeGrid activities={activities} reservations={allForTab} timeSlots={TIME_SLOTS} onSlotClick={handleSlotClick} />
      )}

      {/* Reservation list (detail) */}
      <ReservationList reservations={allForTab} date={date} activeTab={activeTab} />

      {/* Slot detail modal */}
      {modal && modalActivity && (
        <SlotModal
          slot={modal.slot}
          activityName={modal.activityName}
          activityType={activeTab}
          activityColor={modalActivity.color}
          capacity={modalActivity.capacity}
          date={date}
          reservations={modalReservations}
          staffNames={staffNames}
          onClose={() => setModal(null)}
        />
      )}
      </div>
    </div>
  )
}
