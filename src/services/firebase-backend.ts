import { initializeApp } from 'firebase/app'
import { doc, getDoc, getFirestore, setDoc, type Firestore } from 'firebase/firestore'
import { firebaseConfig, seedFirestoreWhenEmpty } from '../config/firebase.ts'
import { seedDatabase } from '../data/seed.ts'
import type { Database } from '../types/index.ts'

const COLLECTION = 'portal'
const DOCUMENT = 'database'

let firestore: Firestore | null = null

function asPlain(database: Database) {
  return JSON.parse(JSON.stringify(database)) as Database
}

function documentRef() {
  if (!firestore) throw new Error('Firebase is not connected.')
  return doc(firestore, COLLECTION, DOCUMENT)
}

export async function loadFirebaseDatabase() {
  const app = initializeApp(firebaseConfig)
  firestore = getFirestore(app)
  const snapshot = await getDoc(documentRef())
  if (snapshot.exists()) return snapshot.data() as Database
  if (!seedFirestoreWhenEmpty) {
    throw new Error(
      'Firebase is connected, but portal/database is empty. Add the college in the Firebase console, or set seedFirestoreWhenEmpty to true for one run.',
    )
  }
  const seed = asPlain(structuredClone(seedDatabase) as Database)
  await setDoc(documentRef(), seed)
  return seed
}

export async function saveFirebaseDatabase(database: Database) {
  if (!firestore) return
  await setDoc(documentRef(), asPlain(database))
}
