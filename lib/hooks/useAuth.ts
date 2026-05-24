'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc }                 from 'firebase/firestore';
import { clearInternalSession, markInternalSessionActive } from '@/lib/auth-session';
import { getFirebaseAuth, getDb }      from '@/lib/firebase';
import type { TenantId }               from '@/src/types/radicado';

export interface UsuarioAutenticado {
  uid:      string;
  email:    string;
  nombre:   string;
  rol:      'ADMIN' | 'FUNCIONARIO' | 'RECEPCIONISTA';
  tenantId: TenantId;
}

export interface UseAuthReturn {
  usuario:      UsuarioAutenticado | null;
  cargando:     boolean;
  error:        string | null;
  cerrarSesion: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [usuario,  setUsuario]  = useState<UsuarioAutenticado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const db   = getDb();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        clearInternalSession();
        setUsuario(null);
        setCargando(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));

        if (!snap.exists()) {
          clearInternalSession();
          setError(
            'Tu cuenta no está registrada en el sistema. Contacta al administrador.'
          );
          setUsuario(null);
        } else {
          const data = snap.data();
          setUsuario({
            uid:      firebaseUser.uid,
            email:    firebaseUser.email ?? '',
            nombre:   data.nombre   ?? firebaseUser.email ?? 'Usuario',
            rol:      data.rol      ?? 'FUNCIONARIO',
            tenantId: data.tenantId as TenantId,
          });
          markInternalSessionActive();
          setError(null);
        }
      } catch {
        clearInternalSession();
        setError('Error al cargar datos del usuario. Intenta de nuevo.');
      } finally {
        setCargando(false);
      }
    });

    return () => unsub();
  }, []);

  const cerrarSesion = async () => {
    await signOut(getFirebaseAuth());
    clearInternalSession();
    setUsuario(null);
  };

  return { usuario, cargando, error, cerrarSesion };
}
