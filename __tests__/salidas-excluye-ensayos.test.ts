/**
 * El libro de salidas no puede mostrar ensayos.
 *
 * VISTO EN PRODUCCIÓN el 29-sep-2026: el libro mostraba
 * `2-SAL-2026-00000006`, una salida de ensayo a nombre de un ciudadano real.
 * Su enlace apuntaba al radicado de origen, que SÍ estaba marcado como prueba y
 * por tanto oculto — así que al pulsarlo la funcionaria recibía «No fue posible
 * abrir el radicado», un mensaje que nunca podría llevarla a ninguna parte.
 *
 * LA CAUSA no era el mensaje ni el dato suelto: `useVentanillaRadicados`
 * filtraba `isTest`/`excludeFromMetrics` y `useSalidas` no. Marcar un documento
 * como prueba solo sirve si TODAS las vistas leen la marca; basta una que no la
 * lea para que el libro oficial de correspondencia despachada del municipio
 * muestre envíos que nunca ocurrieron.
 *
 * Se custodia la SIMETRÍA entre ambos hooks, que es lo que se rompió.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (r: string) => readFileSync(join(process.cwd(), r), 'utf8');
const SALIDAS = leer('lib/hooks/useSalidas.ts');
const RADICADOS = leer('lib/hooks/useVentanillaRadicados.ts');

describe('el libro de salidas excluye los datos de ensayo', () => {
  it('useSalidas filtra isTest y excludeFromMetrics', () => {
    expect(SALIDAS).toMatch(/\.filter\(\(s\) => !s\.isTest && !s\.excludeFromMetrics\)/);
  });

  it('usa las MISMAS dos marcas que los radicados — sin simetría, la marca miente', () => {
    /* Si un día se añade una tercera marca a radicados y no aquí, vuelve el
       mismo defecto: un dato marcado que una vista oculta y otra enseña. */
    for (const marca of ['isTest', 'excludeFromMetrics']) {
      expect(RADICADOS, `radicados debe seguir filtrando ${marca}`).toContain(marca);
      expect(SALIDAS, `salidas debe filtrar ${marca}`).toContain(marca);
    }
  });

  it('el filtro se aplica al construir la lista, no solo al pintarla', () => {
    /* Filtrar en el render dejaría los ensayos dentro del estado: cualquier
       contador, exportación o búsqueda posterior volvería a incluirlos. */
    expect(SALIDAS).toMatch(/setSalidas\(\s*snap\.docs[\s\S]{0,400}?\.filter\(/);
  });
});
