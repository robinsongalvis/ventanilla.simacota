import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore }                       from 'firebase/firestore';
import { getAuth, type Auth }                                 from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ── Lazy singletons — safe for SSR/build-time ──────────────────────────────
// Module-level init fires at bundle evaluation time (during Next.js build),
// before env vars are available in the render context → Firebase crash.
// Using getters defers init to the first call-site inside a useEffect.

let _app:  FirebaseApp | undefined;
let _db:   Firestore   | undefined;
let _auth: Auth        | undefined;

function getFirebaseApp(): FirebaseApp {
  if (!_app) {
    if (!firebaseConfig.apiKey) {
      throw new Error(
        'Firebase API key no configurada. ' +
        'Verifica las variables NEXT_PUBLIC_FIREBASE_* en .env.local y en Vercel.'
      );
    }
    _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return _app;
}

export function getDb(): Firestore {
  if (!_db) _db = getFirestore(getFirebaseApp());
  return _db;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  return _auth;
}
