import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

/**
 * Bloque "Integración UI y demo" — cableado de las rutas de expedientes de
 * licencias (grep de fuente, mismo patrón que
 * `__tests__/subsanacion-rutas.test.ts`).
 */

const R = (p: string) => readFileSync(`app/api/licencias/expedientes/${p}`, 'utf8');
const MODULO = readFileSync('lib/server/expedientes-licencias.ts', 'utf8');

/**
 * Los nombres `emitirNumeroExpedienteReal`/`leerConsecutivosLegales`/
 * `confirmarConsecutivosLegales` APARECEN en prosa de JSDoc (documentando
 * precisamente que NO se llaman) — por eso el contrato busca la FORMA de
 * un `import ... from '<módulo>'` real, no una coincidencia de substring
 * cruda, que daría falso positivo contra su propia documentación.
 */
function importaDe(fuente: string, especificadorModulo: string): boolean {
  const patron = new RegExp(`from\\s+['"][^'"]*${especificadorModulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
  return patron.test(fuente);
}

describe('módulo de decisión — candado presente y con su valor cerrado', () => {
  it('lib/server/expedientes-licencias.ts declara EMISION_REAL_EXPEDIENTES_HABILITADA = false', () => {
    expect(MODULO).toMatch(/EMISION_REAL_EXPEDIENTES_HABILITADA\s*=\s*false\s*as\s*const/);
  });

  it('el módulo NO importa emitir-numero-expediente (la función real de emisión no se trae para nada del camino demo)', () => {
    expect(importaDe(MODULO, 'emitir-numero-expediente')).toBe(false);
  });

  it('el módulo NO importa consecutivo-legal', () => {
    expect(importaDe(MODULO, 'consecutivo-legal')).toBe(false);
  });
});

describe('POST /api/licencias/expedientes — creación (camino demo, candado)', () => {
  const s = R('route.ts');

  it('NO importa el módulo de emisión real por fuera del candado', () => {
    expect(importaDe(s, 'emitir-numero-expediente')).toBe(false);
  });
  it('NO importa lib/server/consecutivo-legal', () => {
    expect(importaDe(s, 'consecutivo-legal')).toBe(false);
  });
  it('usa canOperateTenant + requireActiveInternalUser (patrón de auth del repo)', () => {
    expect(s).toContain('canOperateTenant');
    expect(s).toContain('requireActiveInternalUser');
  });
  it('llama a planCrearExpedienteDemo (la decisión vive en el módulo puro, no inline en la ruta)', () => {
    expect(s).toContain('planCrearExpedienteDemo');
  });
  it('el reloj es server-side (const ahora = new Date())', () => {
    expect(s).toContain('const ahora = new Date()');
  });
});

describe('GET /api/licencias/expedientes — bandeja del tenant', () => {
  const s = R('route.ts');

  it('filtra por tenantId con where, y NO combina orderBy en el query (evita índice compuesto no desplegado)', () => {
    expect(s).toMatch(/where\(\s*['"]tenantId['"]/);
    expect(s).not.toMatch(/\.where\([^)]*\)\s*\.orderBy\(/);
  });
  it('ordena en el handler (con .sort(), no con Firestore)', () => {
    expect(s).toContain('.sort(');
  });
});

describe('GET /api/licencias/expedientes/[id] — detalle + actuaciones', () => {
  const s = R('[id]/route.ts');

  it('ordena la subcolección actuaciones por fecha asc en el propio query (sin índice compuesto: un solo orderBy, sin where)', () => {
    expect(s).toMatch(/orderBy\(\s*['"]fecha['"]\s*,\s*['"]asc['"]\s*\)/);
  });
  it('valida permiso con canOperateTenant sobre el tenantId del documento', () => {
    expect(s).toContain('canOperateTenant');
  });
});

describe('POST /api/licencias/expedientes/[id]/actuaciones — registro de hechos', () => {
  const s = R('[id]/actuaciones/route.ts');

  it('llama a planRegistrarActuacion (decisión en el módulo puro)', () => {
    expect(s).toContain('planRegistrarActuacion');
  });
  it('NO importa nada de termino.ts (el efecto sobre el término sigue ⚖️ bloqueado, esta ruta no lo toca)', () => {
    expect(s).not.toContain("from '@/lib/motor-expedientes/termino'");
    expect(s).not.toContain('calcularVencimiento');
  });
  it('el reloj es server-side (const ahora = new Date())', () => {
    expect(s).toContain('const ahora = new Date()');
  });
});

describe('ninguna ruta bajo app/api/licencias importa vigencias.ts (⚖️ hueco 3, mismo candado que el test dedicado)', () => {
  it.each(['route.ts', '[id]/route.ts', '[id]/actuaciones/route.ts'])('%s', (archivo) => {
    const s = R(archivo);
    expect(s).not.toContain('motor-expedientes/vigencias');
  });
});
