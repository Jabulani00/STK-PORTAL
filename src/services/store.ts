import { isFirebaseConfigured, seedFirestoreWhenEmpty } from '../config/firebase.ts'
import { SEED_VERSION, seedDatabase } from '../data/seed.ts'
import type { Database } from '../types/index.ts'

const STORAGE_KEY = 'stk-portal-db-v1'

let memory: Database | null = null
let mode: 'local' | 'firebase' = 'local'
const listeners = new Set<() => void>()

function cloneSeed() {
  return structuredClone(seedDatabase) as Database
}

function publish() {
  listeners.forEach((listener) => listener())
}

function persist(database: Database) {
  if (mode === 'firebase') {
    void import('./firebase-backend.ts')
      .then((backend) => backend.saveFirebaseDatabase(database))
      .catch((error: unknown) => {
        console.error(error)
      })
    return
  }
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database))
}

function loadLocal() {
  if (typeof localStorage === 'undefined') return cloneSeed()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return cloneSeed()
    const parsed = JSON.parse(raw) as Database
    if (parsed.settings?.seedVersion !== SEED_VERSION) return cloneSeed()
    return parsed
  } catch {
    return cloneSeed()
  }
}

export function usesFirebase() {
  return mode === 'firebase'
}

export function sampleDataEnabled() {
  return mode !== 'firebase' || seedFirestoreWhenEmpty
}

/** Call once before the app renders. A blank config keeps the sample data. */
export async function connectPortal() {
  if (!isFirebaseConfigured()) return
  const backend = await import('./firebase-backend.ts')
  memory = await backend.loadFirebaseDatabase()
  mode = 'firebase'
  publish()
}

export const portalStore = {
  get() {
    memory ??= loadLocal()
    return memory
  },
  update(mutator: (draft: Database) => void) {
    const next = structuredClone(this.get()) as Database
    mutator(next)
    memory = next
    persist(next)
    publish()
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  reset() {
    if (mode === 'firebase' && !seedFirestoreWhenEmpty) {
      throw new Error('Sample data is turned off. This portal reads Firebase only.')
    }
    memory = cloneSeed()
    persist(memory)
    publish()
  },
}
