import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RadicarSolicitudModal } from '@/app/interno/licencias/components/RadicarSolicitudModal';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   EL AVISO DEL CANDADO R10 GANA CUSTODIO (31-ago-2026).

   Hasta el rediseño visual de los modales de Licencias, este texto —el que
   le dice a la funcionaria que el número que va a ver es de DEMOSTRACIÓN,
   no un consecutivo legal— vivía en un `<p>` plano y NINGUNA prueba lo
   miraba: ni como literal, ni dentro de una consulta de testing-library
   (verificado por barrido completo — `grep` de la frase y `grep` de
   consultas RTL sobre ella, ADR-0039 §4 — antes de escribir esta prueba,
   cero coincidencias). El rediseño lo convirtió en banner ámbar y le dio un
   lead nuevo («Modo demostración (esPrueba)»); el custodio nace AHORA, con
   el texto nuevo, para que la próxima reescritura no pueda recortar o
   suavizar la mitad que protege sin que la suite se entere.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA:
     · que el banner de `RadicarSolicitudModal` exista con el lead «Modo
       demostración (esPrueba)», en semibold;
     · que la segunda mitad —el aviso del candado de la serie legal— esté
       COMPLETA y textual: «la emisión con consecutivo legal está bloqueada
       hasta autorizar la siembra (R10)».
   Esto NO mira: estilos de color/fondo del banner (JSDOM no pinta CSS, solo
   guarda el atributo `style` como texto), ni el resto del encabezado
   (eyebrow, título — sin custodio propio todavía).

   MUTACIÓN REALIZADA (ADR-0039 §2, antes de dar esta prueba por buena):
   se simuló la simplificación que alguien haría "limpiando copy largo" —
   borrar la segunda mitad y dejar solo el lead. Con
   `{' — la emisión con consecutivo legal está bloqueada hasta autorizar la siembra (R10).'}`
   eliminado de `RadicarSolicitudModal.tsx`, la segunda prueba de este
   archivo (y ninguna otra de la suite) se puso ROJA — 1 falla, exactamente
   la que debía fallar. Se revirtió la mutación después de confirmarlo.

   EXCLUSIÓN CONSCIENTE: `CrearDesdeRadicadoModal`. Su párrafo de esPrueba
   en el encabezado NO habla del candado R10 — declara el vínculo único con
   el radicado de origen («el vínculo es único, un radicado ya vinculado no
   puede volver a usarse»). El aviso del candado R10 que SÍ existe en ese
   modal vive en la pantalla de CONFIRMACIÓN (`!constanciaEnviada`), que este
   rediseño no tocó y que ya cubre —aunque solo de forma parcial, sin anclar
   el final de la frase— `__tests__/crear-desde-radicado-form.test.tsx`
   ("constancia NO enviada..."). Por eso este custodio no incluye ese modal:
   no es un olvido, es un alcance distinto y así queda escrito.
══════════════════════════════════════════════════════════════ */

describe('el banner de "Recibir solicitud" no puede perder el aviso del candado R10', () => {
  it('existe con el lead "Modo demostración (esPrueba)" en semibold', () => {
    render(<RadicarSolicitudModal onCerrar={vi.fn()} />);

    const lead = screen.getByText('Modo demostración (esPrueba)');
    expect(lead).toBeTruthy();
    expect(lead.className, 'el lead dejó de ser semibold').toMatch(/font-semibold/);
  });

  it('la segunda mitad —el candado de la serie legal— está completa, no recortada', () => {
    render(<RadicarSolicitudModal onCerrar={vi.fn()} />);

    expect(
      screen.getByText(/la emisión con consecutivo legal está bloqueada hasta autorizar la siembra \(R10\)\.$/),
      'el aviso del candado R10 se recortó o se suavizó',
    ).toBeTruthy();
  });
});
