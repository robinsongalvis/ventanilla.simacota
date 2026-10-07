/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GestionAdjuntosRadicado } from '@/lib/recepcion/contingencia-storage';
import type { ArchivoRadicado } from '@/src/types/ventanilla';
import {
  autorizarDescargaArchivo,
  parsearPathArchivo,
  type RadicadoParaDescarga,
} from '@/lib/seguridad/autorizar-descarga-archivo';

const id = '1-110-202609-00000041';
const docPath = `ventanilla_radicados/${id}`;
const eventoPath = `${docPath}/trazabilidad/ev_${id}_ADJUNTOS_REGULARIZADOS_STORAGE`;
const bytesPdf = '%PDF-1.4\nSoportes exclusivamente sinteticos\n%%EOF';
const gestionPendiente: GestionAdjuntosRadicado = {
  version: 1, estado: 'PENDIENTE_STORAGE', registradoEn: '2026-09-29T15:00:00Z',
  registradoPor: { uid: 'recepcion-sintetica', nombre: 'Recepción sintética' },
  soportesPendientes: {
    descripcion: 'Solicitud sintética y acta de recepción.', cantidad: 2,
    custodiaTipo: 'FISICA_EN_VENTANILLA', custodiaReferencia: 'Caja sintética de ensayo', confirmacionCustodia: true,
  },
};
interface DocumentoSimulado {
  gestionAdjuntos: GestionAdjuntosRadicado;
  archivos: ArchivoRadicado[];
  clasificacion: { oficinaDestino: string };
  isTest?: boolean;
}
// Modelo mínimo de la frontera SDK: documentos de negocio y trazabilidad heterogéneos.
let documentos: Map<string, unknown>;
let objetos: Map<string, Buffer>;
let rol: string;
let storageModo: 'ok' | 'billing' | 'hash' | 'metadata';
let fallaAuditoria: boolean;
let antesDeTx: (() => void) | null;
let cola: Promise<void>;
const saveSpy = vi.fn(); const descargaSpy = vi.fn(); const storageSpy = vi.fn();

vi.mock('@/lib/server/internal-auth', () => {
  class InternalAuthError extends Error { status = 401; }
  return {
    InternalAuthError,
    requireActiveInternalUser: async () => {
      if (rol === 'SIN_SESION') throw new InternalAuthError('No autorizado.');
      return { uid: 'recepcion-sintetica', nombre: 'Recepción sintética', rol, tenantId: 'VENTANILLA_UNICA', activo: true };
    },
    canOperateTenant: () => true,
  };
});
vi.mock('@/lib/ai/rate-limit', () => ({ checkRateLimit: () => null }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({
    doc: (path: string) => ({ path, get: async () => ({ exists: documentos.has(path), data: () => documentos.get(path) }) }),
    runTransaction: async (cb: (tx: object) => Promise<unknown>) => {
      const anterior = cola;
      let liberar: () => void = () => {};
      cola = new Promise<void>((resolve) => { liberar = resolve; });
      await anterior;
      try {
        antesDeTx?.(); antesDeTx = null;
        const copia = new Map(documentos);
        const tx = {
          get: async ({ path }: { path: string }) => ({ exists: copia.has(path), data: () => copia.get(path) }),
          update: ({ path }: { path: string }, data: object) => copia.set(path, { ...copia.get(path) as object, ...data }),
          create: ({ path }: { path: string }, data: unknown) => {
            if (fallaAuditoria || copia.has(path)) throw new Error('No se pudo crear auditoría');
            copia.set(path, data);
          },
        };
        const result = await cb(tx); documentos = copia; return result;
      } finally { liberar(); }
    },
  }),
  getFirebaseAdminStorage: () => {
    storageSpy();
    return { bucket: () => ({ file: (path: string, options?: { generation: string }) => ({
      save: async (bytes: Buffer, config: { preconditionOpts: { ifGenerationMatch: number } }) => {
        saveSpy(config);
        if (storageModo === 'billing') throw Object.assign(new Error('UserProjectAccountProblem'), { code: 403 });
        if (objetos.has(path)) throw Object.assign(new Error('Precondition Failed'), { code: 412 });
        objetos.set(path, bytes);
      },
      getMetadata: async () => [{ generation: '1', size: objetos.get(path)?.length, contentType: storageModo === 'metadata' ? 'text/plain' : 'application/pdf' }],
      download: async () => {
        descargaSpy(options);
        if (storageModo === 'billing') throw new Error('UserProjectAccountProblem');
        if (storageModo === 'hash') return [Buffer.from('dato inconsistente')];
        return [objetos.get(path)];
      },
    }) }) };
  },
}));

import { POST } from '@/app/api/radicados/[radicadoId]/regularizar-adjuntos/route';

function formulario(contenido = bytesPdf): FormData {
  const f = new FormData();
  f.set('archivo', new File([contenido], 'sintetico.pdf', { type: 'application/pdf' }));
  f.set('confirmacionIntegridad', 'true'); return f;
}
function llamar(f = formulario()) {
  return POST(new Request('http://local/regularizar-adjuntos', { method: 'POST', body: f }), { params: Promise.resolve({ radicadoId: id }) });
}
function radicado() { return documentos.get(docPath) as DocumentoSimulado; }

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FIREBASE_STORAGE_BUCKET = 'bucket-sintetico-local';
  documentos = new Map([[docPath, {
    gestionAdjuntos: structuredClone(gestionPendiente), archivos: [], clasificacion: { oficinaDestino: 'VENTANILLA_UNICA' },
  }]]);
  objetos = new Map(); rol = 'RECEPCIONISTA'; storageModo = 'ok'; fallaAuditoria = false; antesDeTx = null; cola = Promise.resolve();
});

describe('regularización controlada e idempotente (Firestore y Storage simulados)', () => {
  it('verifica bytes+generación antes de confirmar referencias, estado y auditoría juntos', async () => {
    const res = await llamar();
    expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ estadoAdjuntos: 'COMPLETO', repetida: false });
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ preconditionOpts: { ifGenerationMatch: 0 } }));
    expect(descargaSpy).toHaveBeenCalledWith({ generation: '1' });
    expect(radicado().gestionAdjuntos.estado).toBe('COMPLETO'); expect(radicado().archivos).toHaveLength(1);
    expect(radicado().gestionAdjuntos.soportesPendientes).toEqual(gestionPendiente.soportesPendientes);
    expect(documentos.get(eventoPath)).toMatchObject({ accion: 'ADJUNTOS_REGULARIZADOS_STORAGE', actorUid: 'recepcion-sintetica' });
  });
  it('reintento con el mismo PDF no duplica archivo ni evento ni vuelve a subir', async () => {
    await llamar(); const snapshot = [...documentos.entries()];
    const res = await llamar();
    expect(res.status).toBe(200); expect((await res.json()).repetida).toBe(true);
    expect([...documentos.entries()]).toEqual(snapshot); expect(saveSpy).toHaveBeenCalledTimes(1);
  });
  it('el path persistido puede descargarse con el autorizador real, sin debilitar pertenencia ni tenant', async () => {
    expect((await llamar()).status).toBe(200);
    const path = radicado().archivos[0].path;
    expect(path.split('/')).toHaveLength(3);
    expect(parsearPathArchivo(path)).toMatchObject({ prefijo: 'radicados', radicadoId: id });
    const propietario: RadicadoParaDescarga = {
      tenantId: 'VENTANILLA_UNICA', adjuntosPaths: radicado().archivos.map((a) => a.path), respuestaOficialPath: null,
    };
    expect(autorizarDescargaArchivo({
      path, radicado: propietario,
      usuario: { uid: 'recepcion-sintetica', rol: 'RECEPCIONISTA', tenantId: 'VENTANILLA_UNICA' },
    })).toMatchObject({ ok: true, radicadoId: id, tipoArchivo: 'ADJUNTO_CIUDADANO' });
    expect(autorizarDescargaArchivo({
      path, radicado: propietario,
      usuario: { uid: 'funcionario-ajeno', rol: 'FUNCIONARIO', tenantId: 'SEC_GOBIERNO' },
    })).toMatchObject({ ok: false, status: 403 });
    expect(autorizarDescargaArchivo({
      path, radicado: { ...propietario, adjuntosPaths: [] },
      usuario: { uid: 'recepcion-sintetica', rol: 'RECEPCIONISTA', tenantId: 'VENTANILLA_UNICA' },
    })).toMatchObject({ ok: false, status: 404 });
  });
  it('dos peticiones concurrentes del mismo PDF hacen una única regularización', async () => {
    const respuestas = await Promise.all([llamar(), llamar()]);
    expect(respuestas.map((r) => r.status)).toEqual([200, 200]);
    const bodies = await Promise.all(respuestas.map((r) => r.json()));
    expect(bodies.map((b) => b.repetida)).toEqual([false, true]);
    expect(objetos.size).toBe(1); expect(radicado().archivos).toHaveLength(1); expect(documentos.size).toBe(2);
  });
  it('un PDF diferente después de completar no reemplaza el soporte', async () => {
    await llamar(); const snapshot = [...documentos.entries()];
    expect((await llamar(formulario('%PDF-1.4\ncontenido diferente'))).status).toBe(409);
    expect([...documentos.entries()]).toEqual(snapshot); expect(objetos.size).toBe(1); expect(saveSpy).toHaveBeenCalledTimes(1);
  });
  it.each(['billing', 'hash', 'metadata'] as const)('fallo %s no declara COMPLETO ni escribe auditoría', async (modo) => {
    storageModo = modo;
    const res = await llamar(); expect(res.status).toBe(503);
    expect(radicado().gestionAdjuntos.estado).toBe('PENDIENTE_STORAGE'); expect(radicado().archivos).toEqual([]);
    expect(documentos.has(eventoPath)).toBe(false);
    expect((await res.json()).error).toContain('No se cambió el estado');
  });
  it('fallo de Firestore conserva PENDIENTE y el objeto; reintento reutiliza sin sobrescribir', async () => {
    fallaAuditoria = true;
    expect((await llamar()).status).toBe(500); expect(radicado().gestionAdjuntos.estado).toBe('PENDIENTE_STORAGE');
    expect(objetos.size).toBe(1); expect(documentos.has(eventoPath)).toBe(false);
    fallaAuditoria = false;
    expect((await llamar()).status).toBe(200); expect(objetos.size).toBe(1); expect(radicado().archivos).toHaveLength(1);
  });
  it('cambio concurrente del inventario no completa una custodia diferente', async () => {
    antesDeTx = () => documentos.set(docPath, {
      ...radicado(), gestionAdjuntos: { ...gestionPendiente, soportesPendientes: { ...gestionPendiente.soportesPendientes, cantidad: 3 } },
    });
    expect((await llamar()).status).toBe(409); expect(radicado().gestionAdjuntos.estado).toBe('PENDIENTE_STORAGE');
    expect(documentos.has(eventoPath)).toBe(false);
  });
  it.each(['SIN_SESION', 'FUNCIONARIO', 'JEFE_DEPENDENCIA', 'CONTROL_INTERNO'])('rechaza %s antes de tocar Storage', async (noPermitido) => {
    rol = noPermitido;
    expect((await llamar()).status).toBe(noPermitido === 'SIN_SESION' ? 401 : 403); expect(storageSpy).not.toHaveBeenCalled();
  });
  it('no modifica históricos marcados como prueba', async () => {
    documentos.set(docPath, { ...radicado(), isTest: true });
    expect((await llamar()).status).toBe(409); expect(storageSpy).not.toHaveBeenCalled();
  });
  it('no acepta PDF falso, campos de archivo adicionales ni omitir confirmación', async () => {
    const falso = formulario('No soy un PDF'); expect((await llamar(falso)).status).toBe(400);
    const duplicado = formulario(); duplicado.append('otro', new File(['%PDF'], 'otro.pdf')); expect((await llamar(duplicado)).status).toBe(400);
    const sinConfirmar = formulario(); sinConfirmar.delete('confirmacionIntegridad'); expect((await llamar(sinConfirmar)).status).toBe(400);
    expect(storageSpy).not.toHaveBeenCalled();
  });
});
