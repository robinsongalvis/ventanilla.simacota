/**
 * predictDeadlineAlerts — Alertas predictivas de vencimiento PQRSD.
 *
 * Identifica radicados por nivel de urgencia y genera alertas.
 * Evita duplicados: una alerta del mismo tipo por radicado por día.
 */

import { getFirebaseAdminDb }    from '@/lib/firebase-admin';
import { diasRestantesHabiles }  from '@/lib/tiempos-radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { AlertaVencimiento, AlertaTipoDeadline } from '@/src/types/simi-control-interno';
import { ESTADOS_ACTIVOS as ESTADOS_ACTIVOS_DOMINIO } from '@/lib/radicado-estados';
import { soloOperacionReal, esDatoDePrueba, type MarcasDePrueba } from '@/lib/radicados/dato-de-prueba';

/**
 * ALCANCE DECLARADO de este vigilante (ADR-0033 §4.6-bis).
 *
 * Se DERIVA de `ESTADOS_ACTIVOS` en vez de reescribirla: hasta el 26-ago-2026
 * había una copia local que omitía `EN_SUBSANACION` sin decir si era decisión
 * u olvido. Ahora es una decisión escrita — y añadir un estado activo nuevo al
 * dominio lo incorpora aquí solo, sin que nadie tenga que acordarse.
 *
 * `EN_SUBSANACION` queda FUERA a propósito: en ese estado el término legal está
 * SUSPENDIDO (BM-B33), así que alertar de su vencimiento sería avisar de un
 * plazo que no está corriendo — y el aviso equivocado gasta la credibilidad del
 * que sí importa.
 */
const EXCLUIDOS_POR_TERMINO_SUSPENDIDO = {
  EN_SUBSANACION: 'El término legal está SUSPENDIDO (BM-B33): no hay vencimiento que alertar mientras el reloj esté detenido.',
};

const ESTADOS_ACTIVOS = new Set(
  [...ESTADOS_ACTIVOS_DOMINIO].filter((e) => !(e in EXCLUIDOS_POR_TERMINO_SUSPENDIDO)),
);

interface AlertaResult {
  alertasCreadas:    number;
  alertasOmitidas:  number;   // ya existían hoy
  radicadosAnalizados: number;
  resumen: { tipo: AlertaTipoDeadline; cantidad: number }[];
}

/** Verificar si ya existe una alerta del mismo tipo para el radicado hoy */
async function existeAlertaHoy(radicadoId: string, tipo: AlertaTipoDeadline): Promise<boolean> {
  const hoy = new Date().toISOString().slice(0, 10);
  try {
    const snap = await getFirebaseAdminDb()
      .collection('simi_alertas_vencimiento')
      .where('radicadoId', '==', radicadoId)
      .where('tipo', '==', tipo)
      .where('fechaAlerta', '>=', hoy)
      .limit(1)
      .get();
    return !snap.empty;
  } catch { return false; }
}

/** Crear alerta en Firestore */
async function crearAlerta(alerta: Omit<AlertaVencimiento, 'id'>): Promise<void> {
  await getFirebaseAdminDb().collection('simi_alertas_vencimiento').add({
    ...alerta,
    createdAt: new Date().toISOString(),
  });
}

/** Determinar el tipo de alerta según días restantes y prioridad */
function determinarTipo(
  dias: number,
  esPrioridadRojo: boolean,
  estado: string,
): AlertaTipoDeadline | null {
  if (dias < 0)          return 'vencido';
  if (dias <= 1)         return 'vencimiento_1_dia';
  if (dias <= 3)         return 'vencimiento_3_dias';
  if (dias <= 5)         return 'vencimiento_5_dias';
  if (esPrioridadRojo)   return 'riesgo_alto_sin_revision';
  if (estado === 'DEVUELTO') return 'devuelto_sin_ajuste';
  return null;
}

/**
 * Analiza todos los radicados activos y genera alertas predictivas.
 * Retorna un resumen de lo generado.
 */
export async function generateDeadlineAlerts(): Promise<AlertaResult> {
  const db   = getFirebaseAdminDb();
  const hoy  = new Date().toISOString().slice(0, 10);

  // Obtener radicados activos
  const snap = await db.collection('ventanilla_radicados')
    .where('estadoActual', 'in', [...ESTADOS_ACTIVOS])
    .limit(500)
    .get();

  /* CRITERIO CANÓNICO, no una copia. El filtro inline anterior
     (`!isTest && !excludeFromMetrics`) NO miraba `anulado`, así que los 27
     radicados de prueba anulados con acta —que conservan su estado y su fecha
     de vencimiento— habrían generado alertas como si fueran PQRSD ciudadanas
     vivas, y esas alertas alimentan el tablero de Control Interno. */
  const radicados = soloOperacionReal(
    snap.docs.map((d) => d.data() as VentanillaRadicado & MarcasDePrueba),
  );

  let alertasCreadas   = 0;
  let alertasOmitidas  = 0;
  const conteo: Partial<Record<AlertaTipoDeadline, number>> = {};

  // Obtener aprobaciones pendientes (batch lookup)
  const approvalSnap = await db.collection('simi_aprobaciones_respuesta')
    .where('estado', 'in', ['pendiente_revision_jefe', 'pendiente_revision_juridica'])
    .limit(200)
    .get();

  const pendientesJefeSet   = new Set<string>();
  const pendientesJuridicaSet = new Set<string>();

  for (const doc of approvalSnap.docs) {
    const d = doc.data();
    if (esDatoDePrueba(d as MarcasDePrueba)) continue;
    if (d.estado === 'pendiente_revision_jefe')     pendientesJefeSet.add(d.radicadoId as string);
    if (d.estado === 'pendiente_revision_juridica') pendientesJuridicaSet.add(d.radicadoId as string);
  }

  for (const r of radicados) {
    const dias = diasRestantesHabiles(r.termino.fechaVencimiento);
    const esPrioridadRojo = r.prioridad === 'ROJO';

    // Alertas de vencimiento
    const tipoPrincipal = determinarTipo(dias, esPrioridadRojo, r.estadoActual);
    if (tipoPrincipal) {
      const yaExiste = await existeAlertaHoy(r.radicadoId, tipoPrincipal);
      if (!yaExiste) {
        await crearAlerta({
          radicadoId:    r.radicadoId,
          tenantId:      r.clasificacion.oficinaDestino,
          tipo:          tipoPrincipal,
          diasRestantes: dias,
          prioridad:     dias < 0 || esPrioridadRojo ? 'critica' : dias <= 1 ? 'alta' : 'media',
          enviada:       false,
          fechaAlerta:   hoy,
        });
        alertasCreadas++;
        conteo[tipoPrincipal] = (conteo[tipoPrincipal] ?? 0) + 1;
      } else {
        alertasOmitidas++;
      }
    }

    // Alertas de aprobaciones pendientes
    if (pendientesJefeSet.has(r.radicadoId)) {
      const yaExiste = await existeAlertaHoy(r.radicadoId, 'pendiente_jefe');
      if (!yaExiste) {
        await crearAlerta({
          radicadoId:    r.radicadoId,
          tenantId:      r.clasificacion.oficinaDestino,
          tipo:          'pendiente_jefe',
          diasRestantes: dias,
          prioridad:     'alta',
          enviada:       false,
          fechaAlerta:   hoy,
        });
        alertasCreadas++;
        conteo['pendiente_jefe'] = (conteo['pendiente_jefe'] ?? 0) + 1;
      }
    }

    if (pendientesJuridicaSet.has(r.radicadoId)) {
      const yaExiste = await existeAlertaHoy(r.radicadoId, 'pendiente_juridica');
      if (!yaExiste) {
        await crearAlerta({
          radicadoId:    r.radicadoId,
          tenantId:      r.clasificacion.oficinaDestino,
          tipo:          'pendiente_juridica',
          diasRestantes: dias,
          prioridad:     'critica',
          enviada:       false,
          fechaAlerta:   hoy,
        });
        alertasCreadas++;
        conteo['pendiente_juridica'] = (conteo['pendiente_juridica'] ?? 0) + 1;
      }
    }
  }

  return {
    alertasCreadas,
    alertasOmitidas,
    radicadosAnalizados: radicados.length,
    resumen: Object.entries(conteo).map(([tipo, cantidad]) => ({
      tipo: tipo as AlertaTipoDeadline,
      cantidad,
    })),
  };
}
