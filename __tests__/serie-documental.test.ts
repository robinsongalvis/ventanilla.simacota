import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  CODIGO_TRD_DEPENDENCIA,
  FUENTE_TRD,
  labelSerieDocumental,
  SERIES_VENTANILLA,
  sugerirSerieDocumental,
} from '@/lib/catalogos/series-documentales';
import type { SerieDocumentalDef } from '@/lib/catalogos/series-documentales';
import { construirPaqueteExpres } from '@/lib/dependencias/registro-expres';
import type { EntradaExpres, IdsExpres } from '@/lib/dependencias/registro-expres';

/* ══════════════════════════════════════════════════════════════
   Sprint Serie documental — el radicado nace clasificado en su
   serie TRD. Fuente: borrador 2025 (decisión del usuario: se
   implementa ya; la TRD aprobada solo actualiza el catálogo).
══════════════════════════════════════════════════════════════ */

describe('sugerirSerieDocumental', () => {
  it('una petición dirigida a Gobierno cae en 110.12 Derechos de Petición', () => {
    const serie = sugerirSerieDocumental('PETICION_GENERAL', 'SEC_GOBIERNO');
    expect(serie).toEqual({
      codigo: '110.12',
      nombre: 'Derechos de Petición',
      fuente: FUENTE_TRD,
    });
  });

  it('el código de oficina productora sigue al destino', () => {
    expect(sugerirSerieDocumental('QUEJA', 'DESPACHO_ALCALDE')?.codigo).toBe('100.12');
    expect(sugerirSerieDocumental('RECLAMO', 'SEC_HACIENDA')?.codigo).toBe('130.12');
    expect(sugerirSerieDocumental('DENUNCIA', 'SEC_DESARROLLO_SOCIAL')?.codigo).toBe('140.12');
  });

  it('las sub-oficinas heredan el código de su dependencia', () => {
    expect(sugerirSerieDocumental('PETICION_GENERAL', 'SUB_COMISARIA')?.codigo).toBe('111.12');
    expect(sugerirSerieDocumental('PETICION_GENERAL', 'SUB_SISBEN')?.codigo).toBe('120.12');
  });

  it('licencia de construcción cae en la subserie 22.01 de Planeación', () => {
    const serie = sugerirSerieDocumental('LICENCIA_CONSTRUCCION', 'SEC_PLANEACION');
    expect(serie?.codigo).toBe('120.22.01');
  });

  it('querella policial cae en proceso verbal abreviado (26.07)', () => {
    expect(sugerirSerieDocumental('QUERELLA', 'SUB_INSPECCION_POLICIA_URBANA')?.codigo)
      .toBe('112.26.07');
  });

  it('lo informativo y las invitaciones se clasifican en archivo (null)', () => {
    expect(sugerirSerieDocumental('INFORMATIVO', 'SEC_GOBIERNO')).toBeNull();
    expect(sugerirSerieDocumental('INVITACION', 'DESPACHO_ALCALDE')).toBeNull();
  });

  it('un destino sin código TRD no inventa clasificación', () => {
    expect(CODIGO_TRD_DEPENDENCIA['VENTANILLA_UNICA' as never]).toBe('110');
    // Tenant hipotético fuera del mapa → null, jamás un código malformado.
    expect(sugerirSerieDocumental('PETICION_GENERAL', 'TENANT_INEXISTENTE' as never)).toBeNull();
  });
});

describe('labelSerieDocumental', () => {
  it('arma la etiqueta corta y el fallback honesto', () => {
    expect(labelSerieDocumental({ codigo: '110.12', nombre: 'Derechos de Petición', fuente: FUENTE_TRD }))
      .toBe('110.12 · Derechos de Petición');
    expect(labelSerieDocumental(null)).toBe('Se clasifica en archivo');
  });
});

describe('integración — el radicado nace con la serie', () => {
  it('la acción de radicar persiste la foto de la serie en la clasificación', () => {
    // Pieza angular (P2.1) Fase 1 — la construcción del radicado (incluida
    // la foto de serieDocumental) se extrajo al constructor puro compartido
    // `lib/recepcion/construir-radicado.ts`; la acción interna delega ahí.
    const accion = readFileSync('lib/actions/radicarVentanilla.ts', 'utf8');
    expect(accion).toContain('construirVentanillaRadicado');
    const constructor = readFileSync('lib/recepcion/construir-radicado.ts', 'utf8');
    expect(constructor).toContain('sugerirSerieDocumental');
    expect(constructor).toContain('serieDocumental: serie');
  });

  it('la Radicación Rápida muestra la serie derivada', () => {
    const form = readFileSync('app/interno/recepcion/components/RadicacionFuncionarioForm.tsx', 'utf8');
    expect(form).toContain('Serie documental (TRD)');
    expect(form).toContain('labelSerieDocumental(serieSugerida)');
  });
});

/* ══════════════════════════════════════════════════════════════
   C1 — Ciclo vital documental (retención/disposición) desde la TRD.
   Valores verificados contra la TRD oficial; disposición pendiente
   de validación del Jefe de Archivo (B32-a) en 3 de 4 series.
══════════════════════════════════════════════════════════════ */
describe('C1 — retención/disposición del catálogo (BM-B32)', () => {
  it('Derechos de Petición conserva su ciclo vital (2/8, Selección)', () => {
    expect(SERIES_VENTANILLA.DERECHOS_DE_PETICION.retencionGestionAnios).toBe(2);
    expect(SERIES_VENTANILLA.DERECHOS_DE_PETICION.retencionCentralAnios).toBe(8);
    expect(SERIES_VENTANILLA.DERECHOS_DE_PETICION.disposicionFinal).toBe('S');
  });

  it('Licencia de Construcción (120.22.01) → retención 2/10', () => {
    expect(SERIES_VENTANILLA.LICENCIA_CONSTRUCCION.retencionGestionAnios).toBe(2);
    expect(SERIES_VENTANILLA.LICENCIA_CONSTRUCCION.retencionCentralAnios).toBe(10);
  });

  it('Licencia de Subdivisión Rural (120.22.06) → retención 2/10', () => {
    expect(SERIES_VENTANILLA.LICENCIA_SUBDIVISION.retencionGestionAnios).toBe(2);
    expect(SERIES_VENTANILLA.LICENCIA_SUBDIVISION.retencionCentralAnios).toBe(10);
    expect(SERIES_VENTANILLA.LICENCIA_SUBDIVISION.nombre).toContain('Subdivisión Rural');
  });

  it('Proceso Verbal Abreviado (112.26.07) → retención 2/18, disposición Selección', () => {
    expect(SERIES_VENTANILLA.PROCESO_VERBAL_ABREVIADO.retencionGestionAnios).toBe(2);
    expect(SERIES_VENTANILLA.PROCESO_VERBAL_ABREVIADO.retencionCentralAnios).toBe(18);
    expect(SERIES_VENTANILLA.PROCESO_VERBAL_ABREVIADO.disposicionFinal).toBe('S');
  });

  it('Declaraciones Tributarias (130.11.01) → retención 2/8', () => {
    expect(SERIES_VENTANILLA.DECLARACIONES_TRIBUTARIAS.retencionGestionAnios).toBe(2);
    expect(SERIES_VENTANILLA.DECLARACIONES_TRIBUTARIAS.retencionCentralAnios).toBe(8);
  });

  it('las 3 series pendientes NO inventan disposición (B32-a)', () => {
    // Tipar con la interfaz: `as const satisfies` estrecha el literal y omite
    // el campo ausente; la interfaz lo declara opcional y permite verificarlo.
    const pendientes: SerieDocumentalDef[] = [
      SERIES_VENTANILLA.LICENCIA_CONSTRUCCION,
      SERIES_VENTANILLA.LICENCIA_SUBDIVISION,
      SERIES_VENTANILLA.DECLARACIONES_TRIBUTARIAS,
    ];
    for (const serie of pendientes) {
      expect(serie.disposicionFinal).toBeUndefined();
    }
  });
});

/* ══════════════════════════════════════════════════════════════
   C1 — Cobertura del sellado por canal: TODO radicado nace con su
   serie, no solo el de ventanilla. (Corrige la brecha detectada en
   el Blueprint C1: la serie se sellaba solo en radicarVentanilla.)
══════════════════════════════════════════════════════════════ */
describe('C1 — el radicado nace clasificado en todos los canales', () => {
  it('registro exprés sella la serie en el radicado (builder puro)', () => {
    const entrada: EntradaExpres = {
      remitenteNombre:  'Contraloría de Santander',
      tipoSolicitudId:  'PETICION_GENERAL',
      asunto:           'Solicitud de información predial',
      descripcion:      'Solicitan copia del avalúo predial de un inmueble.',
      fechaLlegada:     '2026-07-10T14:00:00.000Z',
      respuestaResumen: 'Se remitió la certificación solicitada.',
      fechaRespuesta:   '2026-07-11T14:00:00.000Z',
      dependencia:      'SEC_HACIENDA',
    };
    const ids: IdsExpres = {
      radicadoId: '1-110-2026-00000001', consecutivoEntrada: 1,
      salidaId: '2-SAL-2026-00000001', consecutivoSalida: 1,
    };
    const paquete = construirPaqueteExpres(
      entrada, ids, { uid: 'u1', nombre: 'Funcionaria' }, new Date('2026-07-12T09:00:00.000Z'),
    );
    // PETICION_GENERAL × SEC_HACIENDA → 130.12 Derechos de Petición.
    expect(paquete.radicado.clasificacion.serieDocumental?.codigo).toBe('130.12');
  });

  it('la radicación WEB (API) sella la serie derivada', () => {
    // Pieza angular (P2.1) Fase 1 — misma nota que la superficie interna:
    // la ruta pública delega la construcción del radicado (con su serie)
    // al constructor puro compartido.
    const route = readFileSync('app/api/radicacion/route.ts', 'utf8');
    expect(route).toContain('construirVentanillaRadicado');
    const constructor = readFileSync('lib/recepcion/construir-radicado.ts', 'utf8');
    expect(constructor).toContain('sugerirSerieDocumental');
    expect(constructor).toContain('serieDocumental: serie');
  });

  it('la reclasificación re-deriva la serie (BM-B11)', () => {
    const route = readFileSync('app/api/radicados/[radicadoId]/reclasificar/route.ts', 'utf8');
    expect(route).toContain('sugerirSerieDocumental');
    expect(route).toContain("'clasificacion.serieDocumental'");
    // deja huella del cambio de serie
    expect(route).toContain('serieAnteriorCodigo');
  });
});
