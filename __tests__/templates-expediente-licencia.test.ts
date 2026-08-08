import { describe, expect, it } from 'vitest';
import {
  buildConstanciaExpedienteHtml,
  buildConstanciaExpedienteSubject,
  type TemplateConstanciaExpedienteParams,
} from '@/lib/email/templates/constancia-expediente-licencia';
import {
  buildAvisoActaHtml,
  buildAvisoActaSubject,
  VARIANTE_B_SUSPENSION,
  type TemplateAvisoActaParams,
} from '@/lib/email/templates/aviso-acta-observaciones';

/**
 * Bloque A·A5 — textos EXACTOS del dictamen de gobierno-digital
 * (8-ago-2026, VINCULANTE). Estas pruebas verifican que las frases
 * literales dictadas aparecen tal cual — no una paráfrasis.
 *
 * `plano()` colapsa espacios/saltos de línea del HTML fuente (las
 * plantillas envuelven oraciones largas en varias líneas por legibilidad
 * del código) — las aserciones comparan CONTENIDO, no el punto exacto
 * donde el código decidió partir la línea.
 */
function plano(html: string): string {
  return html.replace(/\s+/g, ' ');
}

const BASE_CONSTANCIA: TemplateConstanciaExpedienteParams = {
  numeroExpedienteFUN: '68745-0-26-0001',
  solicitanteNombre: 'Juan Pérez',
  solicitanteDocumento: '12345678',
  tipoDocumento: 'Cédula de ciudadanía',
  descripcionTramite: 'licencia de construcción · obra nueva',
  fechaRadicacionLegal: '2026-08-10T12:00:00.000Z',
  radicadoVentanillaId: '1-110-202608-00000042',
};

describe('constancia-expediente-licencia — asunto y textos exactos', () => {
  it('asunto exacto', () => {
    expect(buildConstanciaExpedienteSubject('68745-0-26-0001')).toBe(
      'Constancia de radicación en legal y debida forma · Expediente 68745-0-26-0001 · Alcaldía Municipal de Simacota',
    );
  });

  it('título institucional exacto', () => {
    const html = plano(buildConstanciaExpedienteHtml(BASE_CONSTANCIA));
    expect(html).toContain('CONSTANCIA DE RADICACIÓN EN LEGAL Y DEBIDA FORMA');
    expect(html).toContain('Licencias urbanísticas y actuaciones conexas — Secretaría de Planeación');
  });

  it('saludo de usted', () => {
    const html = plano(buildConstanciaExpedienteHtml(BASE_CONSTANCIA));
    expect(html).toContain('Estimado(a) <strong>Juan Pérez</strong>:');
  });

  it('párrafo de radicación en legal y debida forma (art. 2.2.6.1.2.1.1 par. 1) — texto literal', () => {
    const html = plano(buildConstanciaExpedienteHtml(BASE_CONSTANCIA));
    expect(html).toContain(
      'por haberse aportado la totalidad de los documentos exigidos, aun cuando estos puedan estar sujetos a posteriores correcciones (artículo 2.2.6.1.2.1.1, parágrafo 1, del Decreto 1077 de 2015).',
    );
  });

  it('explicación del número de expediente (Guía FUN 0.2, Res. 0463/2017) — texto literal', () => {
    const html = plano(buildConstanciaExpedienteHtml(BASE_CONSTANCIA));
    expect(html).toContain(
      'Este número identifica su trámite de manera única y permanente: corresponde a la solicitud, al acto administrativo que la resuelva y al expediente en el archivo municipal (Formulario Único Nacional, Resolución 0463 de 2017 de MinVivienda, numeral 0.2 de su guía).',
    );
  });

  it('bloque de término: 45 días hábiles + prórroga + acta — texto literal', () => {
    const html = plano(buildConstanciaExpedienteHtml(BASE_CONSTANCIA));
    expect(html).toContain(
      'la administración cuenta con cuarenta y cinco (45) días hábiles para pronunciarse sobre su solicitud (artículo 2.2.6.1.2.3.1 del Decreto 1077 de 2015).',
    );
    expect(html).toContain('prorrogarse por una sola vez, hasta por la mitad del término inicial');
    expect(html).toContain('el acta de observaciones y correcciones');
  });

  it('pie legal exacto (Ley 1581/2012)', () => {
    const html = plano(buildConstanciaExpedienteHtml(BASE_CONSTANCIA));
    expect(html).toContain(
      'Esta constancia es el acuse institucional de la radicación de su solicitud; consérvela junto con el número de expediente.',
    );
    expect(html).toContain('Este mensaje es informativo y no constituye notificación de acto administrativo.');
    expect(html).toContain('Ley 1581 de 2012');
  });

  it('PROHIBIDO: no menciona silencio administrativo positivo', () => {
    const html = plano(buildConstanciaExpedienteHtml(BASE_CONSTANCIA)).toLowerCase();
    expect(html).not.toContain('silencio administrativo');
  });

  it('PROHIBIDO: no imprime ninguna fecha de vencimiento (el tipo ni siquiera acepta ese campo)', () => {
    const html = plano(buildConstanciaExpedienteHtml(BASE_CONSTANCIA)).toLowerCase();
    expect(html).not.toContain('fecha de vencimiento');
    expect(html).not.toContain('vence el');
    // @ts-expect-error — el tipo no declara fechaVencimiento; si algún día lo hiciera, este archivo debe fallar en compilación.
    expect(BASE_CONSTANCIA.fechaVencimiento).toBeUndefined();
  });

  it('ambos identificadores con rótulos distintos: N.° DE EXPEDIENTE y "Radicado de ventanilla asociado"', () => {
    const html = plano(buildConstanciaExpedienteHtml(BASE_CONSTANCIA));
    expect(html).toContain('N.° DE EXPEDIENTE');
    expect(html).toContain('Radicado de ventanilla asociado:');
    expect(html).toContain('1-110-202608-00000042');
  });

  it('sin radicadoVentanillaId: no imprime esa fila', () => {
    const html = buildConstanciaExpedienteHtml({ ...BASE_CONSTANCIA, radicadoVentanillaId: null });
    expect(html).not.toContain('Radicado de ventanilla asociado:');
  });

  it('escapa HTML de los campos interpolados', () => {
    const html = buildConstanciaExpedienteHtml({ ...BASE_CONSTANCIA, solicitanteNombre: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('aviso-acta-observaciones — asunto y textos exactos', () => {
  const base: TemplateAvisoActaParams = { numeroExpedienteFUN: '68745-0-26-0001', solicitanteNombre: 'Juan Pérez' };

  it('asunto exacto', () => {
    expect(buildAvisoActaSubject('68745-0-26-0001')).toBe(
      'Acta de observaciones y correcciones · Expediente 68745-0-26-0001 · Alcaldía Municipal de Simacota',
    );
  });

  it('párrafo "por una sola vez" + arts. 2.2.6.1.2.2.4 y 19 del D.1783/2021 — texto literal', () => {
    const html = plano(buildAvisoActaHtml(base));
    expect(html).toContain(
      'la Secretaría de Planeación expidió — por una sola vez, como lo prevé la ley — un acta de observaciones y correcciones (artículo 2.2.6.1.2.2.4 del Decreto 1077 de 2015, modificado por el artículo 19 del Decreto 1783 de 2021).',
    );
    expect(html).toContain('no reemplaza dicha comunicación ni constituye notificación.');
  });

  it('bloque plazo: 30 días hábiles + ampliación 15 días — texto literal', () => {
    const html = plano(buildAvisoActaHtml(base));
    expect(html).toContain(
      'Usted cuenta con <strong>treinta (30) días hábiles</strong> para dar respuesta a las observaciones, y puede solicitar una ampliación hasta por <strong>quince (15) días hábiles</strong> adicionales (artículo 2.2.6.1.2.2.4 del Decreto 1077 de 2015).',
    );
  });

  it('SIN fechaComunicacion → NO imprime la fecha límite de respuesta', () => {
    const html = buildAvisoActaHtml(base);
    expect(html).not.toContain('su plazo vence el');
  });

  it('CON fechaLimiteRespuesta → imprime "Según la comunicación del acta, su plazo vence el"', () => {
    const html = plano(buildAvisoActaHtml({ ...base, fechaLimiteRespuesta: '2026-09-15T12:00:00.000Z' }));
    expect(html).toContain('Según la comunicación del acta, su plazo vence el');
  });

  it('advertencia de desistimiento tácito + recurso de reposición — texto literal', () => {
    const html = plano(buildAvisoActaHtml(base));
    expect(html).toContain(
      'Si no da respuesta dentro del plazo, la solicitud se entenderá desistida y se ordenará su archivo mediante acto administrativo, contra el cual procede únicamente el recurso de reposición (artículo 2.2.6.1.2.2.4 del Decreto 1077 de 2015; concordante con el artículo 2.2.6.1.2.3.4).',
    );
  });

  it('efecto: FÓRMULA NEUTRA por defecto (no la variante de suspensión)', () => {
    const html = plano(buildAvisoActaHtml(base));
    expect(html).toContain(
      'La expedición del acta afecta el cómputo del término para resolver su solicitud, en los términos del artículo 2.2.6.1.2.2.4 del Decreto 1077 de 2015: mientras esté en curso su plazo para responder, dicho término no continúa corriendo de manera ordinaria.',
    );
    expect(html).not.toContain('se suspende el término');
    expect(html).not.toContain(plano(VARIANTE_B_SUSPENSION));
  });

  it('VARIANTE_B_SUSPENSION existe como constante documentada pero NO hay forma de seleccionarla (el tipo de params no la expone)', () => {
    expect(VARIANTE_B_SUSPENSION).toContain('se suspende el término para la expedición de la licencia');
    expect(VARIANTE_B_SUSPENSION).toContain('salvo');
    expect(VARIANTE_B_SUSPENSION).toContain('renuncia expresa');
    // TemplateAvisoActaParams no tiene ningún campo de "variante" — verificado por tipos en tiempo de compilación.
  });

  it('escapa HTML de los campos interpolados', () => {
    const html = buildAvisoActaHtml({ ...base, solicitanteNombre: '<b>x</b>' });
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;');
  });
});
