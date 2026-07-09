import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { MEDIO_RECEPCION_LABEL, labelMedioRecepcion } from '@/lib/institucion';
import type { MedioRecepcion } from '@/src/types/ventanilla';

/* ══════════════════════════════════════════════════════════════
   PQRSD verbal (P-GSC-8200-170-014 / Ley 1755 art. 15) — la
   petición de palabra se radica marcando explícitamente el medio
   verbal presencial o telefónico, en todas las superficies.
══════════════════════════════════════════════════════════════ */

// El type-check es parte del test: si el union pierde los medios
// verbales, esta asignación deja de compilar.
const MEDIOS_VERBALES: MedioRecepcion[] = ['VERBAL_PRESENCIAL', 'VERBAL_TELEFONICO'];

describe('PQRSD verbal — medio explícito', () => {
  it('las etiquetas institucionales nombran lo verbal en lenguaje claro', () => {
    expect(labelMedioRecepcion('VERBAL_PRESENCIAL')).toBe('Verbal presencial');
    expect(labelMedioRecepcion('VERBAL_TELEFONICO')).toBe('Verbal telefónica');
    for (const medio of MEDIOS_VERBALES) {
      expect(MEDIO_RECEPCION_LABEL[medio]).toBeTruthy();
    }
  });

  it('la Radicación Rápida ofrece los dos medios verbales', () => {
    const form = readFileSync('app/interno/recepcion/components/RadicacionFuncionarioForm.tsx', 'utf8');
    expect(form).toContain("['VERBAL_PRESENCIAL', 'Verbal presencial']");
    expect(form).toContain("['VERBAL_TELEFONICO', 'Verbal telefónica']");
  });

  it('comprobante y constancia por correo saben nombrar lo verbal', () => {
    for (const archivo of [
      'app/interno/dashboard/components/ComprobanteRadicado.tsx',
      'lib/email/templates/constancia-radicacion.ts',
    ]) {
      const fuente = readFileSync(archivo, 'utf8');
      expect(fuente).toContain('VERBAL_PRESENCIAL');
      expect(fuente).toContain('VERBAL_TELEFONICO');
    }
  });

  it('lo verbal comparte la serie PRESENCIAL del consecutivo', () => {
    const accion = readFileSync('lib/actions/radicarVentanilla.ts', 'utf8');
    expect(accion).toContain("medio === 'VERBAL_PRESENCIAL'");
    expect(accion).toContain("|| medio === 'VERBAL_TELEFONICO') return 'PRESENCIAL';");
  });
});
