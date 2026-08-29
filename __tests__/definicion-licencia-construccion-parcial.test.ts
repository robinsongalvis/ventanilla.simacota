import { describe, expect, it } from 'vitest';
import { validarDefinicionTramite } from '@/lib/motor-expedientes/validar-definicion';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';

/* Bloque A·A2 — Definición de Trámite sembrada (contenido parcial, pág. 1/2). */

describe('DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL', () => {
  it('pasa validarDefinicionTramite sin errores', () => {
    const resultado = validarDefinicionTramite(DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL);
    expect(resultado.errores).toEqual([]);
    expect(resultado.valida).toBe(true);
  });

  it('tiene exactamente los 19 requisitos del blueprint (página 1/2), sin inventar ni omitir', () => {
    expect(DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.requisitos).toHaveLength(19);
  });

  it('ids de requisitos son únicos', () => {
    const ids = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.requisitos.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declara las 4 clavesContexto esperadas (mismas de los fixtures de Fase 0)', () => {
    const nombres = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.clavesContexto!.map((c) => c.nombre).sort();
    expect(nombres).toEqual(['categoriaComplejidad', 'esApoderado', 'predioRodeadoEspacioPublico', 'sujetoTituloENSR10'].sort());
  });

  it('terminos = 45 días hábiles (D.1077/2015 art. 2.2.6.1.2.3.1 inc. 1)', () => {
    expect(DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.terminos).toEqual({ dias: 45, unidad: 'HABILES' });
  });

  it('regimenSubsanacion = 30 hábiles + prórroga 15 (D.1077/2015 art. 2.2.6.1.2.2.4)', () => {
    expect(DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.regimenSubsanacion.dias).toBe(30);
    expect(DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.regimenSubsanacion.prorrogaDias).toBe(15);
  });

  it('los 5 requisitos condicionales del blueprint son exactamente los marcados CONDICIONAL', () => {
    const condicionales = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.requisitos.filter((r) => r.tipo === 'CONDICIONAL').map((r) => r.id).sort();
    expect(condicionales).toEqual([
      'acta-colindancia', 'estudio-suelos-geotecnico', 'planos-hidraulicos-sanitarios-estructurales',
      'poder-apoderado', 'relacion-colindantes',
    ].sort());
  });

  it('el requisito #16 (matrícula profesional) es OPCIONAL, no CONDICIONAL inventado (ver JSDoc)', () => {
    const r16 = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.requisitos.find((r) => r.id === 'matricula-profesional-experiencia')!;
    expect(r16.tipo).toBe('OPCIONAL');
  });

  /* Textos de cara al funcionario. Reemplazan la etiqueta técnica derivada
     (`prettyClave`, p. ej. "Sujeto Titulo ENSR10") por lenguaje natural — el
     propietario reportó en producción que la derivada no le decía nada.

     REDISEÑO 28-ago: antes se exigían los TRES campos en las cuatro claves. Ya
     no, y no es una relajación: con las etiquetas de opción («El titular del
     predio» / «Un apoderado») la primera pregunta se explica sola, y su ayuda
     vieja —«Marque "Sí" si…»— hablaba de unos botones que ya no existen.

     Lo que se custodia sigue siendo lo mismo: que NINGUNA pregunta quede en
     jerga, y que la ayuda, cuando exista, se pueda abrir con un enlace propio. */
  describe('textos de cara al funcionario en las 4 clavesContexto', () => {
    const CLAVES = ['esApoderado', 'categoriaComplejidad', 'sujetoTituloENSR10', 'predioRodeadoEspacioPublico'];

    it.each(CLAVES)('"%s" pregunta en lenguaje natural, no con el nombre de la clave', (nombre) => {
      const clave = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.clavesContexto!.find((c) => c.nombre === nombre)!;
      expect(clave.pregunta, `${nombre} sin pregunta`).toBeTruthy();
      expect(clave.pregunta!.length).toBeGreaterThan(12);
      /* Jerga prohibida: el nombre crudo de la clave no puede ser la pregunta. */
      expect(clave.pregunta!.toLowerCase()).not.toContain(nombre.toLowerCase());
    });

    it.each(CLAVES)('"%s" ofrece etiquetas de opción legibles, no valores crudos', (nombre) => {
      /* Es lo que sustituye a la ayuda obligatoria: si las OPCIONES se leen en
         castellano, la pregunta no necesita explicarse. */
      const clave = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.clavesContexto!.find((c) => c.nombre === nombre)!;
      const ops = clave.opciones;
      expect(ops, `${nombre} sin etiquetas de opción`).toBeTruthy();
      const etiquetas = [ops!.si?.etiqueta, ops!.no?.etiqueta, ...Object.values(ops!.porValor ?? {}).map((o) => o.etiqueta)]
        .filter(Boolean) as string[];
      expect(etiquetas.length).toBeGreaterThan(1);
      for (const e of etiquetas) {
        expect(e, 'una etiqueta no puede ser un valor crudo del dominio').not.toMatch(/^(true|false|[A-Z_]+)$/);
      }
    });

    it('toda ayuda declarada trae su propio enlace, y ninguno se repite', () => {
      /* Cuatro «¿Cómo se clasifica?» clonados no ayudan a decidir cuál abrir. */
      const conAyuda = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.clavesContexto!.filter((c) => c.ayuda);
      expect(conAyuda.length).toBeGreaterThan(0);
      const enlaces = conAyuda.map((c) => {
        expect(c.ayudaEnlace, `${c.nombre} tiene ayuda sin enlace propio`).toBeTruthy();
        return c.ayudaEnlace!;
      });
      expect(new Set(enlaces).size, 'hay enlaces de ayuda repetidos').toBe(enlaces.length);
    });

    it('ningún texto de cara al funcionario habla de «Sí/No» cuando los botones ya no lo dicen', () => {
      /* El texto viejo decía «Marque "Sí"…» sobre unos botones que ahora dicen
         «El titular del predio». Una instrucción que nombra un control que no
         existe es peor que no tenerla. */
      for (const c of DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.clavesContexto!) {
        const textos = [c.pregunta, c.ayuda, c.efecto].filter(Boolean).join(' ');
        expect(textos, `${c.nombre} instruye sobre botones "Sí"/"No" inexistentes`)
          .not.toMatch(/responde\s+"?(Sí|No)"?|Marque\s+"?(Sí|No)"?/i);
      }
    });
  });
});
