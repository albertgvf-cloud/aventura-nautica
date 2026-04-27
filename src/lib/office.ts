// Office preference stored per-browser — picked once in the header,
// reused as the default value in any booking form.

const STORAGE_KEY = 'aventura-office'
const EVENT = 'aventura-office-changed'

export function getStoredOffice(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(STORAGE_KEY) ?? ''
}

export function setStoredOffice(office: string) {
  if (typeof window === 'undefined') return
  if (office) window.localStorage.setItem(STORAGE_KEY, office)
  else window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: office }))
}

export function subscribeOfficeChange(cb: (office: string) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => cb((e as CustomEvent<string>).detail ?? '')
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
