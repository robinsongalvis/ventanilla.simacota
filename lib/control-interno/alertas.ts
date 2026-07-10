/**
 * Generador de alertas automáticas para Control Interno.
 *
 * A partir de un set de radicados, deriva una lista de alertas
 * preventivas (sin tocar la base de datos). El consumidor decide si
 * las persiste, las muestra en vivo o las exporta.
 */

import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type {
  AlertaControlInterno,
  NivelRiesgo,
  TipoAlertaControlInterno,
} from '@/src/types/control-interno';
import {
  calcularCargaDependencias,
  evaluarRiesgoRadicado,
} from './riesgos';

const ESTADOS_RESUELTOS = new Set<string>(['RESUELTO', 'RECHAZADO']);

const UMBRAL_DEPENDENCIA_CONGESTIONADA = 5;

/* SIMI patrones — umbrales de las señales transversales. */
const UMBRAL_REINCIDENCIA = 3;   // radicados activos del mismo ciudadano
const UMBRAL_DEVOLUCIONES = 2;   // radicados devueltos activos por dependencia

const TIPOS_URGENTES = new Set<string>([
  'URGENTE',
  'PETICION_ENTES_CONTROL',
  'ENTES_CONTROL_URGENTE',
  'DENUNCIA',
  'HABEAS_DATA',
  'QUERELLA',
]);

function nuevoIdAlerta(prefijo: string, radicadoId: string | null, tenant: TenantId | null, fecha: string): string {
  const partes = [prefijo, radicadoId ?? 'sin-radicado', tenant ?? 'sin-tenant', fecha.slice(0, 10)];
  return partes.join(':');
}

function nivelDesdeDias(dias: number): NivelRiesgo {
  if (dias < 0) return 'CRITICO';
  if (dias <= 1) return 'ALTO';
  if (dias <= 2) return 'MEDIO';
  return 'BAJO';
}

interface ContextoAlerta {
  ahora?: Date;
  /** Si se conoce, permite generar alertas SIN_TRAZABILIDAD. */
  ultimasTrazabilidadesPorRadicado?: Map<string, string | null>;
}

/**
 * Deriva las alertas activas para un conjunto de radicados.
 *
 * Cada radicado puede generar múltiples alertas si cumple varios criterios.
 * El ID es determinístico (prefijo + radicadoId + fecha) para permitir
 * de-duplicación si se persiste.
 */
export function generarAlertas(
  radicados: VentanillaRadicado[],
  ctx: ContextoAlerta = {},
): AlertaControlInterno[] {
  const ahora = ctx.ahora ?? new Date();
  const fechaIso = ahora.toISOString();
  const carga = calcularCargaDependencias(radicados);
  const alertas: AlertaControlInterno[] = [];

  for (const r of radicados) {
    const activo = !ESTADOS_RESUELTOS.has(r.estadoActual);
    const evaluacion = evaluarRiesgoRadicado(
      r,
      {
        cargaDependencias: carga,
        ultimaTrazabilidadIso: ctx.ultimasTrazabilidadesPorRadicado?.get(r.radicadoId),
      },
      ahora,
    );

    if (!activo && r.cumplioTermino !== false) continue;

    const tenant = r.clasificacion.oficinaDestino;
    const responsable = {
      uid: r.clasificacion.funcionarioResponsableUid ?? null,
      nombre: r.clasificacion.funcionarioResponsableNombre ?? null,
    };

    const push = (
      tipo: TipoAlertaControlInterno,
      nivel: NivelRiesgo,
      motivo: string,
      accionSugerida: string,
    ): void => {
      alertas.push({
        id: nuevoIdAlerta(tipo, r.radicadoId, tenant, fechaIso),
        tipo,
        nivel,
        radicadoId: r.radicadoId,
        tenantId: tenant,
        responsableUid: responsable.uid,
        responsableNombre: responsable.nombre,
        motivo,
        accionSugerida,
        fecha: fechaIso,
        estado: 'ABIERTA',
      });
    };

    if (evaluacion.motivos.includes('VENCIDO')) {
      push(
        'RADICADO_VENCIDO',
        'CRITICO',
        'Radicado activo con fecha de vencimiento superada.',
        'Escalar a jefe de dependencia y solicitar respuesta inmediata.',
      );
    } else if (evaluacion.motivos.includes('POR_VENCER')) {
      const dias = evaluacion.motivos.includes('VENCIDO') ? -1 : 2;
      push(
        'RADICADO_POR_VENCER',
        nivelDesdeDias(dias),
        'Vence en 2 días hábiles o menos.',
        'Atender prioritariamente; confirmar plan de respuesta.',
      );
    }

    if (evaluacion.motivos.includes('SIN_RESPONSABLE')) {
      push(
        'SIN_RESPONSABLE',
        activo ? 'ALTO' : 'MEDIO',
        'Radicado activo sin responsable funcional asignado.',
        'Asignar responsable inmediatamente desde la bandeja.',
      );
    }

    if (evaluacion.motivos.includes('SIN_TRAZABILIDAD')) {
      push(
        'SIN_TRAZABILIDAD',
        'MEDIO',
        'No hay eventos de trazabilidad recientes.',
        'Solicitar a la dependencia que documente avance.',
      );
    }

    if (evaluacion.motivos.includes('RESUELTO_FUERA_TERMINO')) {
      push(
        'RESPUESTA_FUERA_TERMINO',
        'ALTO',
        'Respuesta oficial registrada fuera del término legal.',
        'Documentar hallazgo y solicitar plan de mejora.',
      );
    }

    if (evaluacion.motivos.includes('NOTIFICACION_FALLIDA')) {
      push(
        'NOTIFICACION_FALLIDA',
        'ALTO',
        'Correo institucional falló y no se ha gestionado.',
        'Verificar notificación alternativa y marcar como gestionada.',
      );
    }

    if (TIPOS_URGENTES.has(r.termino.tipoSolicitudId) && activo) {
      push(
        'TIPO_URGENTE_SIN_ATENDER',
        'ALTO',
        `Tipo de solicitud "${r.termino.tipoSolicitudNombre}" requiere atención prioritaria.`,
        'Confirmar atención inmediata y dejar evidencia documental.',
      );
    }

    if (evaluacion.motivos.includes('CON_PRORROGA')) {
      push(
        'PRORROGA_SIN_JUSTIFICACION',
        'MEDIO',
        'Radicado con prórroga aplicada — validar justificación.',
        'Revisar trazabilidad de la prórroga; documentar si falta soporte.',
      );
    }
  }

  // ── SIMI patrones — reincidencia ciudadana ──────────────────────
  // El mismo ciudadano con varios radicados activos suele anticipar
  // una tutela o un problema de fondo que las respuestas sueltas no
  // están resolviendo. Los anónimos y de identidad reservada se
  // excluyen: no se correlaciona lo que el ciudadano pidió proteger.
  const porCiudadano = new Map<string, VentanillaRadicado[]>();
  for (const r of radicados) {
    if (ESTADOS_RESUELTOS.has(r.estadoActual)) continue;
    if (r.esAnonimo === true || r.identidadReservada === true) continue;
    if (r.tipoPresentacion === 'ANONIMA' || r.tipoPresentacion === 'RESERVADA') continue;
    if (r.solicitante?.datosNoAportados?.documento === true) continue;
    const doc = r.solicitante?.numeroDocumento?.trim();
    if (!doc) continue;
    const lista = porCiudadano.get(doc) ?? [];
    lista.push(r);
    porCiudadano.set(doc, lista);
  }
  for (const lista of porCiudadano.values()) {
    if (lista.length < UMBRAL_REINCIDENCIA) continue;
    const ordenados = [...lista].sort((a, b) =>
      (b.control?.fechaRadicado ?? '').localeCompare(a.control?.fechaRadicado ?? ''));
    const reciente = ordenados[0];
    alertas.push({
      id: nuevoIdAlerta('CIUDADANO_REINCIDENTE', reciente.radicadoId, reciente.clasificacion.oficinaDestino, fechaIso),
      tipo: 'CIUDADANO_REINCIDENTE',
      nivel: 'ALTO',
      radicadoId: reciente.radicadoId,
      tenantId: reciente.clasificacion.oficinaDestino,
      motivo: `${reciente.solicitante.nombreCompleto} tiene ${lista.length} radicados activos al tiempo. Puede haber un problema de fondo sin resolver.`,
      accionSugerida: 'Revisar los casos en conjunto y unificar la respuesta antes de que escale a tutela.',
      fecha: fechaIso,
      estado: 'ABIERTA',
      metadata: { radicados: ordenados.map((r) => r.radicadoId), cantidad: lista.length },
    });
  }

  // ── SIMI patrones — devoluciones acumuladas por dependencia ─────
  // Varias devoluciones activas en la misma dependencia señalan
  // direccionamiento errado en recepción o "peloteo" interno — el
  // problema que la Ley 1755 prohíbe trasladarle al ciudadano.
  const devueltosPorTenant = new Map<TenantId, VentanillaRadicado[]>();
  for (const r of radicados) {
    if (r.estadoActual !== 'DEVUELTO') continue;
    const tenant = r.clasificacion.oficinaDestino;
    const lista = devueltosPorTenant.get(tenant) ?? [];
    lista.push(r);
    devueltosPorTenant.set(tenant, lista);
  }
  for (const [tenantId, lista] of devueltosPorTenant.entries()) {
    if (lista.length < UMBRAL_DEVOLUCIONES) continue;
    alertas.push({
      id: nuevoIdAlerta('DEVOLUCIONES_ACUMULADAS', null, tenantId, fechaIso),
      tipo: 'DEVOLUCIONES_ACUMULADAS',
      nivel: lista.length >= UMBRAL_DEVOLUCIONES * 2 ? 'ALTO' : 'MEDIO',
      radicadoId: null,
      tenantId,
      motivo: `La dependencia acumula ${lista.length} radicados devueltos sin resolver — puede indicar direccionamiento errado en recepción.`,
      accionSugerida: 'Revisar los motivos de devolución y ajustar el direccionamiento de ese tipo de trámite.',
      fecha: fechaIso,
      estado: 'ABIERTA',
      metadata: { radicados: lista.map((r) => r.radicadoId), cantidad: lista.length },
    });
  }

  // Alerta por dependencia congestionada (una por tenant con muchos vencidos).
  for (const [tenantId, vencidos] of carga.entries()) {
    if (vencidos < UMBRAL_DEPENDENCIA_CONGESTIONADA) continue;
    alertas.push({
      id: nuevoIdAlerta('DEPENDENCIA_CONGESTIONADA', null, tenantId, fechaIso),
      tipo: 'DEPENDENCIA_CONGESTIONADA',
      nivel: 'ALTO',
      radicadoId: null,
      tenantId,
      motivo: `La dependencia tiene ${vencidos} radicados vencidos.`,
      accionSugerida: 'Evaluar redistribución de carga o refuerzo de personal.',
      fecha: fechaIso,
      estado: 'ABIERTA',
      metadata: { vencidos },
    });
  }

  return alertas;
}

/** Cuenta alertas por nivel para semáforos. */
export function resumirAlertasPorNivel(
  alertas: AlertaControlInterno[],
): Record<NivelRiesgo, number> {
  const resumen: Record<NivelRiesgo, number> = { BAJO: 0, MEDIO: 0, ALTO: 0, CRITICO: 0 };
  for (const a of alertas) {
    if (a.estado !== 'ABIERTA') continue;
    resumen[a.nivel] += 1;
  }
  return resumen;
}
