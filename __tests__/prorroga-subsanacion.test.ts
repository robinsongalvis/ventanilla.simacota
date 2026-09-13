import { describe, expect, it } from 'vitest';
import {
  calcularPlazoSubsanacion,
  prorrogaLlegaATiempo,
  DIAS_HABILES_SUBSANACION_BASE,
  DIAS_HABILES_PRORROGA_SUBSANACION,
  SLUG_PRORROGA_SUBSANACION,
} from '@/lib/motor-expedientes/plazo-subsanacion';
import { procedeDesistimientoTacito } from '@/lib/motor-expedientes/cierre-licencia';
import {
  evaluarPlazoSubsanacion,
  planRegistrarActuacion,
  planRegistrarProrrogaSubsanacion,
  esErrorExpediente,
  type ActuacionLicenciaDoc,
  type ExpedienteLicenciaDoc,
} from '@/lib/server/expedientes-licencias';
import { derivarEventosTermino } from '@/lib/motor-expedientes/termino';
import { sumarDiasHabiles } from '@/lib/tiempos-radicado';

/* ══════════════════════════════════════════════════════════════
   LA PRÓRROGA DE QUINCE DÍAS — UN SOLO PLAZO, UN SOLO CÁLCULO.

   EL DEFECTO. El mismo plazo legal se calculaba en dos sitios con reglas
   distintas: `procedeDesistimientoTacito` sabía de la prórroga (30 o 45) y
   `evaluarPlazoSubsanacion` no (30 siempre). Coincidían por accidente, porque
   el único llamador del guard nunca pasaba el dato: la maquinaria de los quince
   días estaba completa, probada y SIN UN SOLO LLAMADOR.

   El momento peligroso era justo cablearla en un solo lado. La pantalla habría
   dicho «el plazo venció, archive» y el servidor lo habría negado durante
   quince días hábiles seguidos.

   ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────

   Esto MIRA: que pantalla y guard den el MISMO plazo sobre los mismos hechos;
   el recorrido real 30 → solicitud válida → 45 → vencimiento → desistimiento;
   que una prórroga ausente, inválida o tardía NO amplíe nada; y que nada de
   esto toque el término de la Administración.

   Esto NO MIRA: el efecto de la respuesta del ciudadano sobre el término de 45
   días, la renuncia expresa al plazo restante, ni el descuento
   expedición→comunicación del acta. Los tres siguen ⚖️ BLOQUEADOS a la espera
   del concepto escrito de Jurídica (hueco 1, ADR-0029) y este cambio no los
   toca a propósito: A corrige cableado, B cambia cómputo jurídico.
══════════════════════════════════════════════════════════════ */

const COMUNICADA = '2026-06-01T12:00:00.000Z';
const alDia = (n: number) => sumarDiasHabiles(COMUNICADA, n);
const ACTOR = { uid: 'u-1', nombre: 'Funcionaria de Planeación', rol: 'FUNCIONARIO' };

const actuacion = (tipo: string, fecha: string, extra: Partial<ActuacionLicenciaDoc> = {}): ActuacionLicenciaDoc => ({
  id: `a-${tipo}-${fecha}`,
  expedienteId: 'exp-1',
  tenantId: 'SEC_PLANEACION',
  tipo,
  etapa: 'revision',
  actorUid: ACTOR.uid,
  actorNombre: ACTOR.nombre,
  actorRol: ACTOR.rol,
  fecha,
  origen: 'REAL',
  ...extra,
} as ActuacionLicenciaDoc);

/** Acta + su aviso comunicado: el mínimo para que corra el plazo del ciudadano. */
function actaComunicada(): ActuacionLicenciaDoc[] {
  return [
    actuacion('acta-observaciones', COMUNICADA, { fechaComunicacion: COMUNICADA }),
  ];
}

const laProrroga = (solicitadaEl: string, registradaEl = solicitadaEl) =>
  actuacion(SLUG_PRORROGA_SUBSANACION, registradaEl, {
    evidenciaProrroga: { solicitadaEl, medio: 'Escrito radicado' },
  });

describe('el recorrido real: 30 → solicitud válida → 45 → vencimiento → desistimiento', () => {
  it('sin prórroga el plazo son 30 días hábiles', () => {
    const plazo = calcularPlazoSubsanacion({ comunicadaEl: COMUNICADA, prorroga: null }, alDia(1));
    expect(plazo!.diasHabiles).toBe(DIAS_HABILES_SUBSANACION_BASE);
    expect(plazo!.conProrroga).toBe(false);
  });

  it('con solicitud dentro del plazo, pasa a 45', () => {
    const plazo = calcularPlazoSubsanacion(
      { comunicadaEl: COMUNICADA, prorroga: { solicitadaEl: alDia(25).toISOString() } },
      alDia(26),
    );
    expect(plazo!.diasHabiles).toBe(DIAS_HABILES_SUBSANACION_BASE + DIAS_HABILES_PRORROGA_SUBSANACION);
    expect(plazo!.conProrroga).toBe(true);
    expect(plazo!.vencido).toBe(false);
  });

  it('en el día 31 —vencido sin prórroga— CON prórroga sigue en plazo', () => {
    /* El día exacto en que las dos reglas se separan: sin el dato ya se puede
       archivar; con él quedan catorce días hábiles del ciudadano. */
    const hechos = { comunicadaEl: COMUNICADA, prorroga: { solicitadaEl: alDia(20).toISOString() } };
    expect(calcularPlazoSubsanacion({ ...hechos, prorroga: null }, alDia(31))!.vencido).toBe(true);
    expect(calcularPlazoSubsanacion(hechos, alDia(31))!.vencido).toBe(false);
  });

  it('a los 46 vence también con prórroga', () => {
    const plazo = calcularPlazoSubsanacion(
      { comunicadaEl: COMUNICADA, prorroga: { solicitadaEl: alDia(20).toISOString() } },
      alDia(46),
    );
    expect(plazo!.vencido).toBe(true);
  });

  it('y entonces —y solo entonces— el guard deja archivar', () => {
    const conProrroga = { solicitadaEl: alDia(20).toISOString() };
    expect(
      procedeDesistimientoTacito({ fechaComunicacionActa: COMUNICADA, huboRespuestaSubsanacion: false, ahora: alDia(30), prorroga: conProrroga }),
      'archivó a los 30 con la prórroga corriendo',
    ).not.toBeNull();
    expect(
      procedeDesistimientoTacito({ fechaComunicacionActa: COMUNICADA, huboRespuestaSubsanacion: false, ahora: alDia(45), prorroga: conProrroga }),
    ).toBeNull();
  });

  it('sin comunicación del acta no hay plazo que contar', () => {
    expect(calcularPlazoSubsanacion({ comunicadaEl: null, prorroga: null }, alDia(50))).toBeNull();
  });
});

describe('pantalla y guard dan el MISMO plazo sobre los mismos hechos', () => {
  /* La razón de ser del cambio. Antes `evaluarPlazoSubsanacion` contaba 30
     siempre y el guard 30 o 45: cablear los quince días en un solo lado habría
     hecho que la pantalla pidiera archivar quince días hábiles antes de que el
     servidor lo permitiera. */
  for (const dia of [29, 31, 44, 46]) {
    it(`en el día ${dia}, las dos coinciden en si el plazo venció`, () => {
      const actuaciones = [...actaComunicada(), laProrroga(alDia(20).toISOString())];
      const ahora = alDia(dia);

      const pantalla = evaluarPlazoSubsanacion(actuaciones, ahora);
      const guardBloquea = procedeDesistimientoTacito({
        fechaComunicacionActa: COMUNICADA,
        huboRespuestaSubsanacion: false,
        ahora,
        prorroga: { solicitadaEl: alDia(20).toISOString() },
      }) !== null;

      /* La pantalla dice POR_ARCHIVAR ⇔ el guard deja archivar. La frontera del
         día exacto se mantiene como estaba (ver `cierre-licencia.ts`), así que
         se comparan días que no la tocan. */
      expect(pantalla.resultado === 'POR_ARCHIVAR').toBe(!guardBloquea);
    });
  }

  it('la pantalla dice el plazo aplicable y que hay prórroga', () => {
    const evaluacion = evaluarPlazoSubsanacion(
      [...actaComunicada(), laProrroga(alDia(10).toISOString())],
      alDia(35),
    );
    expect(evaluacion.diasHabilesPlazo).toBe(45);
    expect(evaluacion.conProrroga).toBe(true);
    expect(evaluacion.resultado).toBe('EN_PLAZO');
  });
});

describe('PRUEBA NEGATIVA: una prórroga inexistente o inválida no altera nada', () => {
  it('la AUSENCIA del dato no es una prórroga — «a solicitud de parte» no se presume', () => {
    const evaluacion = evaluarPlazoSubsanacion(actaComunicada(), alDia(31));
    expect(evaluacion.diasHabilesPlazo).toBe(30);
    expect(evaluacion.conProrroga).toBe(false);
    expect(evaluacion.resultado).toBe('POR_ARCHIVAR');
  });

  it('una actuación de prórroga SIN evidencia se ignora', () => {
    /* Un documento a medias no amplía plazos: sin la fecha de la solicitud no
       se puede saber si llegó a tiempo. */
    const sinEvidencia = actuacion(SLUG_PRORROGA_SUBSANACION, alDia(10).toISOString());
    const evaluacion = evaluarPlazoSubsanacion([...actaComunicada(), sinEvidencia], alDia(31));
    expect(evaluacion.conProrroga).toBe(false);
    expect(evaluacion.resultado).toBe('POR_ARCHIVAR');
  });

  it('solicitada DESPUÉS de vencido el plazo no revive el término — y se dice', () => {
    const tardia = laProrroga(alDia(35).toISOString());
    const evaluacion = evaluarPlazoSubsanacion([...actaComunicada(), tardia], alDia(36));
    expect(evaluacion.diasHabilesPlazo).toBe(30);
    expect(evaluacion.conProrroga).toBe(false);
    expect(evaluacion.resultado).toBe('POR_ARCHIVAR');
    expect(
      evaluacion.prorrogaDescartada,
      'la prórroga se descartó en silencio: la funcionaria creería que el ciudadano tiene quince días que no tiene',
    ).toBe('SOLICITADA_FUERA_DE_PLAZO');
  });

  it('una prórroga de un acta ANTERIOR no amplía el plazo de la de ahora', () => {
    const actaVieja = actuacion('acta-observaciones', '2026-01-05T12:00:00.000Z', { fechaComunicacion: '2026-01-05T12:00:00.000Z' });
    const prorrogaVieja = laProrroga('2026-01-20T12:00:00.000Z');
    const evaluacion = evaluarPlazoSubsanacion([actaVieja, prorrogaVieja, ...actaComunicada()], alDia(31));
    expect(evaluacion.conProrroga).toBe(false);
    expect(evaluacion.resultado).toBe('POR_ARCHIVAR');
  });

  it('la frontera de oportunidad es UNA, compartida por la ruta y el cálculo', () => {
    expect(prorrogaLlegaATiempo(COMUNICADA, alDia(30))).toBe(true);
    expect(prorrogaLlegaATiempo(COMUNICADA, alDia(31))).toBe(false);
    expect(prorrogaLlegaATiempo(COMUNICADA, 'no es una fecha')).toBe(false);
  });
});

describe('registrar la prórroga: lo que el servidor NO acepta', () => {
  const expediente = (estadoJuridico: string) => ({
    id: 'exp-1', tenantId: 'SEC_PLANEACION', estadoJuridico,
  } as Pick<ExpedienteLicenciaDoc, 'id' | 'tenantId' | 'estadoJuridico'>);

  const registrar = (actuaciones: ActuacionLicenciaDoc[], solicitadaEl: string, ahora: Date, estado = 'CON_ACTA_DE_OBSERVACIONES') =>
    planRegistrarProrrogaSubsanacion(expediente(estado), actuaciones, { solicitadaEl, medio: 'Escrito radicado' }, ACTOR, ahora);

  it('acepta una solicitud dentro del plazo y guarda su evidencia', () => {
    const plan = registrar(actaComunicada(), alDia(20).toISOString(), alDia(22));
    expect(esErrorExpediente(plan)).toBe(false);
    if (esErrorExpediente(plan)) throw new Error('inalcanzable');
    expect(plan.actuacion.tipo).toBe(SLUG_PRORROGA_SUBSANACION);
    expect(plan.actuacion.evidenciaProrroga!.solicitadaEl).toBe(alDia(20).toISOString());
    expect(plan.actuacion.evidenciaProrroga!.medio).toBe('Escrito radicado');
    /* El expediente queda en el hecho, no en la interpretación. */
    expect(plan.actuacion.detalle).toMatch(/2\.2\.6\.1\.2\.2\.4/);
  });

  it('rechaza la solicitud presentada fuera del plazo', () => {
    const plan = registrar(actaComunicada(), alDia(31).toISOString(), alDia(32));
    expect(esErrorExpediente(plan)).toBe(true);
    if (!esErrorExpediente(plan)) throw new Error('inalcanzable');
    expect(plan.status).toBe(409);
    expect(plan.mensaje).toMatch(/después de vencido/i);
  });

  it('rechaza una segunda prórroga: la norma concede UN término adicional', () => {
    const plan = registrar([...actaComunicada(), laProrroga(alDia(10).toISOString())], alDia(20).toISOString(), alDia(21));
    expect(esErrorExpediente(plan) && plan.status).toBe(409);
  });

  it('rechaza si el ciudadano ya respondió: no hay plazo que ampliar', () => {
    const respondio = actuacion('respuesta-subsanacion', alDia(5).toISOString());
    const plan = registrar([...actaComunicada(), respondio], alDia(10).toISOString(), alDia(11));
    expect(esErrorExpediente(plan) && plan.status).toBe(409);
  });

  it('rechaza si el acta no consta comunicada: no se sabe si llega a tiempo', () => {
    const actaSinComunicar = actuacion('acta-observaciones', COMUNICADA);
    const plan = registrar([actaSinComunicar], alDia(10).toISOString(), alDia(11));
    expect(esErrorExpediente(plan) && plan.status).toBe(409);
  });

  it('rechaza en un estado que no tiene plazo de subsanación corriendo', () => {
    const plan = registrar(actaComunicada(), alDia(10).toISOString(), alDia(11), 'EN_REVISION');
    expect(esErrorExpediente(plan) && plan.status).toBe(409);
  });

  it('rechaza una fecha futura o anterior a la comunicación', () => {
    expect(esErrorExpediente(registrar(actaComunicada(), alDia(25).toISOString(), alDia(10)))).toBe(true);
    expect(esErrorExpediente(registrar(actaComunicada(), '2026-01-01T12:00:00.000Z', alDia(10)))).toBe(true);
  });
});

describe('la decisión de ARCHIVO consume el mismo cálculo — por su camino real', () => {
  /* No basta con que `procedeDesistimientoTacito` sepa de la prórroga: hasta hoy
     lo sabía, y su ÚNICO llamador no le pasaba el dato. Esto ejercita el camino
     por el que de verdad se archiva. */
  const archivar = (actuaciones: ActuacionLicenciaDoc[], ahora: Date) =>
    planRegistrarActuacion(
      'CON_ACTA_DE_OBSERVACIONES',
      actuaciones,
      'exp-1',
      'SEC_PLANEACION',
      { tipo: 'desistimiento-tacito', detalle: 'El ciudadano no respondió el acta dentro del plazo legal.' },
      ACTOR,
      ahora,
    );

  it('con la prórroga corriendo, el día 31 NO deja archivar', () => {
    const plan = archivar([...actaComunicada(), laProrroga(alDia(20).toISOString())], alDia(31));
    expect(esErrorExpediente(plan), 'archivó con la prórroga corriendo').toBe(true);
    if (!esErrorExpediente(plan)) throw new Error('inalcanzable');
    expect(plan.mensaje).toMatch(/45/);
  });

  it('sin prórroga, el día 31 sí deja archivar', () => {
    const plan = archivar(actaComunicada(), alDia(31));
    expect(esErrorExpediente(plan)).toBe(false);
  });

  it('y con la prórroga, a los 45 vuelve a proceder', () => {
    const plan = archivar([...actaComunicada(), laProrroga(alDia(20).toISOString())], alDia(45));
    expect(esErrorExpediente(plan)).toBe(false);
  });
});

describe('esto NO toca el término de la Administración', () => {
  it('la prórroga no produce ningún evento del término', () => {
    /* B queda fuera de este PR: el reloj de los 45 días hábiles no se mueve. Si
       este slug entrara en el vocabulario del motor, una prórroga del plazo del
       CIUDADANO empezaría a mover el plazo de la SECRETARÍA.

       Se comprueba EJECUTANDO la derivación, no leyendo el mapa: un mapa puede
       estar bien y la función leerlo por otro campo. */
    expect(derivarEventosTermino([laProrroga(alDia(10).toISOString())])).toEqual([]);
  });
});
