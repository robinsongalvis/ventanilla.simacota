import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { datosConstanciaDesdeRadicado } from '@/lib/mostrador/constancia-desde-radicado';

/* ══════════════════════════════════════════════════════════════
   Sprint Cierre del mostrador — constancia armada desde el doc.
══════════════════════════════════════════════════════════════ */

function radicado(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId:          '1-WEB-2026-00000010',
    estadoActual:        'PENDIENTE',
    ultimaActualizacion: '2026-07-02T15:00:00.000Z',
    prioridad:           'AMARILLO',
    esAnonimo:           false,
    tipoPresentacion:    'IDENTIFICADA',
    identidadReservada:  false,
    canalRespuesta:      'CORREO',
    solicitante: {
      tipoPersona:     'NATURAL',
      tipoDocumento:   'CC',
      numeroDocumento: '1101321226',
      nombreCompleto:  'Robinson David Galvis',
      email:           'robinson@example.com',
      telefonoMovil:   '3203452716',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId:     '1-WEB-2026-00000010',
      consecutivo:    10,
      fechaRadicado:  '2026-07-02T15:00:00.000Z',
      horaRadicado:   '10:31',
      medioRecepcion: 'OFICIO_FISICO',
      origen:         'FISICO_ESCANER',
    },
    termino: {
      tipoSolicitudId:     'PETICION_INFORMACION',
      tipoSolicitudNombre: 'Petición de información',
      diasRespuesta:       10,
      unidad:              'HABILES',
      fechaVencimiento:    '2026-07-16T09:00:00.000Z',
      prorrogasAplicadas:  0,
    },
    clasificacion: {
      oficinaDestino: 'SEC_PLANEACION',
      zonaGeografica: 'CASCO_URBANO',
      funcionarioResponsableNombre: 'Laura',
    },
    detalle: {
      asunto:              'Problemas del acueducto',
      descripcion:         'Descripción',
      numeroFolios:        2,
      numeroAnexos:        1,
      anexosDescripcion:   'CD',
    },
    archivos: [],
    ...overrides,
  };
}

describe('Cierre del mostrador — datosConstanciaDesdeRadicado', () => {
  /* 1 · mapeo completo desde el documento */
  it('arma la constancia con los datos del doc', () => {
    const d = datosConstanciaDesdeRadicado(radicado());
    expect(d.radicadoId).toBe('1-WEB-2026-00000010');
    expect(d.solicitanteNombre).toBe('Robinson David Galvis');
    expect(d.tipoTramite).toBe('Petición de información');
    expect(d.horaRadicado).toBe('10:31');
    expect(d.funcionarioNombre).toBe('Laura');
    expect(d.numeroFolios).toBe(2);
    expect(d.numeroAnexos).toBe(1);
    expect(d.mediosAnexos).toBe('CD');
    expect(d.correoSolicitante).toBe('robinson@example.com');
    expect(d.telefonoSolicitante).toBe('3203452716');
  });

  /* 2 · las marcas "no aporta" anulan el dato, como al radicar */
  it('respeta datosNoAportados: correo y teléfono en null', () => {
    const r = radicado();
    r.solicitante.datosNoAportados = { correo: true, telefono: true };
    const d = datosConstanciaDesdeRadicado(r);
    expect(d.correoSolicitante).toBeNull();
    expect(d.telefonoSolicitante).toBeNull();
  });

  /* 3 · teléfono legacy como fallback */
  it('usa el teléfono legacy si no hay móvil', () => {
    const r = radicado();
    r.solicitante.telefonoMovil = null;
    r.solicitante.telefono = '6076543';
    expect(datosConstanciaDesdeRadicado(r).telefonoSolicitante).toBe('6076543');
  });

  /* 4 · defaults defensivos para históricos */
  it('sin tipo de trámite ni responsable usa los defaults', () => {
    const r = radicado();
    r.termino.tipoSolicitudNombre = '';
    delete r.clasificacion.funcionarioResponsableNombre;
    const d = datosConstanciaDesdeRadicado(r);
    expect(d.tipoTramite).toBe('Sin clasificar');
    expect(d.funcionarioNombre).toBe('No registrado');
  });
});
