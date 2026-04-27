// Date helpers — Spanish day names + DD/MM/YYYY numeric format.

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

function parse(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// "25/04/2026"
export function formatDate(dateStr: string): string {
  const d = parse(dateStr)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// "Sabado, 25/04/2026"
export function formatDateLong(dateStr: string): string {
  const d = parse(dateStr)
  return `${DAY_NAMES[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// "Sab, 25/04"
export function formatDateShort(dateStr: string): string {
  const d = parse(dateStr)
  return `${DAY_NAMES_SHORT[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

// Output suitable for the resumen WhatsApp text — "Sabado 25/04/2026"
export function formatDateResumen(dateStr: string): string {
  const d = parse(dateStr)
  return `${DAY_NAMES[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// "YYYY-MM-DD" using LOCAL date components — never use date.toISOString().slice(0, 10)
// because that returns the UTC day, which can be off-by-one in non-UTC timezones.
export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Add (or subtract) days from a YYYY-MM-DD string and return the new YYYY-MM-DD.
export function addDays(dateStr: string, offset: number): string {
  const d = parse(dateStr)
  d.setDate(d.getDate() + offset)
  return toYMD(d)
}
