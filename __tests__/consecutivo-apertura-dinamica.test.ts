import { describe, expect, it, vi } from 'vitest';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { formatearRadicadoInstitucional } from '@/lib/radicado-institucional';
import type {
  AperturaUnicaRadicados,
  AuditoriaAperturaUnicaRadicados,
} from '@/lib/server/apertura-series';
import {
  confirmarConsecutivosLegales,
  leerConsecutivosLegales,
} from '@/lib/server/consecutivo-legal';

const FECHA = new Date('2026-09-30T15:00:00.000Z');
const AUDITORIA_ID = 'audit-apertura-unica';

function apertura(primerNumero: number): AperturaUnicaRadicados {
  return {
    version: 1,
    estado: 'BLOQUEADA',
    serie: 'radicados',
    anio: 2026,
    veniaDe: 27,
    abiertoEn: primerNumero,
    primerNumero,
    ultimoInicial: primerNumero - 1,
    fecha: FECHA.toISOString(),
    fechaHoraBogota: '2026-09-30T10:00:00.000-05:00',
    autorizadoPor: 'Secretaría de Gobierno',
    referencia: 'docs/actas/apertura.md',
    auditoriaId: AUDITORIA_ID,
    actorUid: 'admin-1',
    actorNombre: 'Administración',
    actorRol: 'ADMIN',
    tenantId: 'VENTANILLA_UNICA',
  };
}

function auditoria(a: AperturaUnicaRadicados): AuditoriaAperturaUnicaRadicados {
  return {
    accion: 'APERTURA_SERIE_RADICADOS_CONFIRMADA',
    actorUid: a.actorUid,
    actorNombre: a.actorNombre,
    actorRol: a.actorRol,
    tenantId: a.tenantId,
    fecha: a.fecha,
    fechaHoraBogota: a.fechaHoraBogota,
    referencia: a.referencia,
    metadata: {
      serie: 'radicados',
      anio: a.anio,
      anterior: a.veniaDe,
      primerNumero: a.primerNumero,
      nuevoUltimo: a.ultimoInicial,
      estado: 'BLOQUEADA',
      proximoRadicado: formatearRadicadoInstitucional(a.primerNumero, FECHA),
    },
  };
}

function dobles(ultimo: number, valorApertura?: unknown, valorAuditoria?: unknown) {
  const docs = new Map<string, Record<string, unknown>>();
  docs.set('counters/radicados-2026', {
    ultimo,
    ...(valorApertura === undefined ? {} : { apertura: valorApertura }),
  });
  if (typeof valorAuditoria === 'object' && valorAuditoria !== null && !Array.isArray(valorAuditoria)) {
    docs.set(`admin_auditoria/${AUDITORIA_ID}`, valorAuditoria as Record<string, unknown>);
  }
  const get = vi.fn(async (ref: { path: string }) => ({
    exists: docs.has(ref.path),
    data: () => docs.get(ref.path),
  }));
  const set = vi.fn();
  const create = vi.fn();
  const db = { doc: (path: string) => ({ path }) } as Firestore;
  const tx = { get, set, create } as unknown as Transaction;
  return { db, tx, get, set, create };
}

describe('emisión con apertura única dinámica', () => {
  it('emite N y luego N+1 para una apertura configurable distinta de 1745', async () => {
    const a = apertura(1755);
    const primera = dobles(1754, a, auditoria(a));
    const pendientesPrimera = await leerConsecutivosLegales(
      primera.tx,
      primera.db,
      FECHA,
      [{
        serie: 'radicados',
        formatear: formatearRadicadoInstitucional,
        exigeAperturaUnicaRadicados: true,
      }],
    );
    expect(pendientesPrimera[0]).toMatchObject({
      consecutivo: 1755,
      documentoId: '1-110-202609-00001755',
    });
    confirmarConsecutivosLegales(primera.tx, FECHA, pendientesPrimera);
    expect(primera.create).toHaveBeenCalledWith(
      { path: 'unicidad_radicados/1-110-202609-00001755' },
      expect.objectContaining({ consecutivo: 1755 }),
    );
    expect(primera.set).toHaveBeenCalledWith(
      { path: 'counters/radicados-2026' },
      expect.objectContaining({ ultimo: 1755 }),
      { merge: true },
    );

    const segunda = dobles(1755, a, auditoria(a));
    const pendientesSegunda = await leerConsecutivosLegales(
      segunda.tx,
      segunda.db,
      FECHA,
      [{
        serie: 'radicados',
        formatear: formatearRadicadoInstitucional,
        exigeAperturaUnicaRadicados: true,
      }],
    );
    expect(pendientesSegunda[0]).toMatchObject({
      consecutivo: 1756,
      documentoId: '1-110-202609-00001756',
    });
  });

  it.each([
    ['sin apertura', undefined, undefined],
    ['apertura parcial', { abiertoEn: 1755 }, undefined],
    ['sin auditoría', apertura(1755), undefined],
    ['auditoría alterada', apertura(1755), { accion: 'OTRA' }],
  ])('falla cerrado %s y no reserva ni avanza', async (_caso, a, audit) => {
    const { db, tx, set, create } = dobles(1754, a, audit);
    await expect(leerConsecutivosLegales(
      tx,
      db,
      FECHA,
      [{
        serie: 'radicados',
        formatear: formatearRadicadoInstitucional,
        exigeAperturaUnicaRadicados: true,
      }],
    )).rejects.toThrow(/apertura formal autorizada/);
    expect(set).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('falla cerrado si el contador retrocede por debajo de N-1', async () => {
    const a = apertura(1755);
    const { db, tx, set, create } = dobles(27, a, auditoria(a));
    await expect(leerConsecutivosLegales(
      tx,
      db,
      FECHA,
      [{
        serie: 'radicados',
        formatear: formatearRadicadoInstitucional,
        exigeAperturaUnicaRadicados: true,
      }],
    )).rejects.toThrow(/apertura formal autorizada/);
    expect(set).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
