import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PREFIJO_SELLADOS } from '@/lib/sello/rutas-sellado';

const RUTA_DOCUMENTO = readFileSync(
  'app/api/licencias/expedientes/[id]/documentos/[documentoId]/sellado/route.ts',
  'utf8',
);
const RUTA_PAQUETE = readFileSync(
  'app/api/licencias/expedientes/[id]/sellados/route.ts',
  'utf8',
);

describe('rutas derivadas de sellado', () => {
  it('conserva el prefijo histórico de Storage', () => {
    expect(PREFIJO_SELLADOS).toBe('sellados/expedientes');
  });

  it('el sello individual y el paquete consumen la misma constante', () => {
    for (const source of [RUTA_DOCUMENTO, RUTA_PAQUETE]) {
      expect(source).toContain("import { PREFIJO_SELLADOS } from '@/lib/sello/rutas-sellado';");
      expect(source).toContain('`${PREFIJO_SELLADOS}/${id}/');
    }
  });
});
