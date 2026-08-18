import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { razonDeContraste, CONTRASTE_MINIMO_AA } from './utiles/contraste-accesibilidad';

/* ══════════════════════════════════════════════════════════════
   El Centro de Control Interno debe declarar en pantalla qué NO hace.

   POR QUÉ EXISTE ESTE TEST. La frase «No reemplaza al funcionario que
   responde el radicado» es la única en pantalla que delimita la autoridad
   de Control Interno frente a quien tramita el radicado. El 18-ago-2026
   desapareció sin que nadie lo notara, al migrar el encabezado a
   SectionHeader: el componente solo admitía título y subtítulo, y el
   párrafo sobrante se cayó en silencio.

   No es microcopy decorativo. En una entidad pública, decir quién NO
   decide es parte del control — es la misma familia del Principio 9 (la
   IA propone, el funcionario decide): quien revisa no sustituye a quien
   responde.
══════════════════════════════════════════════════════════════ */

const RUTA_CI = join(process.cwd(), 'app/interno/dashboard/components/control-interno/CentroControlInterno.tsx');
const RUTA_HEADER = join(process.cwd(), 'app/components/design-system/SectionHeader.tsx');

describe('Centro de Control Interno · declaración de alcance', () => {
  const fuente = readFileSync(RUTA_CI, 'utf8');

  it('mantiene la frase que delimita su autoridad', () => {
    expect(fuente).toContain('No reemplaza al funcionario que responde el radicado');
  });

  it('la pinta mediante el encabezado del sistema de diseño, no como parche local', () => {
    // Si volviera a escribirse suelta, el próximo refactor la perdería igual.
    expect(fuente).toMatch(/nota=/);
  });
});

describe('SectionHeader · soporta la aclaración de alcance', () => {
  const fuente = readFileSync(RUTA_HEADER, 'utf8');

  it('acepta la prop nota', () => {
    expect(fuente).toMatch(/\bnota\?:\s*ReactNode;/);
    expect(fuente).toContain('{nota}');
  });

  it('la pinta con un color legible, no con el gris muted', () => {
    // --text-muted (#94A3B8) rinde 2,5:1 sobre blanco: por debajo de AA.
    // Una aclaración de alcance que no se puede leer no delimita nada.
    expect(fuente).toContain("color: 'var(--text-secondary)'");
    expect(razonDeContraste('#667085', '#FFFFFF')).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
    expect(razonDeContraste('#94A3B8', '#FFFFFF')).toBeLessThan(CONTRASTE_MINIMO_AA);
  });
});
