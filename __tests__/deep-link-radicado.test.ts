/**
 * El enlace del expediente a su radicado de origen no se pudre en silencio.
 *
 * El tablero trabaja sobre una ventana viva de 180 días
 * (VENTANA_DIAS_STREAM, ADR-0010/R11), pero un expediente de licencia se
 * consulta durante AÑOS (vigencias de 12–36 meses). En cuanto el radicado
 * de origen supera la ventana, el clic aterrizaba en «No fue posible abrir
 * el radicado» — un mensaje que manda a pensar en permisos cuando el
 * problema es de antigüedad, y con la promesa del panel («el enlace los
 * abre») incumplida sin explicación.
 *
 * Hallazgo de la revisión adversarial del turno nocturno del 24-ago-2026.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const tablero = readFileSync(join(process.cwd(), 'app/interno/dashboard/page.tsx'), 'utf8');
const panel = readFileSync(join(process.cwd(), 'app/interno/licencias/components/PanelDetalleExpediente.tsx'), 'utf8');
const hook = readFileSync(join(process.cwd(), 'lib/hooks/useVentanillaRadicados.ts'), 'utf8');

describe('deep-link radicado — el fallo da salida SIN filtrar existencia', () => {
  it('ofrece la búsqueda avanzada como salida', () => {
    expect(tablero).toContain('Búsqueda avanzada');
  });

  it('enuncia las dos causas posibles sin confirmar cuál', () => {
    // Decir solo «fuera de la ventana» le confirmaría a un funcionario que
    // un radicado de otra dependencia EXISTE. La disyunción es deliberada.
    expect(tablero).toContain('o fuera de su dependencia');
  });

  it('la ventana citada coincide con la del stream', () => {
    // Si alguien cambia VENTANA_DIAS_STREAM, el mensaje deja de ser cierto:
    // este test obliga a actualizarlo junto con el valor.
    const m = hook.match(/VENTANA_DIAS_STREAM\s*=\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(tablero).toContain(`últimos ${m![1]} días`);
  });
});

describe('panel del expediente — la promesa del enlace está acotada', () => {
  it('advierte del límite de 180 días en vez de prometer siempre', () => {
    expect(panel).toContain('180 días');
    expect(panel).toContain('Búsqueda avanzada');
  });
});
