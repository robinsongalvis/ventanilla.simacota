import { describe, expect, it } from 'vitest';
import {
  esErrorExpediente,
  ESTADO_DESTINO_POR_TIPO_ACTUACION,
  planRegistrarActuacion,
  type ActuacionLicenciaDoc,
} from '@/lib/server/expedientes-licencias';
import { ACCIONES_POR_DESTINO } from '@/app/interno/licencias/que-sigue';

/* ══════════════════════════════════════════════════════════════
   LA CADENA DE CIERRE ES ALCANZABLE — custodio del issue #328 (3-sep-2026).

   EL DEFECTO. Había DOS listas de «qué actuaciones admite el sistema»: el mapa
   `ESTADO_DESTINO_POR_TIPO_ACTUACION` con diez tipos, y un predicado escrito a
   mano con cuatro. Las seis que faltaban —conceder, negar, desistir (expreso y
   tácito), notificar y declarar en firme— se RECHAZABAN.

   Un expediente llegaba a `EN_VIABILIDAD` y ahí se quedaba PARA SIEMPRE: sin
   poder resolverse ni archivarse, y sin constancia de ejecutoria posible. Es
   justo el recorrido que el propietario iba a ensayar.

   Y lo agravaban tres cosas: la pantalla OFRECÍA esas acciones como
   principales; el mensaje de error las ENUMERABA como admitidas (salía del
   mapa, no del predicado); y todas sus validaciones estaban escritas DETRÁS de
   la puerta que las rechazaba — código muerto que nunca había corrido.

   POR QUÉ NADIE LO VIO: cada tramo estaba probado por su lado. Ninguna prueba
   intentaba registrar una actuación de cierre y comprobar que procede.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA: que TODO tipo del mapa
   pase el filtro, que las acciones que la pantalla ofrece existan de verdad, y
   que el ciclo completo se pueda recorrer de punta a punta. NO mira las
   validaciones de EVIDENCIA de cada acto (resolución, notificación, firmeza
   tienen las suyas) ni las transiciones de estado (mapa de estados).
══════════════════════════════════════════════════════════════ */

const ACTOR = { uid: 'u1', nombre: 'Funcionaria de Planeación', rol: 'FUNCIONARIO' as const };
const AHORA = new Date('2026-09-03T17:00:00.000Z');
const DETALLE = 'Detalle suficientemente largo para pasar el mínimo exigido.';

const act = (over: Partial<ActuacionLicenciaDoc>): ActuacionLicenciaDoc => ({
  id: 'a1', expedienteId: 'e1', tenantId: 'SEC_PLANEACION',
  tipo: 'radicacion-debida-forma', etapa: 'radicacion',
  actorUid: 'u1', actorNombre: 'F', actorRol: 'FUNCIONARIO',
  fecha: '2026-06-01T17:00:00.000Z', origen: 'REAL', detalle: 'Radicación.',
  ...over,
} as ActuacionLicenciaDoc);

/** ¿El plan rechazó por TIPO NO PERMITIDO? Es el defecto exacto del #328. */
function rechazadoPorTipo(estado: string, tipo: string): boolean {
  const plan = planRegistrarActuacion(
    estado as never, [act({})], 'e1', 'SEC_PLANEACION',
    { tipo, detalle: DETALLE }, ACTOR, AHORA,
  );
  return esErrorExpediente(plan) && /Tipo de actuación no permitido/i.test(plan.mensaje);
}

describe('ningún tipo declarado en el mapa se rechaza por «no permitido»', () => {
  const TIPOS = Object.keys(ESTADO_DESTINO_POR_TIPO_ACTUACION);

  it('el mapa declara los diez tipos del ciclo', () => {
    /* Si esto baja, alguien retiró un tipo: que lo haga a propósito y
       actualice esta prueba con su fundamento (ADR-0039 §3). */
    expect(TIPOS.length).toBe(10);
  });

  it.each(TIPOS.map((t) => [t]))('«%s» no se rechaza por tipo no permitido', (tipo) => {
    /* Se prueba desde un estado cualquiera: lo que se asevera NO es que la
       transición proceda —eso es del mapa de estados y tiene sus pruebas—
       sino que el tipo PASE EL FILTRO. Rechazar por transición inválida es
       correcto; rechazar por «no permitido» un tipo que el mapa declara es el
       defecto. */
    expect(
      rechazadoPorTipo('EN_VIABILIDAD', tipo),
      `«${tipo}» está declarado en ESTADO_DESTINO_POR_TIPO_ACTUACION pero el filtro lo rechaza — `
      + 'las dos listas volvieron a separarse (issue #328)',
    ).toBe(false);
  });
});

describe('lo que la pantalla ofrece, el servidor lo admite', () => {
  /* La familia «pintado y nunca construido», esta vez entre la UI y el
     dominio: la funcionaria veía «Registrar resolución que concede» como
     acción PRINCIPAL y al pulsarla recibía «tipo no permitido». */
  const OFRECIDOS = [...new Set(
    Object.values(ACCIONES_POR_DESTINO).flat().map((a) => (a as { tipo: string }).tipo),
  )];

  it('el extractor encuentra acciones (si no, se rompió, no hay nada cubierto)', () => {
    expect(OFRECIDOS.length).toBeGreaterThan(0);
  });

  it.each(OFRECIDOS.map((t) => [t]))('la pantalla ofrece «%s» y el servidor lo admite', (tipo) => {
    expect(
      rechazadoPorTipo('EN_VIABILIDAD', tipo),
      `La pantalla ofrece «${tipo}» y el servidor lo rechaza por tipo no permitido: ese botón da error `
      + 'a la funcionaria en cuanto lo pulse.',
    ).toBe(false);
  });
});
