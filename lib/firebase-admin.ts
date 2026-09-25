import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

interface ServiceAccountJson {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

function parseServiceAccount(): ServiceAccountJson {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT no configurado.');
  }

  try {
    const parsed = JSON.parse(raw) as ServiceAccountJson;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error('campos incompletos');
    }

    return {
      ...parsed,
      private_key: parsed.private_key?.replace(/\\n/g, '\n'),
    };
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT debe ser un JSON stringificado valido con project_id, client_email y private_key.');
  }
}

export function getFirebaseAdminApp(): App {
  const [app] = getApps();
  if (app) return app;

  const serviceAccount = parseServiceAccount();
  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  });
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getFirebaseAdminStorage() {
  return getStorage(getFirebaseAdminApp());
}
