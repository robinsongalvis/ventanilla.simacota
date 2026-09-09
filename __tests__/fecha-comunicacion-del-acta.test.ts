import { describe, expect, it } from 'vitest';
import {
  esErrorExpediente,
  fechaComunicacionDelActa,
  planRegistrarActuacion,
  type ActuacionLicenciaDoc,
} from '@/lib/server/expedientes-licencias';

/* ══════════════════════════════════════════════════════════════
   CUÁNDO SE COMUNICÓ EL ACTA — custodio del issue #327 (3-sep-2026).

   EL DEFECTO QUE LO OBLIGA. El formulario pedía la fecha en que el acta se
   comunicó al ciudadano, la funcionaria la escribía, la ruta la leía… y NADIE
   LA GUARDABA: solo servía para imprimir una fecha en el correo. Como el guard
   del archivo por desistimiento tácito lee ese campo, SIEMPRE recibía
   `undefined` y SIEMPRE bloqueaba — el archivo era inalcanzable.

   Y no fallaba al registrar el acta, que es lo que lo hacía peligroso: fallaba
   MESES DESPUÉS, cuando el ciudadano no había respondido y ya no quedaba forma
   de aportar el dato que ella sí había escrito el primer día.

   POR QUÉ NINGÚN CUSTODIO LO VIO. Cada tramo estaba probado por su lado — el
   formulario pedía bien, el correo calculaba bien, el guard bloqueaba bien —
   y NADIE recorría el camino entero. Este custodio va de punta a punta:
   registrar el acta CON fecha → comprobar que quedó guardada → archivar.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA: que la fecha declarada se
   PERSISTA en la actuación, que el resolutor único la prefiera sobre el correo,
   que sin ninguna de las dos no invente un hecho, y que el archivo por
   desistimiento pase a ser alcanzable. NO mira: el cómputo de los 30 días
   hábiles (custodiado en `reloj-subsanacion`), ni el envío del correo.
══════════════════════════════════════════════════════════════ */

const ACTOR = { uid: 'u1', nombre: 'Funcionaria de Planeación', rol: 'FUNCIONARIO' as const };
const AHORA = new Date('2026-09-03T17:00:00.000Z');

const act = (over: Partial<ActuacionLicenciaDoc>): ActuacionLicenciaDoc => ({
  id: 'a1', expedienteId: 'e1', tenantId: 'SEC_PLANEACION',
  tipo: 'radicacion-debida-forma', etapa: 'radicacion',
  actorUid: 'u1', actorNombre: 'Funcionaria', actorRol: 'FUNCIONARIO',
  fecha: '2026-09-01T17:00:00.000Z', origen: 'REAL', detalle: 'Radicación en legal y debida forma.',
  ...over,
} as ActuacionLicenciaDoc);

describe('la fecha declarada en el acta SE GUARDA', () => {
  it('el plan la persiste en la actuación — el eslabón que se rompía', () => {
    const plan = planRegistrarActuacion(
      'EN_REVISION',
      [act({})],
      'e1',
      'SEC_PLANEACION',
      {
        tipo: 'acta-observaciones',
        detalle: 'Se observan planos estructurales incompletos y falta la cesión de andén.',
        fechaComunicacion: '2026-09-03T12:00:00.000Z',
      },
      ACTOR,
      AHORA,
    );
    expect(esErrorExpediente(plan)).toBe(false);
    if (esErrorExpediente(plan)) return;
    expect(
      plan.actuacion.fechaComunicacion,
      'la fecha que la funcionaria escribió se perdió otra vez — sin ella el archivo por desistimiento es inalcanzable',
    ).toBe('2026-09-03T12:00:00.000Z');
  });

  it('sin declararla, la ausencia se guarda como ausencia — no se inventa una fecha', () => {
    /* Sin comunicación probada NO corre plazo contra el ciudadano. Rellenar
       este campo con «hoy» le quitaría días que nadie le notificó. */
    const plan = planRegistrarActuacion(
      'EN_REVISION',
      [act({})],
      'e1',
      'SEC_PLANEACION',
      { tipo: 'acta-observaciones', detalle: 'Se observan planos estructurales incompletos.' },
      ACTOR,
      AHORA,
    );
    if (esErrorExpediente(plan)) throw new Error('el plan debía proceder');
    expect(plan.actuacion.fechaComunicacion).toBeUndefined();
  });
});

describe('fechaComunicacionDelActa — una sola respuesta para las dos superficies', () => {
  const acta = act({
    id: 'acta', tipo: 'acta-observaciones', etapa: 'revision',
    fecha: '2026-09-02T17:00:00.000Z', detalle: 'Observaciones formuladas.',
  });
  const correo = act({
    id: 'correo', tipo: 'comunicacion-enviada', etapa: 'revision',
    fecha: '2026-09-04T17:00:00.000Z',
    /* El prefijo REAL con el que el sistema marca el aviso del acta
       (`PREFIJO_AVISO_ACTA_COMUNICACION`), no uno inventado: si el fixture no
       lo lleva, `esComunicacionDelActa` no lo reconoce y la prueba pasaría
       verde por el motivo equivocado. */
    tipoComunicacion: 'Aviso de acta de observaciones',
    detalle: 'Aviso de acta de observaciones enviado al ciudadano.',
  } as Partial<ActuacionLicenciaDoc>);

  it('manda lo DECLARADO por la funcionaria, aunque haya correo posterior', () => {
    /* La comunicación pudo ser personal o por edicto — canales que el sistema
       no ve y que la norma admite igual. */
    const r = fechaComunicacionDelActa([
      { ...acta, fechaComunicacion: '2026-09-02T20:00:00.000Z' },
      correo,
    ]);
    expect(r?.fecha).toBe('2026-09-02T20:00:00.000Z');
    expect(r?.base).toBe('DECLARADA_EN_EL_ACTA');
  });

  it('sin declaración, vale el correo que el sistema SÍ envió', () => {
    const r = fechaComunicacionDelActa([acta, correo]);
    expect(r?.fecha).toBe('2026-09-04T17:00:00.000Z');
    expect(r?.base).toBe('CORREO_ENVIADO');
  });

  it('sin declaración y sin correo, NO hay hecho — y se dice, no se inventa', () => {
    /* Es la diferencia entre «no consta» y «fue hoy». Inventarlo haría correr
       un plazo contra alguien a quien nadie notificó. */
    expect(fechaComunicacionDelActa([acta])).toBeNull();
  });

  it('sin acta no hay nada que resolver', () => {
    expect(fechaComunicacionDelActa([act({})])).toBeNull();
  });
});

describe('el archivo por desistimiento tácito vuelve a ser alcanzable', () => {
  const base = [
    act({}),
    act({
      id: 'acta', tipo: 'acta-observaciones', etapa: 'revision',
      fecha: '2026-06-01T17:00:00.000Z', detalle: 'Observaciones formuladas al proyecto.',
      fechaComunicacion: '2026-06-02T17:00:00.000Z',
    } as Partial<ActuacionLicenciaDoc>),
  ];

  it('con la fecha guardada y los 30 días hábiles vencidos, el archivo PROCEDE', () => {
    /* El camino completo, que es lo que nadie recorría: acta con fecha →
       transcurren los días → archivar. Antes esto SIEMPRE devolvía «no consta
       la fecha en que el acta se comunicó». */
    const plan = planRegistrarActuacion(
      'CON_ACTA_DE_OBSERVACIONES',
      base,
      'e1',
      'SEC_PLANEACION',
      { tipo: 'desistimiento-tacito', detalle: 'Se archiva por desistimiento tácito: no hubo respuesta.' },
      ACTOR,
      new Date('2026-09-03T17:00:00.000Z'),
    );
    if (esErrorExpediente(plan)) {
      expect.fail(`el archivo debía proceder y fue rechazado: «${plan.mensaje}»`);
    }
    expect(plan.actuacion.tipo).toBe('desistimiento-tacito');
  });

  it('SIN la fecha, sigue bloqueado — y ese bloqueo es correcto', () => {
    /* La otra mitad: el arreglo no puede convertirse en «archivar siempre».
       Sin comunicación probada, archivar sería cerrarle el trámite a alguien
       que nunca supo que debía responder. */
    const sinFecha = base.map((a) => (a.tipo === 'acta-observaciones' ? { ...a, fechaComunicacion: undefined } : a));
    const plan = planRegistrarActuacion(
      'CON_ACTA_DE_OBSERVACIONES',
      sinFecha,
      'e1',
      'SEC_PLANEACION',
      { tipo: 'desistimiento-tacito', detalle: 'Se archiva por desistimiento tácito: no hubo respuesta.' },
      ACTOR,
      new Date('2026-09-03T17:00:00.000Z'),
    );
    expect(esErrorExpediente(plan)).toBe(true);
    if (!esErrorExpediente(plan)) return;
    expect(plan.mensaje).toMatch(/no consta la fecha/i);
  });
});
