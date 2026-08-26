import { describe, it, expect } from 'vitest';
import {
  evaluarRadicacionEnDebidaForma,
  planRadicarEnDebidaForma,
  esErrorExpediente,
  esRadicacionYaOcurrida,
  idActuacionRadicacion,
  type ActuacionLicenciaDoc,
  type ExpedienteLicenciaDoc,
  type DocumentoParaAncla,
} from '@/lib/server/expedientes-licencias';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';

/**
 * EL ACTO DE RADICAR — PRESENTADA → RADICADA_EN_DEBIDA_FORMA.
 *
 * Es el momento en que la Alcaldía AFIRMA que la solicitud llegó completa:
 * nace el número oficial y arranca el término de 45 días hábiles. Estas
 * pruebas cubren la parte PURA — qué debe ocurrir y qué debe rechazarse.
 * La atomicidad y la concurrencia se prueban contra el emulador.
 */

const TENANT = 'SEC_PLANEACION';
const AHORA = new Date('2026-08-26T17:00:00.000Z');

/** Un expediente completo: todos los requisitos aplicables con documento. */
function expedienteCompleto(over: Partial<ExpedienteLicenciaDoc> = {}): ExpedienteLicenciaDoc {
  const aportes = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.requisitos.map((r, i) => ({
    requisitoId: r.id,
    estado: 'APORTADO' as const,
    documentoIds: [`doc-${i}`],
  }));
  return {
    id: 'exp-1',
    tenantId: TENANT,
    tramiteId: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id,
    estado: 'EN_REVISION',
    estadoJuridico: 'PRESENTADA',
    solicitanteNombre: 'María Fernanda Ríos',
    solicitanteDocumento: '1098765432',
    /* El contexto decide QUÉ requisitos aplican. Sin él, los condicionales
       quedan indeterminados y la completitud no puede afirmarse — que es
       justamente uno de los casos que se prueban más abajo. */
    contexto: {
      esApoderado: false,
      predioRodeadoEspacioPublico: false,
      categoriaComplejidad: 'BAJA',
      sujetoTituloENSR10: true,
    },
    aportes,
    radicadoId: null,
    creadoEn: '2026-07-01T12:00:00.000Z',
    actualizadoEn: '2026-08-20T12:00:00.000Z',
    origen: 'REAL',
    esPrueba: false,
    completitud: {
      completo: true,
      faltantes: [],
      aplicables: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.requisitos.length,
      evaluadoEn: '2026-08-20T12:00:00.000Z',
      completoDesde: '2026-08-20T12:00:00.000Z',
    },
    ...over,
  } as ExpedienteLicenciaDoc;
}

function documentos(fecha = '2026-08-14T15:00:00.000Z'): DocumentoParaAncla[] {
  return DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.requisitos.map((r, i) => ({
    id: `doc-${i}`,
    requisitoId: r.id,
    creadoEn: fecha,
    versionVigente: { hashSha256: `hash-${i}` },
  }));
}

function evaluar(exp: ExpedienteLicenciaDoc, extra: Partial<Parameters<typeof evaluarRadicacionEnDebidaForma>[0]> = {}) {
  return evaluarRadicacionEnDebidaForma({
    expediente: exp,
    actuacionesPrevias: [],
    documentos: documentos(),
    tenantEsperado: TENANT,
    ahora: AHORA,
    ...extra,
  });
}

describe('el acto de radicar — lo que RECHAZA', () => {
  it('un expediente de otra dependencia no se ve siquiera: 404, no 403', () => {
    const r = evaluar(expedienteCompleto({ tenantId: 'SEC_HACIENDA' as never }));
    expect(esErrorExpediente(r) && r.status).toBe(404);
  });

  /* `canOperateTenant` deja pasar a ADMIN y RECEPCIONISTA contra CUALQUIER
     dependencia. Sin este guard, un rol transversal podría declarar en debida
     forma un expediente que no es de su escritorio. */
  it('el guard de tenant es del expediente, no del rol', () => {
    const r = evaluar(expedienteCompleto(), { tenantEsperado: 'SEC_HACIENDA' as never });
    expect(esErrorExpediente(r) && r.status).toBe(404);
  });

  it('un histórico reconstruido no se radica: su radicación consta en papel', () => {
    const r = evaluar(expedienteCompleto({ origen: 'RECONSTRUIDO' }));
    expect(esErrorExpediente(r) && r.status).toBe(409);
    expect(esErrorExpediente(r) && r.mensaje).toMatch(/libro histórico/i);
  });

  it('un expediente de demostración no consume la serie legal', () => {
    const r = evaluar(expedienteCompleto({ esPrueba: true }));
    expect(esErrorExpediente(r) && r.status).toBe(422);
    expect(esErrorExpediente(r) && r.mensaje).toMatch(/demostración/i);
  });

  it('desde un estado que no es PRESENTADA, lo decide la máquina de estados', () => {
    const r = evaluar(expedienteCompleto({ estadoJuridico: 'EN_VIABILIDAD' }));
    expect(esErrorExpediente(r) && r.status).toBe(409);
    expect(esErrorExpediente(r) && r.mensaje).toMatch(/EN_VIABILIDAD/);
  });

  /* La completitud se RECALCULA, nunca se lee del campo guardado: el camino
     demo no lo escribe, y `completitud?.completo !== false` habría dejado
     pasar justo a los expedientes que nadie evaluó. */
  /* Dos causas, dos mensajes: «faltan documentos» y «faltan datos del caso»
     son problemas distintos y se resuelven de maneras distintas. */
  it('cuando falta el CONTEXTO, lo dice — no informa «faltan 0 requisitos»', () => {
    const r = evaluar(expedienteCompleto({ contexto: {} }));
    expect(esErrorExpediente(r) && r.status).toBe(409);
    expect(esErrorExpediente(r) && r.mensaje).toMatch(/faltan datos del caso/i);
    expect(esErrorExpediente(r) && r.mensaje).not.toMatch(/faltan 0/);
  });

  it('recalcula la completitud y no confía en el campo guardado', () => {
    const exp = expedienteCompleto({
      aportes: [],
      completitud: { completo: true, faltantes: [], aplicables: 19, evaluadoEn: AHORA.toISOString() },
    });
    const r = evaluar(exp, { documentos: [] });
    expect(esErrorExpediente(r) && r.status).toBe(409);
    expect(esErrorExpediente(r) && r.mensaje).toMatch(/todavía no está completa/i);
  });

  it('enumera lo que falta, para que la funcionaria pueda decirlo', () => {
    const exp = expedienteCompleto();
    exp.aportes = exp.aportes!.slice(0, 3);
    const r = evaluar(exp, { documentos: documentos().slice(0, 3) });
    expect(esErrorExpediente(r) && r.mensaje).toMatch(/faltan \d+ de \d+/);
  });
});

describe('el acto de radicar — el ancla del término', () => {
  it('ancla en el HECHO REGISTRADO cuando existe, no en la fecha del documento', () => {
    const r = evaluar(expedienteCompleto());
    expect(esErrorExpediente(r) || esRadicacionYaOcurrida(r)).toBe(false);
    if (esErrorExpediente(r) || esRadicacionYaOcurrida(r)) return;
    expect(r.baseDelAncla).toBe('MOMENTO_REGISTRADO_DE_COMPLETITUD');
    expect(r.anclaDiaCivil).toBe('2026-08-20');
  });

  it('sin el hecho registrado, deduce del último documento y LO DECLARA', () => {
    const exp = expedienteCompleto();
    delete exp.completitud!.completoDesde;
    const r = evaluar(exp);
    if (esErrorExpediente(r) || esRadicacionYaOcurrida(r)) throw new Error('debía proceder');
    expect(r.baseDelAncla).toBe('PRIMERA_VERSION_DEL_ULTIMO_DOCUMENTO');
    expect(r.anclaDiaCivil).toBe('2026-08-14');
  });

  /* Si la fecha es DEDUCIDA y el término nacería vencido, radicar equivaldría
     a reconocer de oficio un silencio administrativo positivo. */
  it('se detiene si una fecha deducida haría nacer el término ya vencido', () => {
    const exp = expedienteCompleto();
    delete exp.completitud!.completoDesde;
    const r = evaluar(exp, { documentos: documentos('2025-01-10T15:00:00.000Z') });
    expect(esErrorExpediente(r) && r.status).toBe(409);
    expect(esErrorExpediente(r) && r.mensaje).toMatch(/silencio administrativo/i);
  });

  it('con el hecho REGISTRADO, un término vencido no bloquea: es un hecho verdadero', () => {
    const exp = expedienteCompleto();
    exp.completitud!.completoDesde = '2025-01-10T12:00:00.000Z';
    const r = evaluar(exp);
    expect(esErrorExpediente(r)).toBe(false);
  });

  it('sin documentos con fecha, se rechaza en vez de caer hacia «ahora»', () => {
    const exp = expedienteCompleto();
    delete exp.completitud!.completoDesde;
    const r = evaluar(exp, { documentos: [] });
    expect(esErrorExpediente(r) && r.mensaje).toMatch(/no se puede determinar/i);
  });
});

describe('el acto de radicar — el control optimista', () => {
  it('acepta cuando el día civil coincide con el que vio la funcionaria', () => {
    const r = evaluar(expedienteCompleto(), { anclaEsperada: '2026-08-20' });
    expect(esErrorExpediente(r)).toBe(false);
  });

  it('rechaza si la evidencia cambió mientras revisaba, y lo dice con las dos fechas', () => {
    const r = evaluar(expedienteCompleto(), { anclaEsperada: '2026-08-11' });
    expect(esErrorExpediente(r) && r.status).toBe(409);
    expect(esErrorExpediente(r) && r.mensaje).toMatch(/2026-08-11/);
    expect(esErrorExpediente(r) && r.mensaje).toMatch(/2026-08-20/);
  });
});

describe('el acto de radicar — idempotencia por el dominio', () => {
  it('un expediente ya radicado devuelve lo escrito, no un error', () => {
    const yaRadicado = expedienteCompleto({
      estadoJuridico: 'RADICADA_EN_DEBIDA_FORMA',
      numeroExpediente: { numero: '68745-0-26-0007', serieId: 'expedientes', año: 2026 },
    });
    const previa: ActuacionLicenciaDoc = {
      id: idActuacionRadicacion('exp-1'), expedienteId: 'exp-1', tenantId: TENANT,
      tipo: 'radicacion-debida-forma', etapa: 'radicacion',
      actorUid: 'u1', actorNombre: 'Funcionaria', actorRol: 'FUNCIONARIO',
      fecha: '2026-08-20T17:00:00.000Z', origen: 'REAL',
    };
    const r = evaluar(yaRadicado, { actuacionesPrevias: [previa] });
    expect(esRadicacionYaOcurrida(r)).toBe(true);
    if (!esRadicacionYaOcurrida(r)) return;
    expect(r.numeroExpediente).toBe('68745-0-26-0007');
    expect(r.anclaIso).toBe('2026-08-20T17:00:00.000Z');
  });

  it('el id de la actuación es determinista: el segundo intento choca, no duplica', () => {
    expect(idActuacionRadicacion('exp-1')).toBe('exp-1-radicacion');
    expect(idActuacionRadicacion('exp-1')).toBe(idActuacionRadicacion('exp-1'));
  });
});

describe('el acto de radicar — lo que se escribe', () => {
  function planDe(exp = expedienteCompleto()) {
    const ev = evaluar(exp);
    if (esErrorExpediente(ev) || esRadicacionYaOcurrida(ev)) throw new Error('debía proceder');
    return planRadicarEnDebidaForma({
      expedienteId: 'exp-1', tenantId: TENANT, evaluacion: ev,
      numeroEmitido: '68745-0-26-0008', anioSerie: 2026,
      actuacionesPrevias: [], actor: { uid: 'u1', nombre: 'Funcionaria', rol: 'FUNCIONARIO' },
      ahora: AHORA,
    });
  }

  /* El slug es un lookup literal: cualquier variante se descarta EN SILENCIO
     y el término nunca arranca. */
  it('la actuación usa EXACTAMENTE el slug que el motor del término reconoce', () => {
    expect(planDe().actuacion.tipo).toBe('radicacion-debida-forma');
  });

  it('la fecha de la actuación es la JURÍDICA, no el instante del botón', () => {
    const plan = planDe();
    expect(plan.actuacion.fecha).toMatch(/^2026-08-20/);
    expect(plan.actuacion.fecha).not.toBe(AHORA.toISOString());
  });

  it('origen REAL: R9 excluye lo reconstruido antes incluso de mirar el slug', () => {
    expect(planDe().actuacion.origen).toBe('REAL');
  });

  it('el término queda anclado: el espejo deja de ser nulo', () => {
    expect(planDe().parcheExpediente.fechaAlertaConservadora).not.toBeNull();
  });

  it('la fecha jurídica también va al RAÍZ, para que el Libro no muestre otra', () => {
    const plan = planDe();
    expect(plan.parcheExpediente.fechaRadicacionDebidaForma).toBe(plan.actuacion.fecha);
  });

  it('el número va con la grafía del modelo (`año`), no con una inventada', () => {
    const n = planDe().parcheExpediente.numeroExpediente as unknown as Record<string, unknown>;
    expect(n.año).toBe(2026);
    expect(n).not.toHaveProperty('anio');
  });

  it('la evidencia queda EN la actuación, que es append-only, con su hash y su base', () => {
    const ev = planDe().actuacion.evidenciaRadicacion!;
    expect(ev.requisitosFaltantes).toBe(0);
    expect(ev.baseDelAncla).toBe('MOMENTO_REGISTRADO_DE_COMPLETITUD');
    expect(ev.hashSha256).toMatch(/^hash-/);
    expect(ev.numeroExpediente).toBe('68745-0-26-0008');
  });

  it('el estado OPERATIVO no se toca: son dos ejes distintos', () => {
    expect(planDe().parcheExpediente).not.toHaveProperty('estado');
  });
});
