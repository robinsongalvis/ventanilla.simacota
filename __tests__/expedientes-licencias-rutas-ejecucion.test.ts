/**
 * Bloque "Integración UI y demo" — ejecución REAL de las rutas de
 * expedientes de licencias (mismo patrón que
 * `__tests__/subsanacion-rutas-ejecucion.test.ts`): mockea solo fronteras
 * (auth, firebase-admin, logger) e invoca los handlers reales; la lógica
 * de decisión (`lib/server/expedientes-licencias.ts`) corre de verdad.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let sesion: { uid: string; nombre: string; rol: string; tenantId: string };

/** Store en memoria: path completo → datos. */
let store: Map<string, Record<string, unknown>>;
/** Cada write (set/update/create) queda registrado aquí para aserciones. */
let escrituras: { path: string; tipo: 'set' | 'update'; data: Record<string, unknown> }[];

vi.mock('@/lib/server/internal-auth', () => ({
  InternalAuthError: class extends Error { status = 401; },
  requireActiveInternalUser: vi.fn(async () => sesion),
  canOperateTenant: (u: { rol: string; tenantId: string }, t: string) =>
    u.rol === 'ADMIN' || u.rol === 'RECEPCIONISTA' || (u.rol === 'FUNCIONARIO' && u.tenantId === t),
}));

function docRef(path: string) {
  return {
    path,
    get: async () => {
      const data = store.get(path);
      return { exists: data !== undefined, data: () => data };
    },
    collection: (sub: string) => collectionRef(`${path}/${sub}`),
  };
}

function collectionRef(basePath: string) {
  const docsBajoEsteBase = () =>
    [...store.entries()].filter(([p]) => p.startsWith(`${basePath}/`) && p.slice(basePath.length + 1).split('/').length === 1);

  const construir = (
    ordenarPor?: { campo: string; direccion: 'asc' | 'desc' },
    filtro?: { campo: string; valor: unknown },
    limite?: number,
  ) => ({
    doc: (id: string) => docRef(`${basePath}/${id}`),
    where: (campo: string, _op: string, valor: unknown) => construir(ordenarPor, { campo, valor }, limite),
    orderBy: (campo: string, direccion: 'asc' | 'desc' = 'asc') => construir({ campo, direccion }, filtro, limite),
    // Cota dura (R11) — el doble refleja el mismo recorte que Firestore real
    // aplicaría con `.limit(N)`, para que los tests de la bandeja puedan
    // verificar que la cota efectivamente recorta el lote leído.
    limit: (n: number) => construir(ordenarPor, filtro, n),
    get: async () => {
      let docs = docsBajoEsteBase().map(([p, data]) => ({ id: p.split('/').pop()!, data: () => data }));
      if (filtro) docs = docs.filter((d) => (d.data() as Record<string, unknown>)[filtro.campo] === filtro.valor);
      if (ordenarPor) {
        docs = docs.sort((a, b) => {
          const va = String((a.data() as Record<string, unknown>)[ordenarPor.campo] ?? '');
          const vb = String((b.data() as Record<string, unknown>)[ordenarPor.campo] ?? '');
          return ordenarPor.direccion === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        });
      }
      if (typeof limite === 'number') docs = docs.slice(0, limite);
      return { docs, size: docs.length };
    },
  });
  return construir();
}

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({
    doc: (path: string) => docRef(path),
    collection: (name: string) => collectionRef(name),
    batch: () => ({
      set: (ref: { path: string }, data: Record<string, unknown>) => {
        escrituras.push({ path: ref.path, tipo: 'set', data });
        store.set(ref.path, data);
      },
      update: (ref: { path: string }, data: Record<string, unknown>) => {
        escrituras.push({ path: ref.path, tipo: 'update', data });
        store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data });
      },
      commit: async () => {},
    }),
  }),
}));

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

import { POST as crearPOST, GET as bandejaGET } from '@/app/api/licencias/expedientes/route';
import { GET as detalleGET } from '@/app/api/licencias/expedientes/[id]/route';
import { POST as actuacionPOST } from '@/app/api/licencias/expedientes/[id]/actuaciones/route';

function req(body: unknown, method = 'POST'): Request {
  return new Request('http://x', { method, body: method === 'GET' ? undefined : JSON.stringify(body) });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

/* La creación EXIGE decidir sobre el correo desde el 29-ago-2026: o se registra,
   o se declara que no lo tiene. Estas pruebas miran otra cosa; traen el dato
   para poder llegar hasta donde prueban. */
const BODY_VALIDO = { solicitanteNombre: 'Juan Pérez', solicitanteDocumento: '12345678', subtipos: ['CONSTRUCCION'], contacto: { correo: 'juan@ejemplo.com' } };

beforeEach(() => {
  store = new Map();
  escrituras = [];
  sesion = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO', tenantId: 'SEC_PLANEACION' };
});

describe('POST /api/licencias/expedientes — FAIL-CLOSED: demo NUNCA escribe counters ni unicidad_expedientes', () => {
  it('crea el expediente y su primera actuación; NINGUNA escritura toca counters/ ni unicidad_expedientes/', async () => {
    const res = await crearPOST(req(BODY_VALIDO));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.expediente.esPrueba).toBe(true);

    expect(escrituras.length).toBeGreaterThan(0);
    for (const e of escrituras) {
      expect(e.path).not.toMatch(/^counters\//);
      expect(e.path).not.toMatch(/^unicidad_expedientes\//);
      expect(e.path).toMatch(/^expedientes\//);
    }
  });

  it('la primera actuación queda en la subcolección actuaciones del expediente', async () => {
    const res = await crearPOST(req(BODY_VALIDO));
    const data = await res.json();
    const actuacionEscrita = escrituras.find((e) => e.path.includes('/actuaciones/'));
    expect(actuacionEscrita).toBeDefined();
    expect(actuacionEscrita?.path.startsWith(`expedientes/${data.expediente.id}/actuaciones/`)).toBe(true);
  });

  it('subtipo en cuarentena (LA) → 422, no escribe nada', async () => {
    const res = await crearPOST(req({ ...BODY_VALIDO, subtipos: ['LA'] }));
    expect(res.status).toBe(422);
    expect(escrituras).toHaveLength(0);
  });

  it('FUNCIONARIO de otro tenant → 403, no escribe nada', async () => {
    sesion = { uid: 'u1', nombre: 'X', rol: 'FUNCIONARIO', tenantId: 'SEC_HACIENDA' };
    const res = await crearPOST(req(BODY_VALIDO));
    expect(res.status).toBe(403);
    expect(escrituras).toHaveLength(0);
  });
});

describe('GET /api/licencias/expedientes — bandeja del tenant', () => {
  it('devuelve solo expedientes del tenant, ordenados por creadoEn desc', async () => {
    store.set('expedientes/e1', { id: 'e1', tenantId: 'SEC_PLANEACION', creadoEn: '2026-01-01T00:00:00.000Z' });
    store.set('expedientes/e2', { id: 'e2', tenantId: 'SEC_PLANEACION', creadoEn: '2026-06-01T00:00:00.000Z' });
    store.set('expedientes/e3', { id: 'e3', tenantId: 'SEC_HACIENDA', creadoEn: '2026-08-01T00:00:00.000Z' });

    const res = await bandejaGET();
    const data = await res.json();

    expect(data.expedientes.map((e: { id: string }) => e.id)).toEqual(['e2', 'e1']); // e3 excluido, e2 (más reciente) primero
  });

  it('cota dura R11 (endurecimiento pre-reunión): con más de LIMITE_BANDEJA=300 expedientes del tenant, la lectura queda recortada por .limit()', async () => {
    for (let i = 0; i < 310; i += 1) {
      store.set(`expedientes/e${i}`, { id: `e${i}`, tenantId: 'SEC_PLANEACION', creadoEn: '2026-01-01T00:00:00.000Z' });
    }
    const res = await bandejaGET();
    const data = await res.json();
    // Prueba que el .limit(300) llegó hasta Firestore (el doble solo recorta
    // si alguien llamó `.limit(n)`) — sin la cota, este doble devolvería 310.
    expect(data.expedientes).toHaveLength(300);
  });
});

describe('GET /api/licencias/expedientes/[id] — detalle + actuaciones ordenadas', () => {
  it('devuelve el expediente y sus actuaciones en orden ascendente de fecha', async () => {
    store.set('expedientes/e1', { id: 'e1', tenantId: 'SEC_PLANEACION' });
    store.set('expedientes/e1/actuaciones/a2', { id: 'a2', fecha: '2026-06-02T00:00:00.000Z', tipo: 'respuesta-subsanacion' });
    store.set('expedientes/e1/actuaciones/a1', { id: 'a1', fecha: '2026-06-01T00:00:00.000Z', tipo: 'acta-observaciones' });

    const res = await detalleGET(req(null, 'GET'), ctx('e1'));
    const data = await res.json();

    expect(data.expediente.id).toBe('e1');
    expect(data.actuaciones.map((a: { id: string }) => a.id)).toEqual(['a1', 'a2']);
  });

  it('expediente inexistente → 404', async () => {
    const res = await detalleGET(req(null, 'GET'), ctx('no-existe'));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/licencias/expedientes/[id] — computos (Bloque "Términos y vigencias protectores")', () => {
  it('solo radicación: terminoDual.suspension === terminoDual.reinicio, plazoSubsanacion NO_APLICA, vigencia ausente (sin firmeza), sin borrador', async () => {
    store.set('expedientes/e2', { id: 'e2', tenantId: 'SEC_PLANEACION' });
    store.set('expedientes/e2/actuaciones/a1', { id: 'a1', tipo: 'radicacion-debida-forma', fecha: '2026-06-01T12:00:00.000Z', origen: 'REAL' });

    const res = await detalleGET(req(null, 'GET'), ctx('e2'));
    const data = await res.json();

    expect(data.computos.terminoDual.suspension).toBe(data.computos.terminoDual.reinicio);
    expect(data.computos.terminoDual.fechaAlertaConservadora).toBe(data.computos.terminoDual.suspension);
    expect(data.computos.plazoSubsanacion.resultado).toBe('NO_APLICA');
    expect(data.computos.vigencia).toBeUndefined();
    expect(data.borradorActoDesistimiento).toBeNull();
  });

  it('acta comunicada, plazo de 30 hábiles vencido → plazoSubsanacion POR_ARCHIVAR + borradorActoDesistimiento con los datos del expediente', async () => {
    store.set('expedientes/e3', {
      id: 'e3', tenantId: 'SEC_PLANEACION', solicitanteNombre: 'Ana Gómez', solicitanteDocumento: '99999',
      numeroExpediente: { numero: 'DEMO-26-xxx', serieId: 'demo', año: 2026 },
    });
    store.set('expedientes/e3/actuaciones/a1', { id: 'a1', tipo: 'radicacion-debida-forma', fecha: '2026-01-05T12:00:00.000Z', origen: 'REAL' });
    store.set('expedientes/e3/actuaciones/a2', { id: 'a2', tipo: 'acta-observaciones', fecha: '2026-01-10T12:00:00.000Z', origen: 'REAL' });
    store.set('expedientes/e3/actuaciones/a3', {
      id: 'a3', tipo: 'comunicacion-enviada', fecha: '2026-01-11T12:00:00.000Z', origen: 'REAL',
      // tipoComunicacion identifica esta comunicación como EL AVISO DEL
      // ACTA (corrección de revisión cruzada, 10-ago-2026) — sin este
      // campo, evaluarPlazoSubsanacion no la distinguiría de una constancia.
      tipoComunicacion: 'Aviso de acta de observaciones y correcciones',
    });

    const res = await detalleGET(req(null, 'GET'), ctx('e3'));
    const data = await res.json();

    expect(data.computos.plazoSubsanacion.resultado).toBe('POR_ARCHIVAR');
    expect(data.borradorActoDesistimiento).not.toBeNull();
    expect(data.borradorActoDesistimiento.cuerpo).toContain('Ana Gómez');
    expect(data.borradorActoDesistimiento.cuerpo).toContain('DEMO-26-xxx');
  });

  it('expediente CERRADO con fechaFirmeza + subtipos sin ambigüedad de modalidad (URBANIZACION) → computos.vigencia calculada', async () => {
    store.set('expedientes/e4', {
      id: 'e4', tenantId: 'SEC_PLANEACION', subtipos: ['URBANIZACION'],
      actoFinal: { fechaFirmeza: '2026-08-15T12:00:00.000Z', cierreDesconocido: false },
    });

    const res = await detalleGET(req(null, 'GET'), ctx('e4'));
    const data = await res.json();

    expect(data.computos.vigencia).toBeDefined();
    expect(data.computos.vigencia.configAplicada.meses).toBe(36);
  });

  it('expediente CERRADO con CONSTRUCCION pero SIN modalidad capturada → computos.vigencia queda OMITIDA (honesto, no un error HTTP)', async () => {
    store.set('expedientes/e5', {
      id: 'e5', tenantId: 'SEC_PLANEACION', subtipos: ['CONSTRUCCION'],
      actoFinal: { fechaFirmeza: '2026-08-15T12:00:00.000Z' },
    });

    const res = await detalleGET(req(null, 'GET'), ctx('e5'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.computos.vigencia).toBeUndefined();
  });
});

describe('POST /api/licencias/expedientes/[id]/actuaciones — acta única + transición', () => {
  beforeEach(() => {
    store.set('expedientes/e1', {
      id: 'e1', tenantId: 'SEC_PLANEACION', estadoJuridico: 'EN_REVISION', estado: 'EN_REVISION',
    });
  });

  const DETALLE_OK = 'Falta el certificado de tradición y libertad actualizado del predio.';

  it('primera acta-observaciones → 200, transiciona a CON_ACTA_DE_OBSERVACIONES', async () => {
    const res = await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('e1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.estadoJuridico).toBe('CON_ACTA_DE_OBSERVACIONES');
    expect(store.get('expedientes/e1')?.estadoJuridico).toBe('CON_ACTA_DE_OBSERVACIONES');
  });

  it('acta ÚNICA: una segunda acta-observaciones → 409, no vuelve a escribir', async () => {
    await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('e1'));
    const escriturasTrasActa1 = escrituras.length;

    const res = await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('e1'));
    expect(res.status).toBe(409);
    expect(escrituras.length).toBe(escriturasTrasActa1); // sin nueva escritura
  });

  it('respuesta-subsanacion tras el acta → 200, transiciona a EN_VIABILIDAD', async () => {
    await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('e1'));
    const res = await actuacionPOST(req({ tipo: 'respuesta-subsanacion', detalle: DETALLE_OK }), ctx('e1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.estadoJuridico).toBe('EN_VIABILIDAD');
  });

  it('respuesta-subsanacion SIN acta previa → 409', async () => {
    const res = await actuacionPOST(req({ tipo: 'respuesta-subsanacion', detalle: DETALLE_OK }), ctx('e1'));
    expect(res.status).toBe(409);
  });

  it('tipo no permitido → 400, no escribe', async () => {
    const res = await actuacionPOST(req({ tipo: 'acto-viabilidad', detalle: DETALLE_OK }), ctx('e1'));
    expect(res.status).toBe(400);
    expect(escrituras).toHaveLength(0);
  });

  it('expediente inexistente → 404', async () => {
    const res = await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('no-existe'));
    expect(res.status).toBe(404);
  });

  it('FUNCIONARIO de otro tenant → 403', async () => {
    sesion = { uid: 'u1', nombre: 'X', rol: 'FUNCIONARIO', tenantId: 'SEC_HACIENDA' };
    const res = await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('e1'));
    expect(res.status).toBe(403);
  });
});

/* ══════════════════════════════════════════════════════════════
   fechaAlertaConservadora — espejo denormalizado (R11, Bloque "Términos y
   vigencias protectores"). Las aserciones puras de cómputo (coincide con
   calcularVencimientoDual, se actualiza entre actuaciones, null bajo R9)
   ya están cubiertas en `expedientes-licencias-decisiones.test.ts` y
   `expedientes-licencias-handoff-decisiones.test.ts` con `ahora` inyectado
   y controlado. Aquí, con las rutas REALES corriendo, se cubre lo que solo
   se puede probar a este nivel: que la escritura queda en el MISMO batch,
   que la bandeja la expone sin lectura extra, y que — de punta a punta —
   el valor persistido nunca diverge del cómputo on-read del detalle.
══════════════════════════════════════════════════════════════ */
describe('POST /api/licencias/expedientes/[id]/actuaciones — espejo fechaAlertaConservadora, MISMO batch que la actuación', () => {
  const DETALLE_OK = 'Falta el certificado de tradición y libertad actualizado del predio.';

  beforeEach(() => {
    store.set('expedientes/e1', { id: 'e1', tenantId: 'SEC_PLANEACION', estadoJuridico: 'EN_REVISION', estado: 'EN_REVISION' });
    store.set('expedientes/e1/actuaciones/a0', {
      id: 'a0', expedienteId: 'e1', tenantId: 'SEC_PLANEACION', tipo: 'radicacion-debida-forma', etapa: 'radicacion',
      actorUid: 'u0', actorNombre: 'Otro Funcionario', actorRol: 'FUNCIONARIO', fecha: '2026-06-01T12:00:00.000Z', origen: 'REAL',
    });
  });

  it('la actuación y el espejo se escriben en el MISMO batch: un solo update a expedientes/e1, con fechaAlertaConservadora', async () => {
    const res = await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('e1'));
    expect(res.status).toBe(200);

    const escriturasExpediente = escrituras.filter((e) => e.path === 'expedientes/e1');
    const escrituraActuacion = escrituras.find((e) => e.path.startsWith('expedientes/e1/actuaciones/'));
    // Un ÚNICO write al documento raíz (el `batch.update` de la ruta) — si
    // el espejo se escribiera aparte, aquí habría 2. Nunca una escritura
    // suelta que pueda desincronizarse del origen real.
    expect(escriturasExpediente).toHaveLength(1);
    expect(escriturasExpediente[0].tipo).toBe('update');
    expect(escriturasExpediente[0].data).toHaveProperty('fechaAlertaConservadora');
    expect(typeof escriturasExpediente[0].data.fechaAlertaConservadora).toBe('string');
    expect(escrituraActuacion).toBeDefined();
    expect(store.get('expedientes/e1')?.fechaAlertaConservadora).toBe(escriturasExpediente[0].data.fechaAlertaConservadora);
  });

  it('R9: si la única actuación previa es RECONSTRUIDO (expediente histórico), el espejo persiste NULL, no un dato fabricado', async () => {
    store.set('expedientes/e9', { id: 'e9', tenantId: 'SEC_PLANEACION', estadoJuridico: 'EN_REVISION', estado: 'EN_REVISION' });
    store.set('expedientes/e9/actuaciones/hist1', {
      id: 'hist1', expedienteId: 'e9', tenantId: 'SEC_PLANEACION', tipo: 'radicacion-debida-forma', etapa: 'radicacion',
      actorUid: 'sistema', actorNombre: 'Importador', actorRol: 'SISTEMA', fecha: '2020-01-10T12:00:00.000Z', origen: 'RECONSTRUIDO',
    });

    const res = await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('e9'));
    expect(res.status).toBe(200);
    expect(store.get('expedientes/e9')?.fechaAlertaConservadora).toBeNull();
  });
});

describe('GET /api/licencias/expedientes — bandeja expone fechaAlertaConservadora SIN lectura extra (R11 resuelto)', () => {
  it('devuelve el espejo tal como está persistido en el documento raíz', async () => {
    store.set('expedientes/eA', { id: 'eA', tenantId: 'SEC_PLANEACION', creadoEn: '2026-01-01T00:00:00.000Z', fechaAlertaConservadora: '2026-03-01T17:00:00.000Z' });

    const res = await bandejaGET();
    const data = await res.json();
    const item = data.expedientes.find((e: { id: string }) => e.id === 'eA');

    expect(item.fechaAlertaConservadora).toBe('2026-03-01T17:00:00.000Z');
  });

  it('expediente escrito ANTES de este campo → ausente en la respuesta, nunca un valor fabricado', async () => {
    store.set('expedientes/eB', { id: 'eB', tenantId: 'SEC_PLANEACION', creadoEn: '2026-01-01T00:00:00.000Z' });

    const res = await bandejaGET();
    const data = await res.json();
    const item = data.expedientes.find((e: { id: string }) => e.id === 'eB');

    expect(item.fechaAlertaConservadora).toBeUndefined();
  });
});

describe('Anti-divergencia: fechaAlertaConservadora persistido === cómputo on-read (mismo motor, misma serie)', () => {
  it('crear + acta + respuesta → el valor persistido (store) y el de la bandeja coinciden EXACTO con computos.terminoDual.fechaAlertaConservadora del detalle', async () => {
    const creado = await crearPOST(req(BODY_VALIDO));
    const dataCreado = await creado.json();
    const id = dataCreado.expediente.id as string;

    await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: 'Falta el certificado de tradición y libertad actualizado del predio.' }), ctx(id));
    await actuacionPOST(req({ tipo: 'respuesta-subsanacion', detalle: 'Se aporta el certificado de tradición y libertad solicitado en el acta.' }), ctx(id));

    const detalleRes = await detalleGET(req(null, 'GET'), ctx(id));
    const dataDetalle = await detalleRes.json();

    const bandejaRes = await bandejaGET();
    const dataBandeja = await bandejaRes.json();
    const itemBandeja = dataBandeja.expedientes.find((e: { id: string }) => e.id === id);

    const persistido = store.get(`expedientes/${id}`)?.fechaAlertaConservadora;
    expect(persistido).not.toBeUndefined();
    expect(persistido).toBe(dataDetalle.computos.terminoDual.fechaAlertaConservadora);
    expect(itemBandeja.fechaAlertaConservadora).toBe(dataDetalle.computos.terminoDual.fechaAlertaConservadora);
  });
});
