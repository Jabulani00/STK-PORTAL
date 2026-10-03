export interface Session {
  userId: string
}

const REMEMBERED_KEY = 'stk-portal-session'
const TAB_KEY = 'stk-portal-session-tab'

function parse(value: string | null): Session | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Session
    if (!parsed.userId) return null
    return { userId: parsed.userId }
  } catch {
    return null
  }
}

export function readSession(): Session | null {
  if (typeof sessionStorage === 'undefined') return null
  return parse(sessionStorage.getItem(TAB_KEY)) ?? parse(localStorage.getItem(REMEMBERED_KEY))
}

export function writeSession(userId: string, remember: boolean) {
  clearSession()
  const value = JSON.stringify({ userId } satisfies Session)
  if (remember) localStorage.setItem(REMEMBERED_KEY, value)
  else sessionStorage.setItem(TAB_KEY, value)
}

export function clearSession() {
  localStorage.removeItem(REMEMBERED_KEY)
  sessionStorage.removeItem(TAB_KEY)
}
