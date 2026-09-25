import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * CORRIDA VIVA del vigía: ejecuta el handler REAL de extremo a extremo contra
 * una base sembrada, y ESCRIBE EL INFORME QUE PRODUCE.
 *
 * Por qué existe, además de las pruebas de la función pura: el módulo de
 * Licencias nos enseñó, a un costo alto, que «escrito y probado» no implica
 * «alcanzable» — el emisor de consecutivos estaba escrito, probado, y sin un
 * solo llamador. Este archivo cierra esa distinción para el vigía: recorre la
 * ruta entera (autorización → lectura → umbral → clasificación → informe) y
 * deja el JSON a la vista para que alguien pueda leerlo, no solo un check verde.
 */

const db = {
  colecciones: new Map<string, unknown[]>(),
  configuracion: null as Record<string, unknown> | null,
  fallarLectura: false,

  collection(nombre: string) {
    return {
      limit: () => ({
        get: async () => {
          if (db.fallarLectura) throw new Error('PERMISSION_DENIED: simulación de credencial revocada');
          return { docs: (db.colecciones.get(nombre) ?? []).map((d) => ({ data: () => d })) };
        },
      }),
    };
  },
  doc(ruta: string) {
    return {
      get: async () => ({
        exists: ruta === 'configuracion/licencias' && db.configuracion !== null,
        data: () => db.configuracion,
      }),
    };
  },
};

vi.mock('@/lib/firebase-admin', () => ({ getFirebaseAdminDb: () => db }));
vi.mock('@/lib/logger', () => ({ logError: () => {} }));

const { GET } = await import('@/app/api/cron/vencimientos-licencias/route');

const CABECERA = { headers: { authorization: 'Bearer secreto-de-prueba' } };
const pedir = () => GET(new Request('http://test/api/cron/vencimientos-licencias', CABECERA));

/** Un expediente sembrado. Las fechas son fijas para que la corrida sea repetible. */
function expediente(over: Record<string, unknown>) {
  return {
    id: 'x', tenantId: 'SEC_PLANEACION', estadoJuridico: 'EN_REVISION',
    creadoEn: '2026-08-20T12:00:00.000Z',
    numeroExpediente: { numero: '68745-0-26-0001' },
    ...over,
  };
}

/* Reloj FIJO. El handler llama a `new Date()` por dentro —correcto: toda la
   corrida debe usar el mismo instante— así que la única forma de que esta
   evidencia sea reproducible es fijar el reloj desde fuera. Sin esto los días
   hábiles restantes cambian cada día y el informe deja de servir como prueba.
   Martes 1-sep-2026, día hábil, sin festivo cerca. */
const AHORA_FIJO = new Date('2026-09-01T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AHORA_FIJO);
  process.env.CRON_SECRET = 'secreto-de-prueba';
  db.fallarLectura = false;
  db.configuracion = null;
  db.colecciones.set('expedientes', [
    // ── CORRIENDO, los cuatro escalones ──
    expediente({ id: 'lejos',    numeroExpediente: { numero: '68745-0-26-0001' }, fechaAlertaConservadora: '2027-03-01T12:00:00.000Z' }),
    expediente({ id: 'aviso',    numeroExpediente: { numero: '68745-0-26-0002' }, fechaAlertaConservadora: '2026-09-18T12:00:00.000Z' }),
    expediente({ id: 'critico',  numeroExpediente: { numero: '68745-0-26-0003' }, fechaAlertaConservadora: '2026-09-07T12:00:00.000Z' }),
    expediente({ id: 'vencido',  numeroExpediente: { numero: '68745-0-26-0004' }, fechaAlertaConservadora: '2026-08-20T12:00:00.000Z' }),
    // ── SUSPENDIDO por acta de observaciones ──
    expediente({ id: 'suspendido', numeroExpediente: { numero: '68745-0-26-0005' },
      estadoJuridico: 'CON_ACTA_DE_OBSERVACIONES', fechaAlertaConservadora: '2026-10-01T12:00:00.000Z' }),
    // ── SIN_ANCLAR: uno reciente y uno que supera la edad máxima ──
    expediente({ id: 'sin-anclar-reciente', numeroExpediente: null, creadoEn: '2026-08-31T12:00:00.000Z' }),
    expediente({ id: 'sin-anclar-viejo',    numeroExpediente: null, creadoEn: '2026-07-01T12:00:00.000Z' }),
    // ── RESUELTO: fuera de alcance ──
    expediente({ id: 'resuelto', numeroExpediente: { numero: '68745-0-26-0006' },
      estadoJuridico: 'EN_FIRME', fechaAlertaConservadora: '2026-05-01T12:00:00.000Z' }),
    // ── Dato de prueba: NO debe generar alerta ──
    expediente({ id: 'de-prueba', isTest: true, fechaAlertaConservadora: '2026-08-01T12:00:00.000Z' }),
  ]);
});

afterEach(() => { vi.useRealTimers(); });

describe('corrida viva del vigía de licencias', () => {
  it('produce el informe con las cuatro situaciones y declara su umbral', async () => {
    const informe = await (await pedir()).json();

    console.log('\n╔══ INFORME REAL DEL VIGÍA — umbral por DEFECTO ═══════════════╗');
    console.log(JSON.stringify(informe, null, 2));
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    expect(informe.ok).toBe(true);
    // 9 sembrados − 1 dato de prueba = 8 revisados
    expect(informe.revisados).toBe(8);
    expect(informe.situaciones).toEqual({ corriendo: 4, suspendidos: 1, sinAnclar: 2, resueltos: 1 });
    expect(informe.alertas.vencidos).toBe(1);
    expect(informe.alertas.criticos).toBe(1);
    expect(informe.alertas.avisos).toBe(1);
    expect(informe.alertas.esperaExcesivaSinAnclar).toBe(1); // solo el viejo
    // El informe DECLARA con qué umbral juzgó y de dónde salió.
    expect(informe.edadMaximaSinAnclarHabiles).toBe(3);
    expect(informe.edadMaximaOrigen).toBe('DEFECTO');
  });

  it('cuando hay configuración, la usa y lo declara', async () => {
    db.configuracion = { edadMaximaSinAnclarHabiles: 10 };
    const informe = await (await pedir()).json();

    console.log('\n╔══ INFORME REAL — umbral desde CONFIGURACIÓN (10 días) ═══════╗');
    console.log(JSON.stringify({
      edadMaximaSinAnclarHabiles: informe.edadMaximaSinAnclarHabiles,
      edadMaximaOrigen: informe.edadMaximaOrigen,
      esperaExcesivaSinAnclar: informe.alertas.esperaExcesivaSinAnclar,
    }, null, 2));
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    expect(informe.edadMaximaSinAnclarHabiles).toBe(10);
    expect(informe.edadMaximaOrigen).toBe('CONFIGURACION');
  });

  it('un valor de configuración disparatado se ignora y vuelve al defecto', async () => {
    db.configuracion = { edadMaximaSinAnclarHabiles: 9999 };
    const informe = await (await pedir()).json();
    expect(informe.edadMaximaSinAnclarHabiles).toBe(3);
    expect(informe.edadMaximaOrigen).toBe('DEFECTO');
  });

  it('SI NO PUEDE MIRAR, FALLA EN ROJO — no reporta verde', async () => {
    db.fallarLectura = true;
    const respuesta = await pedir();
    const cuerpo = await respuesta.json();

    console.log('\n╔══ INFORME REAL — credencial revocada (fallo forzado) ════════╗');
    console.log(`  HTTP ${respuesta.status}`);
    console.log(JSON.stringify(cuerpo, null, 2));
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    expect(respuesta.status).toBe(500);
    expect(cuerpo.ok).toBe(false);
    // Lo que NO debe pasar: devolver 200 con cero alertas, que un tablero
    // pintaría verde y sería indistinguible de «todo en orden».
    expect(cuerpo.situaciones).toBeUndefined();
    expect(cuerpo.alertas).toBeUndefined();
  });

  it('sin credencial de cron no se ejecuta', async () => {
    const r = await GET(new Request('http://test/api/cron/vencimientos-licencias'));
    expect(r.status).toBe(401);
  });
});
