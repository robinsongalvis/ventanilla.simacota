/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { MarcasDePrueba } from '@/lib/radicados/dato-de-prueba';
import type { Firestore } from 'firebase-admin/firestore';

const dobles = vi.hoisted(() => ({
  registros: new Map<string, object>(),
  colecciones: new Map<string, object[]>(),
  auditar: vi.fn(),
  leerColeccion: vi.fn(),
}));

function referencia(path: string) {
  return {
    path,
    get: async () => ({ id: path.split('/').pop()!, exists: dobles.registros.has(path), data: () => dobles.registros.get(path) }),
  };
}
const db = {
  doc: referencia,
  getAll: async (...refs: ReturnType<typeof referencia>[]) => Promise.all(refs.map((ref) => ref.get())),
  collection: (path: string) => {
    dobles.leerColeccion(path);
    const query = {
      orderBy: () => query,
      where: () => query,
      limit: () => query,
      get: async () => ({ docs: (dobles.colecciones.get(path) ?? []).map((data) => ({ data: () => data })), empty: !dobles.colecciones.get(path)?.length }),
    };
    return query;
  },
};

vi.mock('@/lib/firebase-admin', () => ({ getFirebaseAdminDb: () => db }));
vi.mock('@/lib/seguridad/rate-limit-consulta-publica', () => ({
  aplicarRateLimitCompartido: async () => ({ bloqueado: false }),
  limpiarFallosCompartidos: vi.fn(),
  registrarAuditoriaConsulta: dobles.auditar,
  registrarFalloCompartido: vi.fn(),
  rateLimitConsultaEmergencia: { limpiarFallos: vi.fn(), registrarFallo: vi.fn() },
}));

import { getRadicadoOrFail } from '@/lib/server/radicados-security';
import { filtrarPlanillasOperativas, assertPlanillaOperativa, obtenerPendientesDeReparto } from '@/lib/server/planillas-security';
import { construirPlanilla, esPendienteDeReparto, radicadosPendientesDeReparto } from '@/lib/planillas/construir-planilla';
import { verificarRadicadoVinculable } from '@/lib/server/expedientes-licencias';
import { POST as consultaPublica } from '@/app/api/public/radicado/consulta/route';
import { MENSAJE_CONSULTA_NO_VERIFICADA } from '@/lib/seguridad/consulta-publica-radicado';
import { debeNotificarCiudadano } from '@/lib/email/debe-notificar-ciudadano';

const RADICADO_ID = '1-110-202609-00000031';
function radicado(marcas: MarcasDePrueba = {}): VentanillaRadicado {
  return {
    radicadoId: RADICADO_ID, estadoActual: 'PENDIENTE', ultimaActualizacion: '2026-09-29T15:00:00.000Z', prioridad: 'AMARILLO',
    esAnonimo: false, tipoPresentacion: 'IDENTIFICADA', identidadReservada: false, canalRespuesta: 'CORREO',
    solicitante: { tipoPersona: 'NATURAL', tipoDocumento: 'CC', numeroDocumento: '1234567890', nombreCompleto: 'Persona sintética', email: 'sintetico@example.invalid', ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' } },
    control: { radicadoId: RADICADO_ID, consecutivo: 31, fechaRadicado: '2026-09-29T15:00:00.000Z', horaRadicado: '10:00:00', medioRecepcion: 'PRESENCIAL', origen: 'FISICO_ESCANER' },
    termino: { tipoSolicitudId: 'PETICION_GENERAL', tipoSolicitudNombre: 'Petición general', diasRespuesta: 15, unidad: 'HABILES', fechaVencimiento: '2026-10-21T22:00:00.000Z', prorrogasAplicadas: 0 },
    clasificacion: { oficinaDestino: 'SEC_PLANEACION', zonaGeografica: 'CASCO_URBANO' },
    detalle: { asunto: 'Prueba local', descripcion: 'Datos sintéticos locales.', numeroFolios: 1 }, archivos: [],
    ...marcas,
  };
}
const MARCAS: MarcasDePrueba[] = [
  { isTest: true }, { excludeFromMetrics: true }, { esPrueba: true },
  { anulado: { fecha: '2026-09-29', motivo: 'Prueba local', acta: 'referencia-sintetica' } },
];

beforeEach(() => { dobles.registros.clear(); dobles.colecciones.clear(); vi.clearAllMocks(); });

describe('cuarentena: una definición de dato no operativo', () => {
  it.each(MARCAS)('rechaza mutaciones, reparto y vinculación de %j sin reescribirlo', async (marca) => {
    const registro = radicado(marca);
    dobles.registros.set(`ventanilla_radicados/${RADICADO_ID}`, registro);
    await expect(getRadicadoOrFail(RADICADO_ID)).rejects.toMatchObject({ status: 404 });
    expect(esPendienteDeReparto(registro, new Set())).toBe(false);
    expect(verificarRadicadoVinculable(registro)).toMatchObject({ status: 409 });
    expect(debeNotificarCiudadano(registro)).toBe(false);
    expect(construirPlanilla([registro], 1, { uid: 'sintetico', nombre: 'Prueba' }, new Date())).toHaveProperty('filas', []);
    expect(dobles.registros.get(`ventanilla_radicados/${RADICADO_ID}`)).toBe(registro);
  });

  it('el radicado real conserva sus operaciones y su reparto', async () => {
    const registro = radicado();
    dobles.registros.set(`ventanilla_radicados/${RADICADO_ID}`, registro);
    await expect(getRadicadoOrFail(RADICADO_ID)).resolves.toBe(registro);
    expect(esPendienteDeReparto(registro, new Set())).toBe(true);
    expect(verificarRadicadoVinculable(registro)).toBeNull();
    expect(debeNotificarCiudadano(registro)).toBe(true);
  });
});

describe('consulta pública: los datos de prueba no se exponen aunque el factor coincida', () => {
  function request() {
    return new Request('https://stage.invalid/api/public/radicado/consulta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ numeroRadicado: RADICADO_ID, datoVerificacion: 'sintetico@example.invalid' }) });
  }
  it.each(MARCAS)('devuelve el404 genérico para %j', async (marca) => {
    dobles.registros.set(`ventanilla_radicados/${RADICADO_ID}`, radicado(marca));
    const response = await consultaPublica(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: MENSAJE_CONSULTA_NO_VERIFICADA });
    expect(dobles.leerColeccion).not.toHaveBeenCalled();
    expect(dobles.auditar).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'DATO_NO_OPERATIVO' }));
  });
  it('conserva la consulta del registro real verificado', async () => {
    dobles.registros.set(`ventanilla_radicados/${RADICADO_ID}`, radicado());
    const response = await consultaPublica(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, radicado: { numeroRadicado: RADICADO_ID } });
  });
});

describe('planillas: cuarentena derivada, historial intacto', () => {
  it('una planilla mixta no libera las filas reales para un segundo reparto', async () => {
    const real = radicado();
    const luegoMarcado = { ...radicado(), radicadoId: '1-110-202609-00000032' };
    const planilla = construirPlanilla([real, luegoMarcado], 1, { uid: 'sintetico', nombre: 'Prueba' }, new Date());
    const prueba = { ...luegoMarcado, isTest: true };
    dobles.registros.set(`ventanilla_radicados/${RADICADO_ID}`, real);
    dobles.registros.set(`ventanilla_radicados/${prueba.radicadoId}`, prueba);
    const firestore = db as unknown as Firestore;
    expect(await filtrarPlanillasOperativas(firestore, [planilla])).toEqual([]);
    // La reserva usa TODAS las planillas abiertas, no la proyección de la vista.
    expect(radicadosPendientesDeReparto([real, prueba], [planilla])).toEqual([]);
    dobles.colecciones.set('ventanilla_radicados', [real, prueba]);
    dobles.colecciones.set('ventanilla_planillas', [planilla]);
    const reparto = await obtenerPendientesDeReparto(firestore);
    expect(reparto.pendientes).toEqual([]);
    expect(reparto.planillasAbiertas).toEqual([planilla]);
    expect(planilla.filas).toHaveLength(2);
  });
  it('oculta la planilla de prueba, impide mutarla y conserva su documento completo', async () => {
    const registro = radicado();
    const planilla = construirPlanilla([registro], 1, { uid: 'sintetico', nombre: 'Prueba' }, new Date());
    const copia = structuredClone(planilla);
    dobles.registros.set(`ventanilla_radicados/${RADICADO_ID}`, radicado({ isTest: true }));
    // Doble deliberadamente mínimo de Firestore: solo las lecturas usadas por el helper.
    const firestore = db as unknown as Firestore;
    expect(await filtrarPlanillasOperativas(firestore, [planilla])).toEqual([]);
    await expect(assertPlanillaOperativa(firestore, planilla)).rejects.toMatchObject({ status: 409 });
    expect(planilla).toEqual(copia);
  });
  it('conserva las planillas reales y falla cerrado ante un radicado ausente', async () => {
    const registro = radicado();
    const planilla = construirPlanilla([registro], 1, { uid: 'sintetico', nombre: 'Prueba' }, new Date());
    const firestore = db as unknown as Firestore;
    expect(await filtrarPlanillasOperativas(firestore, [planilla])).toEqual([]);
    dobles.registros.set(`ventanilla_radicados/${RADICADO_ID}`, registro);
    expect(await filtrarPlanillasOperativas(firestore, [planilla])).toEqual([planilla]);
    await expect(assertPlanillaOperativa(firestore, planilla)).resolves.toBeUndefined();
  });
});
