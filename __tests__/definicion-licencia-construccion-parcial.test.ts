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

  /* Textos de cara al funcionario (`pregunta`/`ayuda`/`efecto`) — reemplazan
     la etiqueta técnica derivada (`prettyClave`, p. ej. "Sujeto Titulo
     ENSR10") por lenguaje natural. Redacción PROVISIONAL del equipo de
     desarrollo, ver JSDoc junto a `clavesContexto` en la propia Definición. */
  describe('textos de las 4 clavesContexto (pregunta/ayuda/efecto)', () => {
    it.each(['esApoderado', 'categoriaComplejidad', 'sujetoTituloENSR10', 'predioRodeadoEspacioPublico'])(
      '"%s" declara pregunta, ayuda y efecto, ninguno vacío',
      (nombre) => {
        const clave = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.clavesContexto!.find((c) => c.nombre === nombre)!;
        expect(clave.pregunta).toBeTruthy();
        expect(clave.ayuda).toBeTruthy();
        expect(clave.efecto).toBeTruthy();
      },
    );
  });
});
