export function getSession() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem('bc_session') || 'null') } catch { return null }
}
export function setSession(data) {
  if (typeof window !== 'undefined') localStorage.setItem('bc_session', JSON.stringify(data))
}
export function clearSession() {
  if (typeof window !== 'undefined') localStorage.removeItem('bc_session')
}
