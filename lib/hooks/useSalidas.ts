'use client';

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { SalidaOficial } from '@/src/types/salida';

export interface UseSalidasReturn {
  salidas:  SalidaOficial[];
  cargando: boolean;
  error:    string | null;
}

/**
 * Ventana operativa del stream del libro de salidas, en días calendario
 * (Roadmap P1.5 — mismo antipatrón O(N) de R11, ahora en `ventanilla_salidas`).
 * Mismo criterio y misma magnitud que `VENTANA_DIAS_STREAM` de
 * `useVentanillaRadicados` (ver justificación allí): 180 días cubre con
 * margen el término legal máximo posible (hasta 90 días hábiles con
 * prórroga) para cualquier salida de tipo RESPUESTA amarrada a un radicado
 * de entrada, y es más que suficiente para OFICIO_INDEPENDIENTE, que no
 * tiene término legal asociado.
 *
 * Riesgo residual declarado: una salida registrada hace más de 180 días no
 * aparece en este stream — el libro histórico completo no tiene hoy una
 * vista de consulta paginada equivalente a la búsqueda avanzada de
 * radicados (fuera del alcance de este incremento).
 */
const VENTANA_DIAS_STREAM_SALIDAS = 180;

/**
 * Tope duro de documentos suscritos, independiente del tamaño de la ventana
 * temporal — misma defensa en profundidad que `LIMITE_DOCUMENTOS_STREAM` de
 * `useVentanillaRadicados`.
 */
const LIMITE_DOCUMENTOS_STREAM_SALIDAS = 500;

/**
 * Sprint Radicación de salida — suscripción al libro de salidas, acotada a
 * la ventana operativa (Roadmap P1.5).
 *
 * Solo se activa cuando la vista Salidas está abierta (`activo`): el
 * libro no necesita listener permanente como la bandeja. La vista está
 * gateada a ADMIN/RECEPCIONISTA/CONTROL_INTERNO, que por reglas leen
 * el libro completo — no hace falta recorte por tenant aquí.
 *
 * Índice Firestore: el filtro de ventana (`fechaSalida >= cutoff`) es un
 * rango sobre el MISMO campo del `orderBy` — Firestore resuelve esto con el
 * índice de campo único automático; no requiere índice compuesto nuevo
 * (confirmado con `npm run verificar:indices`).
 */
export function useSalidas(activo: boolean): UseSalidasReturn {
  const [salidas, setSalidas] = useState<SalidaOficial[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activo) return;
    setCargando(true);
    setError(null);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - VENTANA_DIAS_STREAM_SALIDAS);

    const q = query(
      collection(getDb(), 'ventanilla_salidas'),
      where('fechaSalida', '>=', cutoff.toISOString()),
      orderBy('fechaSalida', 'desc'),
      limit(LIMITE_DOCUMENTOS_STREAM_SALIDAS),
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
