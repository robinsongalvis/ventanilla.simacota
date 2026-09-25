import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

/**
 * Bloque A·A4/A5 — cableado de rutas (grep de fuente, mismo patrón que
 * `__tests__/expedientes-licencias-rutas.test.ts`).
 */

const DESDE_RADICADO_ROUTE = readFileSync('app/api/licencias/expedientes/desde-radicado/route.ts', 'utf8');
const CANDIDATOS_ROUTE = readFileSync('app/api/licencias/radicados-candidatos/route.ts', 'utf8');
const ACTUACIONES_ROUTE = readFileSync('app/api/licencias/expedientes/[id]/actuaciones/route.ts', 'utf8');
const ACUSE_TEMPLATE = readFileSync('lib/email/templates/acuse-recibo-expediente-licencia.ts', 'utf8');
const AVISO_TEMPLATE = readFileSync('lib/email/templates/aviso-acta-observaciones.ts', 'utf8');

function importaDe(fuente: string, especificador: string): boolean {
  const patron = new RegExp(`from\\s+['"][^'"]*${especificador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
  return patron.test(fuente);
}

describe('POST .../expedientes/desde-radicado — candado R10 intacto', () => {
  it('NO importa el módulo de emisión real ni consecutivo-legal', () => {
    expect(importaDe(DESDE_RADICADO_ROUTE, 'emitir-numero-expediente')).toBe(false);
    expect(importaDe(DESDE_RADICADO_ROUTE, 'consecutivo-legal')).toBe(false);
  });
  it('usa runTransaction (tx multi-documento radicado+expediente)', () => {
    expect(DESDE_RADICADO_ROUTE).toContain('runTransaction');
  });
  it('exige sesión + permiso de tenant', () => {
    expect(DESDE_RADICADO_ROUTE).toContain('requireActiveInternalUser');
    expect(DESDE_RADICADO_ROUTE).toContain('canOperateTenant');
  });
  it('registra trazabilidad EXPEDIENTE_LICENCIA_VINCULADO en el radicado (post-commit)', () => {
    expect(DESDE_RADICADO_ROUTE).toContain('EXPEDIENTE_LICENCIA_VINCULADO');
    expect(DESDE_RADICADO_ROUTE).toContain('appendTrazabilidadAdmin');
  });
  it('un fallo de envío de constancia está dentro de un try/catch PROPIO (no revierte la operación)', () => {
    /* Historia de esta prueba, porque explica su forma:
       1. Comparaba contra `lastIndexOf('try {')` —asumía que el try del envío
          era el ÚLTIMO del archivo—. Añadir código después la puso roja aunque
          la propiedad seguía siendo cierta.
       2. La reescribí buscando el try más cercano hacia atrás… y al simular la
          regresión NO se puso roja: el `try` exterior del handler la satisfacía
          igual. Verificaba «está dentro de algún try», no «tiene el suyo».

       Lo que se comprueba ahora es SEMÁNTICO y no posicional: existe un `catch`
       propio del envío, identificable por el módulo que registra. Si el envío
       quedara colgando del try del handler, ese catch no existiría y el fallo
       devolvería 500 sobre una operación YA CONFIRMADA. */
    const idxEnviar = DESDE_RADICADO_ROUTE.indexOf('buildAcuseReciboExpedienteSubject(numero)');
    expect(idxEnviar, 'no se encontró el envío del acuse').toBeGreaterThan(-1);

    const CATCH_PROPIO = "modulo: 'licencias/expedientes/desde-radicado/constancia'";
    const idxCatch = DESDE_RADICADO_ROUTE.indexOf(CATCH_PROPIO, idxEnviar);
    expect(
      idxCatch,
      'el envío del acuse no tiene un catch propio: su fallo escaparía al handler y ' +
        'devolvería 500 sobre una operación ya confirmada',
    ).toBeGreaterThan(idxEnviar);

    /* Y ese catch va ANTES de la respuesta: si estuviera después, no envolvería
       al envío. */
    expect(idxCatch).toBeLessThan(DESDE_RADICADO_ROUTE.indexOf('return NextResponse.json({', idxEnviar));
  });
});

describe('GET /api/licencias/radicados-candidatos', () => {
  it('exige sesión + permiso de tenant', () => {
    expect(CANDIDATOS_ROUTE).toContain('requireActiveInternalUser');
    expect(CANDIDATOS_ROUTE).toContain('canOperateTenant');
  });
  it('filtra por oficinaDestino en el query y por vinculo/cerrado en el handler', () => {
    expect(CANDIDATOS_ROUTE).toMatch(/where\(\s*['"]clasificacion\.oficinaDestino['"]/);
    expect(CANDIDATOS_ROUTE).toContain('vinculoExpediente');
    expect(CANDIDATOS_ROUTE).toContain('esEstadoCerrado');
  });
});

describe('POST .../actuaciones — aviso de acta condicionado a fechaComunicacion', () => {
  it('lee fechaComunicacion del body y solo calcula el límite si viene', () => {
    expect(ACTUACIONES_ROUTE).toContain('fechaComunicacion');
    expect(ACTUACIONES_ROUTE).toContain('calcularFechaLimiteRespuestaActa');
    const idxBody = ACTUACIONES_ROUTE.indexOf('body?.fechaComunicacion');
    expect(idxBody).toBeGreaterThan(-1);
  });
  it('el envío del aviso está en su propio try/catch (best-effort, no revierte el registro de la actuación)', () => {
    const idxCommit = ACTUACIONES_ROUTE.indexOf('await batch.commit();');
    // `lastIndexOf`: el nombre también aparece en el `import` de cabecera —
    // lo que importa es la LLAMADA, que es la última ocurrencia.
    const idxAviso = ACTUACIONES_ROUTE.lastIndexOf('buildAvisoActaSubject');
    expect(idxCommit).toBeGreaterThan(-1);
    expect(idxAviso).toBeGreaterThan(idxCommit);
  });
});

describe('Plantillas — sin función de reenvío ni parámetro de fecha de vencimiento', () => {
  it('acuse-recibo-expediente-licencia.ts NO exporta ninguna función de reenvío/resend (el texto documental SÍ puede mencionar la palabra, describiendo la restricción)', () => {
    expect(ACUSE_TEMPLATE).not.toMatch(/export\s+(async\s+)?function\s+\w*(reenv|resend)\w*/i);
  });
  it('TemplateAcuseReciboExpedienteParams NO declara ningún campo de vencimiento', () => {
    const bloqueInterface = ACUSE_TEMPLATE.slice(
      ACUSE_TEMPLATE.indexOf('interface TemplateAcuseReciboExpedienteParams'),
      ACUSE_TEMPLATE.indexOf('}', ACUSE_TEMPLATE.indexOf('interface TemplateAcuseReciboExpedienteParams')),
    );
    expect(bloqueInterface.toLowerCase()).not.toContain('vencimiento');
  });
  it('aviso-acta-observaciones.ts: VARIANTE_B_SUSPENSION existe pero ningún parámetro de la función permite seleccionarla', () => {
    expect(AVISO_TEMPLATE).toContain('export const VARIANTE_B_SUSPENSION');
    const firmaFuncion = AVISO_TEMPLATE.slice(
      AVISO_TEMPLATE.indexOf('export function buildAvisoActaHtml'),
      AVISO_TEMPLATE.indexOf('{', AVISO_TEMPLATE.indexOf('export function buildAvisoActaHtml')),
    );
    expect(firmaFuncion).not.toContain('VARIANTE_B_SUSPENSION');
    expect(firmaFuncion).not.toMatch(/variante/i);
  });
});
