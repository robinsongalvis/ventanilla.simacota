'use client';

import { useEffect, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { db }                    from '@/lib/firebase';
import type { Radicado, TenantId } from '@/src/types/radicado';
import type { UsuarioAutenticado } from './useAuth';

export interface UseRadicadosReturn {
  radicados: Radicado[];
  cargando:  boolean;
  error:     string | null;
}

/**
 * Subscribes to the `radicados` collection via onSnapshot.
 *
 * Server-side filtering:
 *   - FUNCIONARIO / RECEPCIONISTA → where clasificacionIA.oficinaDestino == tenantId
 *   - ADMIN with tenantFiltro     → same where clause for the chosen tenant
 *   - ADMIN no filter             → full collection, ordered by fechaCreacion DESC
 *
 * Estado / prioridad / text filters are applied client-side in the page component
 * so stats can be computed from the full tenant dataset.
 *
 * Required Firestore index (create if missing):
 *   Collection: radicados
 *   Fields:     clasificacionIA.oficinaDestino ASC, fechaCreacion DESC
 */
export function useRadicados(
  usuario:      UsuarioAutenticado | null,
  tenantFiltro: TenantId | 'TODOS',
): UseRadicadosReturn {
  const [radicados, setRadicados] = useState<Radicado[]>([]);
  const [cargando,  setCargando]  = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Keep a stable reference to the unsubscribe function
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Clean up previous subscription before creating a new one
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    if (!usuario) {
      setRadicados([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const constraints: QueryConstraint[] = [];

    const effectiveTenant: TenantId | null =
      usuario.rol !== 'ADMIN'
        ? usuario.tenantId
        : tenantFiltro !== 'TODOS'
          ? tenantFiltro
          : null;

    if (effectiveTenant) {
      constraints.push(
        where('clasificacionIA.oficinaDestino', '==', effectiveTenant)
      );
    }

    constraints.push(orderBy('fechaCreacion', 'desc'));

    const q = query(collection(db, 'radicados'), ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        setRadicados(snap.docs.map((d) => d.data() as Radicado));
        setCargando(false);
        setError(null);
      },
      (err) => {
        // Firebase includes a direct link to create the missing index
        const indexLink = err.message.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];
        setError(
          indexLink
            ? `Falta un índice en Firestore. Créalo aquí: ${indexLink}`
            : `Error al cargar radicados: ${err.message}`
        );
        setCargando(false);
      }
    );

    unsubRef.current = unsub;

    return () => {
      unsub();
      unsubRef.current = null;
    };
  }, [usuario?.uid, usuario?.rol, usuario?.tenantId, tenantFiltro]);

  return { radicados, cargando, error };
}
