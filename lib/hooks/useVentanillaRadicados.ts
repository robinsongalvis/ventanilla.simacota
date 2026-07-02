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
import { getDb } from '@/lib/firebase';
import { puedeVerTodosLosTenants } from '@/lib/permisos/alcance-tenants';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import type { UsuarioAutenticado } from './useAuth';

export interface UseVentanillaRadicadosReturn {
  radicados: VentanillaRadicado[];
  cargando:  boolean;
  error:     string | null;
}

/**
 * Suscripción en tiempo real a `ventanilla_radicados`.
 * Filtrado por tenant en servidor; filtros MIPG se aplican en cliente.
 *
 * Índice compuesto requerido en Firestore:
 *   Collection: ventanilla_radicados
 *   Fields:     clasificacion.oficinaDestino ASC  |  control.fechaRadicado DESC
 */
export function useVentanillaRadicados(
  usuario:      UsuarioAutenticado | null,
  tenantFiltro: TenantId | 'TODOS',
): UseVentanillaRadicadosReturn {
  const [radicados, setRadicados] = useState<VentanillaRadicado[]>([]);
  const [cargando,  setCargando]  = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = null;

    if (!usuario) {
      setRadicados([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const constraints: QueryConstraint[] = [];

    // Panel Op Nivel 1 — ADMIN, CONTROL_INTERNO y RECEPCIONISTA ven todos
    // los tenants (o filtran por tenantFiltro). La Ventanilla es la cara
    // del municipio y responde consultas de cualquier dependencia; las
    // reglas de Firestore y la búsqueda avanzada ya lo permitían.
    // FUNCIONARIO y JEFE_DEPENDENCIA ven solo su dependencia.
    const puedeVerTodo = puedeVerTodosLosTenants(usuario.rol);
    const effectiveTenant: TenantId | null = puedeVerTodo
      ? tenantFiltro !== 'TODOS' ? tenantFiltro : null
      : usuario.tenantId;

    if (effectiveTenant) {
      constraints.push(where('clasificacion.oficinaDestino', '==', effectiveTenant));
    }

    constraints.push(orderBy('control.fechaRadicado', 'desc'));

    const q = query(collection(getDb(), 'ventanilla_radicados'), ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        // Sprint Preoperación B: excluir radicados marcados como prueba
        // para que no aparezcan en la bandeja operativa.
        const filtrados = snap.docs
          .map((d) => d.data() as VentanillaRadicado & { isTest?: boolean; excludeFromMetrics?: boolean })
          .filter((r) => !r.isTest && !r.excludeFromMetrics);
        setRadicados(filtrados);
        setCargando(false);
        setError(null);
      },
      (err) => {
        const link = err.message.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];
        setError(
          link
            ? `Falta un índice en Firestore. Créalo aquí: ${link}`
            : `Error al cargar radicados: ${err.message}`,
        );
        setCargando(false);
      },
    );

    unsubRef.current = unsub;
    return () => {
      unsub();
      unsubRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.uid, usuario?.rol, usuario?.tenantId, tenantFiltro]);

  return { radicados, cargando, error };
}
