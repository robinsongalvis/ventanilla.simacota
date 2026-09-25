import type { TrazabilidadRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { fechaYmdColombia } from '@/lib/kpis-operativos/calcular-kpis-operativos';

/**
 * Sprint Panel claro — la trazabilidad contada en humano.
 *
 * Los códigos (`NOTIFICACION_CORREO_ENVIADA`, `ASIGNACION`…) siguen
 * intactos en Firestore: son el registro de auditoría. Este helper solo
 * cambia cómo se CUENTAN en pantalla:
 *
 *  - cada código se vuelve una frase ("Trasladado a Planeación");
 *  - los correos automáticos se pliegan dentro del evento que los causó
 *    ("Se avisó al ciudadano por correo") — la historia queda a la
 *    mitad de largo; un correo FALLIDO nunca se pliega: es alerta roja;
 *  - las asignaciones dentro de la misma dependencia lo dicen así, sin
 *    flechas redundantes ("Hacienda → Hacienda");
 *  - los eventos se agrupan por día colombiano ("Hoy · 6 de julio").
 *
 * Función pura: sin React, sin Firestore. `ahora` inyectable.
 */

export type TonoEvento = 'VERDE' | 'AZUL' | 'AMBAR' | 'ROJO' | 'GRIS' | 'DORADO';
export type FiltroHistoria = 'TODO' | 'ACTUACIONES' | 'CORREOS';

export interface CorreoPlegado {
  texto: string;
}

export interface EventoHumano {
  id:      string;
  fecha:   string;
  /** "5:16 p. m." en hora colombiana. */
  hora:    string;
  titulo:  string;
  /** Texto secundario (motivo, nota, detalle) — null si el título basta. */
  detalle: string | null;
  actor:   string | null;
  tono:    TonoEvento;
  /** Correos automáticos causados por este evento, plegados. */
  correos: CorreoPlegado[];
  /** True si el evento en sí es un correo automático (plegable). */
  esCorreo: boolean;
}

export interface DiaHistoria {
  ymd:      string;
  /** "Hoy · 6 de julio" · "Ayer · 5 de julio" · "Viernes 3 de julio" */
  etiqueta: string;
  eventos:  EventoHumano[];
}

/** Correos automáticos plegables (los fallidos NUNCA se pliegan). */
const ACCIONES_CORREO = new Set([
  'NOTIFICACION_CORREO_ENVIADA',
  'CONSTANCIA_ENVIADA_CORREO',
  'NOTIFICACION_OMITIDA_DUPLICADA',
]);

const TEXTO_CORREO: Record<string, string> = {
  NOTIFICACION_CORREO_ENVIADA:   'Se avisó al ciudadano por correo',
  CONSTANCIA_ENVIADA_CORREO:     'Constancia enviada por correo al ciudadano',
  NOTIFICACION_OMITIDA_DUPLICADA: 'Aviso omitido: ya se había enviado',
};

/** Ventana máxima entre la actuación y su correo automático. */
const VENTANA_PLEGADO_MS = 10 * 60 * 1000;

function nombreTenant(id: unknown): string | null {
  return typeof id === 'string' ? (NOMBRES_TENANT[id as TenantId] ?? id) : null;
}

function horaColombia(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function humanizar(e: TrazabilidadRadicado): Omit<EventoHumano, 'correos'> {
  const base = {
    id:      e.eventoId ?? `${e.accion}_${e.fecha}`,
    fecha:   e.fecha,
    hora:    horaColombia(e.fecha),
    actor:   e.actorNombre || null,
    detalle: null as string | null,
    esCorreo: ACCIONES_CORREO.has(e.accion),
  };
  const nota = typeof e.nota === 'string' && e.nota.trim() ? e.nota.trim() : null;

  switch (e.accion) {
    case 'RADICACION':
      return { ...base, titulo: 'Radicado en la Ventanilla Única', detalle: nota, tono: 'VERDE' };

    case 'ASIGNACION':
    case 'TRASLADO': {
      const meta = e.metadata ?? {};
      const origen  = nombreTenant(e.oficinaOrigen ?? meta.dependenciaOrigen);
      const destino = nombreTenant(e.oficinaDestino ?? meta.dependenciaDestino);
      const area = typeof meta.areaResponsable === 'string'
        ? ` · Área: ${meta.areaResponsable}` : '';
      if (destino && origen && origen !== destino) {
        return {
          ...base,
          titulo:  `Trasladado a ${destino}`,
          detalle: `Desde ${origen}${area}`,
          tono:    'AZUL',
        };
      }
      return {
        ...base,
        titulo:  destino ? `Asignado dentro de ${destino}` : 'Asignación actualizada',
        detalle: area ? area.replace(' · ', '') : null,
        tono:    'AZUL',
      };
    }

    case 'DEVOLUCION':
      return { ...base, titulo: 'Devuelto a la Ventanilla', detalle: nota, tono: 'AMBAR' };

    case 'PRORROGA':
      return { ...base, titulo: 'Prórroga aplicada al término', detalle: nota, tono: 'AMBAR' };

    case 'RESPUESTA_FUNCIONARIO':
      return { ...base, titulo: 'Respuesta oficial registrada', detalle: nota, tono: 'VERDE' };

    case 'DATOS_NO_APORTADOS_MARCADOS':
      return { ...base, titulo: 'Anotación: datos que el solicitante no aportó', detalle: nota, tono: 'AMBAR' };

    case 'DATOS_COMPLETADOS':
      return { ...base, titulo: 'Datos del solicitante completados', detalle: nota, tono: 'VERDE' };

    case 'DOCUMENTO_SELLADO':
      return { ...base, titulo: 'Documento sellado digitalmente', detalle: nota, tono: 'GRIS' };

    case 'TIPO_SOLICITUD_RECLASIFICADO':
    case 'RECLASIFICACION':
      return { ...base, titulo: 'Tipo de solicitud reclasificado', detalle: nota, tono: 'AMBAR' };

    case 'CAMBIO_ESTADO':
      return { ...base, titulo: 'Cambio de estado', detalle: nota, tono: 'GRIS' };

    case 'CLASIFICACION_IA':
      return { ...base, titulo: 'Clasificación sugerida por la IA', detalle: nota, tono: 'GRIS' };

    case 'NOTIFICACION_WHATSAPP':
      return { ...base, titulo: 'Notificación por WhatsApp', detalle: nota, tono: 'GRIS' };

    case 'OFICIO_SALIDA_REGISTRADO':
      return { ...base, titulo: 'Salida 2-SAL despachada', detalle: nota, tono: 'DORADO' };

    case 'NOTIFICACION_CORREO_FALLIDA':
      return { ...base, titulo: 'El correo al ciudadano falló', detalle: nota, tono: 'ROJO' };

    case 'NOTIFICACION_GESTIONADA_MANUALMENTE':
      return { ...base, titulo: 'Notificación gestionada manualmente', detalle: nota, tono: 'VERDE' };

    case 'NOTIFICACION_CORREO_ENVIADA':
      return { ...base, titulo: 'Correo enviado al ciudadano', detalle: nota, tono: 'GRIS' };

    case 'CONSTANCIA_ENVIADA_CORREO':
      return { ...base, titulo: 'Constancia enviada por correo', detalle: nota, tono: 'GRIS' };

    case 'NOTIFICACION_OMITIDA_DUPLICADA':
      return { ...base, titulo: 'Aviso omitido: ya se había enviado', detalle: nota, tono: 'GRIS' };

    default: {
      // Código desconocido: legible en vez de SCREAMING_SNAKE.
      const palabras = String(e.accion).toLowerCase().replace(/_/g, ' ');
      return {
        ...base,
        titulo: palabras.charAt(0).toUpperCase() + palabras.slice(1),
        detalle: nota,
        tono: 'GRIS',
      };
    }
  }
}

function etiquetaDia(ymd: string, ahora: Date): string {
  const hoy = fechaYmdColombia(ahora);
  const ayer = fechaYmdColombia(new Date(ahora.getTime() - 24 * 60 * 60 * 1000));
  const fecha = new Date(`${ymd}T12:00:00Z`);
  const diaMes = fecha.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', day: 'numeric', month: 'long',
  });
  if (ymd === hoy)  return `Hoy · ${diaMes}`;
  if (ymd === ayer) return `Ayer · ${diaMes}`;
  const semana = fecha.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', weekday: 'long',
  });
  const etiqueta = `${semana} ${diaMes}`;
  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
}

/**
 * Historia lista para pintar: humanizada, con correos plegados en su
 * actuación causante, filtrada y agrupada por día (reciente primero).
 */
export function construirHistoria(
  eventos: TrazabilidadRadicado[],
  ahora: Date = new Date(),
  filtro: FiltroHistoria = 'TODO',
): DiaHistoria[] {
  const ordenados = [...eventos].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );

  const humanos: EventoHumano[] = ordenados.map((e) => ({ ...humanizar(e), correos: [] }));

  // Plegado: cada correo busca la actuación más cercana en el tiempo
  // (dentro de la ventana) y se vuelve una línea dentro de ella.
  const visibles: EventoHumano[] = [];
  const acciones = ordenados.map((e) => e.accion);
  for (let i = 0; i < humanos.length; i++) {
    const evento = humanos[i];
    if (!evento.esCorreo) {
      visibles.push(evento);
      continue;
    }
    const t = new Date(evento.fecha).getTime();
    let padre: EventoHumano | null = null;
    let mejorDiff = VENTANA_PLEGADO_MS + 1;
    for (let j = 0; j < humanos.length; j++) {
      if (humanos[j].esCorreo) continue;
      const diff = Math.abs(new Date(humanos[j].fecha).getTime() - t);
      if (diff <= VENTANA_PLEGADO_MS && diff < mejorDiff) {
        mejorDiff = diff;
        padre = humanos[j];
      }
    }
    if (padre) {
      padre.correos.push({ texto: TEXTO_CORREO[acciones[i]] ?? evento.titulo });
    } else {
      visibles.push(evento); // correo huérfano: se muestra tal cual
    }
  }

  const filtrados = visibles.filter((e) => {
    if (filtro === 'ACTUACIONES') return !e.esCorreo;
    if (filtro === 'CORREOS') {
      return e.esCorreo || e.correos.length > 0
        || e.titulo === 'El correo al ciudadano falló';
    }
    return true;
  });

  const dias: DiaHistoria[] = [];
  for (const evento of filtrados) {
    const ymd = fechaYmdColombia(evento.fecha);
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.ymd === ymd) {
      ultimo.eventos.push(evento);
    } else {
      dias.push({ ymd, etiqueta: etiquetaDia(ymd, ahora), eventos: [evento] });
    }
  }
  return dias;
}
