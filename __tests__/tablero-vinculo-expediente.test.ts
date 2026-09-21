/**
 * Tablero — señal del expediente de licencias vinculado a un radicado.
 *
 * CONTEXTO (handoff radicado⇄expediente, Bloque A·A4 / ADR-0026): el mismo
 * caso vive legítimamente en DOS bandejas — la de trámites vigila el término
 * de respuesta al ciudadano (`ventanilla_radicados`) y la de Licencias el
 * ciclo jurídico del D.1077/2015 (`expedientes_licencias`). No es duplicación.
 *
 * EL DEFECTO QUE ESTO CUSTODIA: el vínculo se escribe en
 * `ventanilla_radicados/{id}.vinculoExpediente` dentro de la MISMA transacción
 * que crea el expediente, pero el tablero no lo leía en ninguna parte — el
 * dato existía y no se usaba. La funcionaria veía el radicado «sin clasificar»
 * sin forma de saber que ya se gestionaba como expediente ni cómo llegar a él.
 *
 * Se asevera el CONTRATO en el código —que la señal existe, a dónde enlaza y
 * que está en las dos vistas— y no el render: `TablaRadicados` y
 * `ChipExpedienteVinculado` son internos de la página (no exportados), así que
 * no se pueden montar sueltos. Mismo criterio que
 * `interno-scroll-pagina.test.tsx`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TABLERO = readFileSync(join(process.cwd(), 'app/interno/dashboard/page.tsx'), 'utf8');

describe('tablero — el radicado muestra su expediente de licencias vinculado', () => {
  it('la señal existe y lee el vínculo del propio radicado', () => {
    expect(TABLERO).toContain('function ChipExpedienteVinculado');
    expect(TABLERO).toMatch(/vinculo:\s*VentanillaRadicado\['vinculoExpediente'\]/);
  });

  it('enlaza por expedienteId — el número es etiqueta, no dirección', () => {
    /* El `numeroExpediente` (p. ej. `DEMO-26-a1b2c3d4`) es lo que se MUESTRA;
       la ruta se arma con el `expedienteId`, que es la identidad real del
       documento. Enlazar por el número llevaría a un 404. */
    expect(TABLERO).toMatch(/href=\{`\/interno\/licencias\/\$\{vinculo\.expedienteId\}`\}/);
  });

  it('no pinta nada cuando el radicado no tiene expediente', () => {
    // Un radicado sin expediente es el caso NORMAL, no una anomalía que señalar.
    expect(TABLERO).toMatch(/if\s*\(!vinculo\)\s*return null;/);
  });

  it('detiene la propagación del clic — navegar no debe además seleccionar la fila', () => {
    /* La fila y la tarjeta enteras seleccionan el radicado al hacer clic. Sin
       `stopPropagation`, pulsar el enlace haría las DOS cosas: abrir el
       expediente y seleccionar el radicado detrás. Regresión sutil y molesta. */
    expect(TABLERO).toMatch(/onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);
  });

  it('está en las DOS vistas: tarjetas (móvil) y tabla (escritorio)', () => {
    /* La bandeja se pinta dos veces —tarjetas bajo `xl` y tabla por encima—.
       Si la señal se cae de una, desaparece en ese tamaño sin que nadie lo
       note: por eso se cuentan los usos, no solo su existencia. */
    const usos = TABLERO.match(/<ChipExpedienteVinculado\s+vinculo=\{r\.vinculoExpediente\}\s*\/>/g);
    expect(usos, 'no se encontró el uso del chip').not.toBeNull();
    expect(usos!.length, 'debe usarse en tarjetas Y en tabla').toBe(2);
  });
});
