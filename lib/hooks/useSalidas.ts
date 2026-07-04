'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { SalidaOficial } from '@/src/types/salida';

export interface UseSalidasReturn {
  salidas:  SalidaOficial[];
  cargando: boolean;
  error:    string | null;
}

/**
 * Sprint Radicación de salida — suscripción al libro de salidas.
 *
 * Solo se activa cuando la vista Salidas está abierta (`activo`): el
 * libro no necesita listener permanente como la bandeja. La vista está
 * gateada a ADMIN/RECEPCIONISTA/CONTROL_INTERNO, que por reglas leen
 * el libro completo — no hace falta recorte por tenant aquí.
 */
export function useSalidas(activo: boolean): UseSalidasReturn {
  const [salidas, setSalidas] = useState<SalidaOficial[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activo) return;
    setCargando(true);
    setError(null);

    const q = query(
      collection(getDb(), 'ventanilla_salidas'),
      orderBy('fechaSalida', 'desc'),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setSalidas(snap.docs.map((d) => d.data() as SalidaOficial));
        setCargando(false);
      },
      () => {
        setError('No fue posible cargar el libro de salidas.');
        setCargando(false);
      },
    );
    return unsubscribe;
  }, [activo]);

  return { salidas, cargando, error };
}
