/**
 * Regresión del defecto de scroll del panel interno (producción,
 * 11-ago-2026): la página aparecía desplazada ~420 px con media pantalla en
 * blanco debajo del contenido.
 *
 * DIAGNÓSTICO (medido en el navegador del propietario, no deducido): las
 * causas obvias quedaron descartadas — el documento NO desbordaba
 * (`scrollHeight` 678 = `innerHeight`), el contenedor raíz SÍ cubría la
 * ventana (678) y el contenedor interno tenía su scroll correcto
 * (`clientHeight/scrollHeight` = 621/3772). Pero `scrollY` valía **420** y el
 * raíz estaba en `top: -420`: el documento creció en algún instante, el
 * navegador desplazó el `<body>` y, al volver el layout a su altura fija, el
 * desplazamiento quedó pegado (el navegador no siempre lo restaura cuando el
 * contenido se encoge).
 *
 * Se asevera el CONTRATO en el código —qué rutas bloquean el scroll de
 * página y que la regla CSS existe— no la geometría: jsdom no calcula
 * layout (todo mide 0), así que un test de scroll real pasaría siempre sin
 * proteger nada.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LAYOUT_INTERNO = readFileSync(join(process.cwd(), 'app/interno/layout.tsx'), 'utf8');
const GLOBALS = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

describe('panel interno — el body no debe desplazarse donde hay scroll propio', () => {
  it('la clase existe en globals.css y oculta el desbordamiento', () => {
    expect(GLOBALS).toMatch(/body\.sin-scroll-de-pagina\s*\{[^}]*overflow:\s*hidden/);
  });

  it('el layout la aplica y la retira al salir de la ruta (no la deja pegada)', () => {
    expect(LAYOUT_INTERNO).toContain("classList.add('sin-scroll-de-pagina')");
    expect(LAYOUT_INTERNO).toContain("classList.remove('sin-scroll-de-pagina')");
  });

  it('sanea el desplazamiento heredado de una sesión ya corrida', () => {
    expect(LAYOUT_INTERNO).toContain('window.scrollTo(0, 0)');
  });

  it('cubre Dashboard y Licencias — las dos pantallas con altura fija y scroll interno', () => {
    const lista = LAYOUT_INTERNO.match(/RUTAS_CON_SCROLL_PROPIO\s*=\s*\[([^\]]*)\]/);
    expect(lista, 'no se encontró la lista de rutas').not.toBeNull();
    expect(lista![1]).toContain('/interno/dashboard');
    expect(lista![1]).toContain('/interno/licencias');
  });

  it('NO cubre Recepción ni Login: dependen del scroll de página y quedarían con contenido inalcanzable', () => {
    const lista = LAYOUT_INTERNO.match(/RUTAS_CON_SCROLL_PROPIO\s*=\s*\[([^\]]*)\]/)![1];
    expect(lista).not.toContain('/interno/recepcion');
    expect(lista).not.toContain('/interno/login');
  });
});
