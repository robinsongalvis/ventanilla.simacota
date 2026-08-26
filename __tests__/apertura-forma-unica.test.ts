import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { describirIncoherenciaApertura } from '@/lib/server/consecutivo-legal';

/**
 * DOS SCRIPTS ABREN CONTADORES. LOS DOS TIENEN QUE ESCRIBIR LO QUE LOS
 * VERIFICADORES LEEN.
 *
 * `scripts/operacion/abrir-series.mjs` abre las series nacidas digitales;
 * `scripts/migracion/abrir-serie-expedientes.mjs` abre la de expedientes,
 * que arrastra el libro de papel de Planeación. Escriben el MISMO tipo de
 * documento — `counters/{serie}-{año}` — y hasta el 26-ago-2026 lo escribían
 * distinto: el de migración ponía `abiertaEn` (una fecha) aplanado en la raíz,
 * en vez de `apertura.abiertoEn` (un número).
 *
 * Consecuencia: `verificarCoherenciaConApertura` y el cron de auditoría leen
 * `data()?.apertura`, recibían `undefined` y salían por su primera línea. El
 * guard quedaba INERTE precisamente en la serie que exige apertura explícita
 * — la regla del ADR-0033 §4.6: el instrumento que vigila el silencio no
 * puede filtrar por el campo que falta justo en el caso que más importa.
 *
 * Estas pruebas no comparan los dos scripts entre sí: comprueban que lo que
 * cada uno escribe SIRVE de verdad al verificador. Un contrato entre lo que
 * se escribe y lo que se lee, no entre dos archivos.
 */

const OPERACION = readFileSync('scripts/operacion/abrir-series.mjs', 'utf8');
const MIGRACION = readFileSync('scripts/migracion/abrir-serie-expedientes.mjs', 'utf8');

describe('los dos abridores escriben la forma que el verificador entiende', () => {
  it.each([
    ['operación (radicados/salidas/planillas)', OPERACION],
    ['migración (expedientes)', MIGRACION],
  ])('%s anida el registro bajo `apertura` con `abiertoEn`', (_cual, fuente) => {
    expect(fuente).toMatch(/apertura:\s*\{/);
    expect(fuente).toMatch(/abiertoEn:/);
  });

  it.each([
    ['operación', OPERACION],
    ['migración', MIGRACION],
  ])('%s NO usa las grafías que el verificador no lee', (_cual, fuente) => {
    /* Se busca la forma de ESCRITURA (`clave:`), no la mención: el comentario
       que documenta el defecto nombra las grafías viejas a propósito, y
       prohibirle a la prosa nombrar el error borraría la explicación de por
       qué existe esta prueba. */
    expect(fuente).not.toMatch(/\babiertaEn\s*:/);
    expect(fuente).not.toMatch(/\babiertaPor\s*:/);
  });

  it.each([
    ['operación', OPERACION],
    ['migración', MIGRACION],
  ])('%s deja escrito quién autoriza el salto', (_cual, fuente) => {
    expect(fuente).toMatch(/autorizadoPor/);
  });
});

describe('el verificador ve de verdad un contador abierto por cualquiera de los dos', () => {
  /* Se reconstruye aquí la forma que cada script escribe, y se pasa por la
     MISMA función que corre en producción. Si un script cambia la forma sin
     cambiar esto, la prueba de arriba lo caza; si la función de verificación
     cambia el criterio, lo caza esta. */
  const aperturaOperacion = {
    veniaDe: 27,
    abiertoEn: 1600,
    fecha: '2026-09-01T13:00:00.000Z',
    autorizadoPor: 'Secretaría General',
    motivoDelSalto: 'el libro avanza a diario',
  };
  const aperturaMigracion = {
    veniaDe: 0,
    abiertoEn: 46,
    fecha: '2026-09-01T13:00:00.000Z',
    autorizadoPor: 'scripts/migracion/abrir-serie-expedientes.mjs',
    referencia: 'Libro de Planeación confirmado el 2026-08-20',
    motivoDelSalto: 'Apertura explícita de la serie 2026 (ADR-0031).',
    libroConfirmadoEl: '2026-08-20',
  };

  it('detecta el retroceso en una serie abierta por el guion de operación', () => {
    expect(describirIncoherenciaApertura('radicados', 27, aperturaOperacion)).toMatch(/1600/);
  });

  it('detecta el retroceso en la serie de expedientes abierta por la migración', () => {
    const hallazgo = describirIncoherenciaApertura('expedientes', 3, aperturaMigracion);
    expect(hallazgo).toBeTruthy();
    expect(hallazgo).toMatch(/46/);
  });

  it('calla cuando el contador está donde debe, en ambos casos', () => {
    expect(describirIncoherenciaApertura('radicados', 1599, aperturaOperacion)).toBeNull();
    expect(describirIncoherenciaApertura('expedientes', 45, aperturaMigracion)).toBeNull();
  });

  /* La forma VIEJA de la migración, para dejar constancia de por qué esto
     existe: escrita así, el verificador no ve nada y el contador puede
     retroceder sin que nadie se entere. */
  it('con la forma aplanada anterior, el verificador quedaba ciego', () => {
    const forma_vieja = { abiertaEn: '2026-09-01T13:00:00.000Z', abiertaPor: 'script' } as never;
    expect(describirIncoherenciaApertura('expedientes', 3, forma_vieja)).toBeNull();
  });
});
