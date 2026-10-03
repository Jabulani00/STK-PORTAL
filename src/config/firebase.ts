/**
 * The only file to edit when connecting Firebase.
 * Leave these blank to keep the sample college in this browser.
 * Paste the web app config from Firebase console → Project settings → Your apps.
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}

/**
 * Used only on the first connection, when Firestore has no `portal/database` document.
 * true — write the sample college once so you can click through against Firebase.
 * false — never load or write the sample JSON. The app reads only what is already in Firebase.
 */
export const seedFirestoreWhenEmpty = true

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)
}
