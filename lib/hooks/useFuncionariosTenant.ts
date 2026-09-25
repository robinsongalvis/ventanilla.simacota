'use client';

/**
 * useFuncionariosTenant
 *
 * Carga la lista de usuarios activos de una dependencia para el selector
 * de responsable funcional en el flujo de asignación MIPG-2.
 *
 * Requiere que el usuario autenticado sea ADMIN o RECEPCIONISTA
 * (las reglas de Firestore permiten list en /users/ para esos roles).
 */

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { TenantId } from '@/src/types/radicado';
import type { RolInterno } from '@/lib/hooks/useAuth';

export interface FuncionarioTenant {
  uid:    string;
  nombre: string;
  email:  string;
  rol:    RolInterno;
  /** Campo opcional en el perfil de usuario */
  cargo?: string;
}

export interface UseFuncionariosTenantReturn {
  funcionarios: FuncionarioTenant[];
  cargando:     boolean;
  error:        string | null;
}

export function useFuncionariosTenant(
  tenantId: TenantId | '',
): UseFuncionariosTenantReturn {
  const [funcionarios, setFuncionarios] = useState<FuncionarioTenant[]>([]);
  const [cargando,     setCargando]     = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setFuncionarios([]);
      return;
    }

    let cancelado = false;
    setCargando(true);
    setError(null);

    const q = query(
      collection(getDb(), 'users'),
      where('tenantId', '==', tenantId),
      where('activo',   '==', true),
    );

    getDocs(q)
      .then((snap) => {
        if (cancelado) return;
        setFuncionarios(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              uid:    d.id,
              nombre: (data.nombre  as string | undefined) ?? (data.email as string | undefined) ?? d.id,
              email:  (data.email   as string | undefined) ?? '',
              rol:    ((data.rol    as RolInterno | undefined) ?? 'FUNCIONARIO'),
              cargo:  (data.cargo   as string | undefined),
            };
          }),
        );
      })
      .catch((err) => {
        if (!cancelado) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar funcionarios.',
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => { cancelado = true; };
  }, [tenantId]);

  return { funcionarios, cargando, error };
}
