import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registrarDescargaAuditoria } from '@/lib/seguridad/auditoria-descargas';

const mockAdd = vi.fn();
const mockCollection = vi.fn(() => ({ add: mockAdd }));

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({ collection: mockCollection }),
}));

const BASE_PARAMS = {
  evento: 'ARCHIVO_DESCARGA_AUTORIZADA' as const,
  radicadoId: '1-WEB-2026-00000001',
  archivoNombre: 'oficio.pdf',
  tipoArchivo: 'respuestaOficial' as const,
  actorUid: 'uid-abc123',
  actorNombre: 'María López',
  actorRol: 'FUNCIONARIO',
  actorTenant: 'SEC_GOBIERNO',
};

describe('registrarDescargaAuditoria (H-N04)', () => {
  beforeEach(() => {
    mockAdd.mockReset();
    mockCollection.mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  it('escribe evento AUTORIZADA con todos los campos requeridos', async () => {
    await registrarDescargaAuditoria({ ...BASE_PARAMS, ip: '10.0.0.1', userAgent: 'curl/8.0' });
    expect(mockCollection).toHaveBeenCalledWith('seguridad_descargas_auditoria');
    expect(mockAdd).toHaveBeenCalledTimes(1);
    const doc = mockAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.evento).toBe('ARCHIVO_DESCARGA_AUTORIZADA');
    expect(doc.radicadoId).toBe('1-WEB-2026-00000001');
    expect(doc.archivoNombre).toBe('oficio.pdf');
    expect(doc.tipoArchivo).toBe('respuestaOficial');
    expect(doc.actorUid).toBe('uid-abc123');
    expect(doc.actorNombre).toBe('María López');
    expect(doc.expiresAt).toBeInstanceOf(Date);
    expect(typeof doc.fecha).toBe('string');
  });

  it('escribe evento DENEGADA con motivo', async () => {
    await registrarDescargaAuditoria({
      ...BASE_PARAMS,
      evento: 'ARCHIVO_DESCARGA_DENEGADA',
      motivo: 'ROL_NO_AUTORIZADO',
      tipoArchivo: null,
    });
    const doc = mockAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.evento).toBe('ARCHIVO_DESCARGA_DENEGADA');
    expect(doc.motivo).toBe('ROL_NO_AUTORIZADO');
    expect(doc.tipoArchivo).toBeNull();
  });

  it('hashea IP y userAgent — no los guarda en claro', async () => {
    await registrarDescargaAuditoria({ ...BASE_PARAMS, ip: '192.168.1.100', userAgent: 'Mozilla/5.0 (curl)' });
    const doc = mockAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.ip).toBeUndefined();
    expect(doc.userAgent).toBeUndefined();
    expect(typeof doc.ipHash).toBe('string');
    expect((doc.ipHash as string).length).toBe(64); // SHA-256 hex
    expect(doc.ipHash).not.toContain('192.168');
    expect(typeof doc.userAgentHash).toBe('string');
  });

  it('trunca archivoNombre y actorNombre a límites defensivos', async () => {
    await registrarDescargaAuditoria({
      ...BASE_PARAMS,
      archivoNombre: 'a'.repeat(500),
      actorNombre: 'b'.repeat(500),
    });
    const doc = mockAdd.mock.calls[0][0] as Record<string, unknown>;
    expect((doc.archivoNombre as string).length).toBe(200);
    expect((doc.actorNombre as string).length).toBe(120);
  });

  it('no lanza si Firestore falla — fire-and-forget', async () => {
    mockAdd.mockRejectedValueOnce(new Error('Firestore down'));
    await expect(registrarDescargaAuditoria(BASE_PARAMS)).resolves.toBeUndefined();
  });
});
