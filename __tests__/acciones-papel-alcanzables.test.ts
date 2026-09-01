import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* ══════════════════════════════════════════════════════════════
   NINGUNA ACCIÓN DE PAPEL APUNTA A UNA RUTA QUE NO EXISTE.

   El hallazgo que motiva esto (31-ago-2026, reportado por el propietario en
   pleno ensayo): la fila «Descargar documentos con sello» del detalle enlazaba
   a `/api/licencias/expedientes/{id}/sellados` — una API que NUNCA existió.
   La fila daba 404 desde el día que se pintó, también en producción, y
   ninguna prueba lo vigilaba. Es la QUINTA aparición de la familia de
   alcanzabilidad, esta vez invertida: no «construido y nunca pintado» —
   PINTADO Y NUNCA CONSTRUIDO.

   CÓMO VIGILA (mismo patrón que el gate de índices en
   `verificar-indices.test.ts`: extraer del fuente lo declarado y contrastarlo
   contra el SISTEMA DE ARCHIVOS, que es el hecho): se extraen los `href` de
   `accionesDePapel` y se exige que cada uno tenga su `route.ts` en `app/api`.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA:
     · que cada `href` de las acciones de papel del detalle de licencias
       resuelva a un `route.ts` existente (los segmentos dinámicos
       interpolados se mapean a `[id]`);
     · que la lista NO quede vacía (si el extractor deja de encontrar
       acciones, es el extractor el que se rompió — no hay nada «cubierto»).
   Esto NO mira: que la ruta RESPONDA bien (eso es de sus pruebas de
   ejecución), ni las filas con `onClick` (navegan dentro de la página y no
   tienen ruta que existir), ni enlaces de otras pantallas.
══════════════════════════════════════════════════════════════ */

const RAIZ = process.cwd();
const FUENTE = readFileSync(
  join(RAIZ, 'app/interno/licencias/[expedienteId]/DetalleLicenciaClient.tsx'),
  'utf8',
);

/** Los href de `accionesDePapel`, tal como están escritos en el fuente. */
function hrefsDeAccionesDePapel(): string[] {
  const bloque = FUENTE.slice(
    FUENTE.indexOf('const accionesDePapel'),
    FUENTE.indexOf('];', FUENTE.indexOf('const accionesDePapel')),
  );
  return [...bloque.matchAll(/href:\s*`([^`]+)`/g)].map((m) => m[1]);
}

/** `/api/licencias/expedientes/${…}/constancia` → app/api/licencias/expedientes/[id]/constancia/route.ts */
function rutaEnDisco(href: string): string {
  const conDinamicos = href.replace(/\$\{[^}]+\}/g, '[id]');
  return join(RAIZ, 'app', ...conDinamicos.split('/').filter(Boolean), 'route.ts');
}

describe('las acciones de papel del detalle de licencias llevan a rutas que existen', () => {
  const hrefs = hrefsDeAccionesDePapel();

  it('el extractor encuentra acciones (si esto falla, se rompió el extractor, no hay nada cubierto)', () => {
    expect(hrefs.length, 'accionesDePapel quedó sin href extraíbles — revisar el extractor antes que nada').toBeGreaterThan(0);
  });

  it.each(hrefs.map((h) => [h]))('%s tiene su route.ts', (href) => {
    const enDisco = rutaEnDisco(href);

    expect(
      existsSync(enDisco),
      `La acción de papel enlaza a «${href}» y NO existe ${enDisco.replace(RAIZ + '/', '')}. `
      + 'Ese botón da 404 en la pantalla de la funcionaria — «pintado y nunca construido». '
      + 'O se construye la ruta, o la fila cambia de destino: no se deja el enlace muerto.',
    ).toBe(true);
  });

  /* REESCRITA el 1-sep-2026, conforme al ADR-0039 §3 y a su propia promesa:
     esta prueba prohibía el enlace a /sellados «hasta que se construya — y
     entonces se actualiza CON ese acto». El acto llegó: el propietario definió
     el paquete (un solo PDF, constancia de primera hoja, documentos sellados)
     y la ruta existe desde esta misma PR.

     QUÉ SE RETIRA: la prohibición del href. QUÉ SOBREVIVE: que el destino
     EXISTA — el it.each de arriba ahora exige el route.ts de /sellados igual
     que el de los demás. Y esta prueba pasa a vigilar la regresión nueva: que
     la fila no vuelva al parche intermedio (abrir una pestaña) perdiendo la
     descarga que su etiqueta promete. */
  it('la fila del sello ES el enlace de descarga a /sellados (la ruta ya existe)', () => {
    expect(
      hrefs.some((h) => h.includes('/sellados')),
      'la fila «Descargar documentos con sello» dejó de enlazar al paquete /sellados — '
      + 'si volvió a ser un salto de pestaña u otro destino, la etiqueta vuelve a mentir',
    ).toBe(true);
  });
});
