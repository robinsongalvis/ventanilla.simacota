import { describe, expect, it } from 'vitest';
import {
  buildConstanciaRadicacionHtml,
  buildConstanciaRadicacionSubject,
} from '@/lib/email/templates/constancia-radicacion';
import { INSTITUCION } from '@/lib/institucion';

/* ══════════════════════════════════════════════════════════════
   Sprint Ventanilla Operativa 2 — template de correo de constancia.
   Tests puros del generador de HTML; no envían correo real.
══════════════════════════════════════════════════════════════ */

const BASE_PARAMS = {
  radicadoId:        '1-WEB-2026-00000042',
  solicitanteNombre: 'Juan Pérez',
  tipoDocumento:     'CC',
  numeroDocumento:   '1098765432',
  correoSolicitante: 'juan@example.com',
  asunto:            'Solicitud de certificado',
  tipoTramite:       'Petición general',
  fechaRadicado:     '2026-07-02T13:00:00.000Z',
  fechaVencimiento:  '2026-07-23T22:00:00.000Z',
  medioRecepcion:    'PRESENCIAL',
  dependenciaNombre: 'Ventanilla Única',
  funcionarioNombre: 'Funcionaria X',
};

describe('Sprint Op 2 — buildConstanciaRadicacionHtml', () => {
  /* 1 */
  it('incluye radicado, nombre, correo, dependencia y funcionario', () => {
    const html = buildConstanciaRadicacionHtml({ ...BASE_PARAMS });
    expect(html).toContain('1-WEB-2026-00000042');
    expect(html).toContain('Juan Pérez');
    expect(html).toContain('juan@example.com');
    expect(html).toContain('Ventanilla Única');
    expect(html).toContain('Funcionaria X');
    expect(html).toContain(INSTITUCION.nombre);
    expect(html).toContain(INSTITUCION.sistema);
  });

  /* 2 */
  it('incluye teléfono del solicitante solo si viene con valor', () => {
    const conTel = buildConstanciaRadicacionHtml({
      ...BASE_PARAMS,
      telefonoSolicitante: '3001234567',
    });
    expect(conTel).toContain('3001234567');
    expect(conTel).toContain('Teléfono');

    const sinTel = buildConstanciaRadicacionHtml({
      ...BASE_PARAMS,
      telefonoSolicitante: null,
    });
    // La fila "Teléfono:" del solicitante NO debe aparecer.
    // (INSTITUCION.telefono sí aparece en el pie institucional.)
    expect(sinTel).not.toContain('3001234567');
  });

  /* 3 */
  it('incluye medio de respuesta si viene con valor', () => {
    const conCanal = buildConstanciaRadicacionHtml({
      ...BASE_PARAMS,
      canalRespuesta: 'CORREO',
    });
    expect(conCanal).toContain('Correo electrónico');
    expect(conCanal).toContain('Medio de respuesta');

    const sinCanal = buildConstanciaRadicacionHtml({ ...BASE_PARAMS, canalRespuesta: null });
    expect(sinCanal).not.toContain('Medio de respuesta');
  });

  /* 4 */
  it('incluye el logo como URL absoluta y el link de consulta pública', () => {
    const html = buildConstanciaRadicacionHtml({ ...BASE_PARAMS });
    // El logo se compone con NEXT_PUBLIC_APP_URL + INSTITUCION.logo.
    // En tests no está seteada la env, así que usa el fallback:
    expect(html).toMatch(/https?:\/\/[^"]+\/brand\/logo-alcaldia-simacota\.png/);
    expect(html).toContain(INSTITUCION.consultaUrl);
    expect(html).toContain(`href="${INSTITUCION.consultaUrl}"`);
  });

  /* 5 */
  it('escapa HTML de los campos que provienen del usuario', () => {
    const html = buildConstanciaRadicacionHtml({
      ...BASE_PARAMS,
      solicitanteNombre: 'Juan <script>alert(1)</script>',
      asunto:            'Solicitud & <img src=x>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  /* 6 */
  it('subject sigue formato "Constancia de radicación · {id} · {institución}"', () => {
    const s = buildConstanciaRadicacionSubject('1-WEB-2026-00000042');
    expect(s).toBe(`Constancia de radicación · 1-WEB-2026-00000042 · ${INSTITUCION.nombre}`);
  });
});
