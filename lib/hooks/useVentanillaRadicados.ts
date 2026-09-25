'use client';

import { useEffect, useRef, useState } from 'react';
import {
  collection,
  limit,
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
 * Ventana operativa del stream, en días calendario (ADR-0010, R11).
 *
 * Criterio de tamaño (Principio 13 — supuesto declarado): el término legal
 * más largo del catálogo (`lib/catalogos/tipos-solicitud.ts`) es 45 días
 * hábiles, y la prórroga máxima permitida duplica el término inicial
 * (Ley 1755/2015 art. 14, validado en `lib/server/radicados-security.ts`)
 * → hasta 90 días hábiles ≈ ~126 días calendario en el peor caso legal.
 * 180 días da margen (~54 días) sobre ese máximo teórico para festivos y
 * variabilidad, sin volver a acoplar la lectura al volumen histórico total.
 *
 * Riesgo residual declarado: un radicado activo que exceda 180 días
 * calendario sin resolverse (anomalía operativa ya fuera del término legal
 * máximo posible) saldría de esta ventana y no se vería en el stream en
 * tiempo real — solo sería localizable por la búsqueda avanzada paginada.
 * Ese escenario ya es en sí mismo un incumplimiento grave de término que
 * debería alertar por otra vía (fuera del alcance de este incremento).
 */
const VENTANA_DIAS_STREAM = 180;

/**
 * Tope duro de documentos suscritos, independiente del tamaño de la
 * ventana temporal (defensa adicional ante un pico de radicación atípico
 * dentro de la ventana — p. ej. una carga masiva). No es el mecanismo
 * principal de acotamiento (lo es la ventana temporal); es un techo de
 * seguridad para que el nº de documentos leídos nunca dependa de N.
 */
const LIMITE_DOCUMENTOS_STREAM = 500;

/**
 * Suscripción en tiempo real a `ventanilla_radicados`, acotada a la
 * ventana operativa (`VENTANA_DIAS_STREAM`) — ADR-0010, R11. El histórico
 * completo (fuera de la ventana) se consulta por la búsqueda avanzada
 * paginada, no por este stream.
 * Filtrado por tenant en servidor; filtros MIPG se aplican en cliente.
 *
 * Índice compuesto requerido en Firestore:
 *   Collection: ventanilla_radicados
 *   Fields:     clasificacion.oficinaDestino ASC  |  control.fechaRadicado DESC
 *
 * El filtro de ventana (`control.fechaRadicado >= cutoff`) es un rango
 * sobre el mismo campo del `orderBy` ya cubierto por ese índice compuesto
 * (y, sin tenant, por el índice de campo único que Firestore crea
 * automáticamente) — no requiere un índice nuevo.
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

    // Ventana operativa (ADR-0010, R11): acota el stream a los últimos
    // VENTANA_DIAS_STREAM días en vez de suscribir la colección completa.
    // El histórico se consulta por la búsqueda avanzada paginada.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - VENTANA_DIAS_STREAM);
    constraints.push(where('control.fechaRadicado', '>=', cutoff.toISOString()));

    constraints.push(orderBy('control.fechaRadicado', 'desc'));
    constraints.push(limit(LIMITE_DOCUMENTOS_STREAM));

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
