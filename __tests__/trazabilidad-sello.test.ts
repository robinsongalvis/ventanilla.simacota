import { describe, expect, it } from 'vitest';
import type { AccionAuditoria } from '@/src/types/radicado';
import type { TrazabilidadRadicado } from '@/src/types/ventanilla';
import { aLineaTiempoPublica } from '@/lib/seguridad/consulta-publica-radicado';

/* ══════════════════════════════════════════════════════════════
   Sprint Ventanilla Operativa 3 — trazabilidad del sello.

   Verifica que:
   1. El enum AccionAuditoria incluye 'DOCUMENTO_SELLADO'.
   2. El evento NO se mapea a la línea de tiempo pública del
      ciudadano — es información operativa interna.
══════════════════════════════════════════════════════════════ */

describe('Sprint Op 3 — trazabilidad del sello', () => {
  /* 1 */
  it('AccionAuditoria incluye DOCUMENTO_SELLADO', () => {
    const accion: AccionAuditoria = 'DOCUMENTO_SELLADO';
    expect(accion).toBe('DOCUMENTO_SELLADO');
  });

  /* 2 — aLineaTiempoPublica excluye el evento. */
  it('aLineaTiempoPublica excluye DOCUMENTO_SELLADO', () => {
    const eventos: TrazabilidadRadicado[] = [
      {
        fecha: '2026-07-02T13:00:00.000Z',
        accion: 'RADICACION',
        actorUid: 'u',
        actorNombre: 'Funcionaria',
        nota: 'Radicación inicial',
      },
      {
        fecha: '2026-07-02T13:00:05.000Z',
        accion: 'DOCUMENTO_SELLADO',
        actorUid: 'u',
        actorNombre: 'Funcionaria',
        nota: 'Documento oficio.pdf sellado por Ventanilla.',
        metadata: {
          archivoOriginalPath: 'radicados/1-OFICIO-2026-00000042/1234_oficio.pdf',
          archivoSelladoPath:  'sellados/1-OFICIO-2026-00000042/1234_oficio.pdf',
          hashOriginal: 'abc',
          hashSellado:  'def',
          paginasEstampadas: 1,
        },
      },
    ];
    const publica = aLineaTiempoPublica(eventos);
    expect(publica).toHaveLength(1);
    expect(publica[0].evento).toBe('Solicitud recibida');
    expect(publica.every((p) => !/sellad/i.test(p.evento))).toBe(true);
  });
});
