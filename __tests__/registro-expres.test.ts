import { describe, expect, it } from 'vitest';
import {
  construirPaqueteExpres,
  validarRegistroExpres,
  type EntradaExpres,
} from '@/lib/dependencias/registro-expres';

/* ══════════════════════════════════════════════════════════════
   Sprint Registro exprés — el paquete entrada+salida en un paso.

   Caso canónico: correo del Banco Agrario a Hacienda a las 8:40,
   respondido a las 10:15, registrado a las 10:20.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-07T15:20:00.000Z');   // 10:20 Colombia
const LLEGADA = '2026-07-07T13:40:00.000Z';           // 8:40 Colombia
const RESPUESTA = '2026-07-07T15:15:00.000Z';         // 10:15 Colombia

const IDS = {
  radicadoId:         '1-EMAIL-2026-00000089',
  consecutivoEntrada: 89,
  salidaId:           '2-SAL-2026-00000031',
  consecutivoSalida:  31,
};

const ACTOR = { uid: 'uid-secretario', nombre: 'Secretario de Hacienda' };

function entrada(overrides: Partial<EntradaExpres> = {}): EntradaExpres {
  return {
    remitenteNombre:  'Banco Agrario',
    remitenteEntidad: 'Banco Agrario de Colombia',
    remitenteEmail:   'convenios@bancoagrario.gov.co',
    tipoSolicitudId:  'PETICION_GENERAL',
    asunto:           'Certificación de cuentas del convenio 052',
    descripcion:      'Solicitan certificación antes del mediodía para el desembolso.',
    fechaLlegada:     LLEGADA,
    respuestaResumen: 'Se envió la certificación firmada.',
    fechaRespuesta:   RESPUESTA,
    dependencia:      'SEC_HACIENDA',
    ...overrides,
  };
}

describe('Registro exprés — validarRegistroExpres', () => {
  /* 1 · la declaración completa pasa */
  it('acepta la declaración del caso del banco', () => {
    expect(validarRegistroExpres(entrada(), AHORA)).toBeNull();
  });

  /* 2 · las fechas deben ser coherentes */
  it('rechaza respuesta anterior a la llegada y fechas futuras', () => {
    expect(validarRegistroExpres(
      entrada({ fechaRespuesta: '2026-07-07T13:00:00.000Z' }), AHORA,
    )).toMatch(/anterior a la llegada/i);
    expect(validarRegistroExpres(
      entrada({ fechaRespuesta: '2026-07-08T10:00:00.000Z' }), AHORA,
    )).toMatch(/futuro/i);
  });

  /* 3 · campos obligatorios */
  it('exige remitente, asunto, qué pedía y qué se respondió', () => {
    expect(validarRegistroExpres(entrada({ remitenteNombre: ' ' }), AHORA)).toMatch(/remitente/i);
    expect(validarRegistroExpres(entrada({ respuestaResumen: '' }), AHORA)).toMatch(/respondió/i);
  });
});

describe('Registro exprés — construirPaqueteExpres', () => {
  const paquete = construirPaqueteExpres(entrada(), IDS, ACTOR, AHORA);

  /* 4 · la entrada nace resuelta, dirigida y con responsable */
  it('la entrada nace RESUELTA en la dependencia con respuestaOficial', () => {
    expect(paquete.radicado.radicadoId).toBe('1-EMAIL-2026-00000089');
    expect(paquete.radicado.estadoActual).toBe('RESUELTO');
    expect(paquete.radicado.clasificacion.oficinaDestino).toBe('SEC_HACIENDA');
    expect(paquete.radicado.clasificacion.funcionarioResponsableNombre).toBe('Secretario de Hacienda');
    expect(paquete.radicado.respuestaOficial?.nota).toBe('Se envió la certificación firmada.');
    expect(paquete.radicado.respuestaOficial?.fecha).toBe(RESPUESTA);
  });

  /* 5 · decisión aprobada: fecha del radicado = momento del registro */
  it('la serie usa la fecha del registro, no la de llegada', () => {
    expect(paquete.radicado.control.fechaRadicado).toBe(AHORA.toISOString());
    expect(paquete.radicado.control.medioRecepcion).toBe('EMAIL');
    expect(paquete.radicado.control.origenIngreso).toBe('CORREO_INSTITUCIONAL');
  });

  /* 6 · cumplimiento honesto: término desde la llegada REAL */
  it('cumplioTermino true al responder el mismo día', () => {
    expect(paquete.radicado.cumplioTermino).toBe(true);
  });

  it('cumplioTermino false si la respuesta declarada superó el término', () => {
    // Llegó hace ~2 meses; "respondido" apenas ayer (dentro de <= ahora).
    const tarde = construirPaqueteExpres(
      entrada({
        fechaLlegada:   '2026-05-04T13:00:00.000Z',
        fechaRespuesta: '2026-07-06T15:00:00.000Z',
      }),
      IDS, ACTOR, AHORA,
    );
    expect(tarde.radicado.cumplioTermino).toBe(false);
  });

  /* 7 · la salida queda amarrada y con el remitente como destinatario */
  it('genera la salida RESPUESTA amarrada a la entrada', () => {
    expect(paquete.salida.salidaId).toBe('2-SAL-2026-00000031');
    expect(paquete.salida.tipoSalida).toBe('RESPUESTA');
    expect(paquete.salida.radicadoEntradaId).toBe('1-EMAIL-2026-00000089');
    expect(paquete.salida.destinatario.nombre).toBe('Banco Agrario');
    expect(paquete.salida.dependenciaOrigen).toBe('SEC_HACIENDA');
    expect(paquete.salida.firmante.nombre).toBe('Secretario de Hacienda');
  });

  /* 8 · la trazabilidad cuenta las fechas REALES */
  it('los eventos llevan llegada y respuesta reales en las notas', () => {
    const [radicacion, respuesta, salida] = paquete.eventosEntrada;
    expect(radicacion.accion).toBe('RADICACION');
    expect(radicacion.nota).toMatch(/Recibido por correo institucional/i);
    expect(radicacion.nota).toMatch(/registro exprés/i);
    expect(radicacion.metadata?.fechaLlegadaReal).toBe(LLEGADA);
    expect(respuesta.accion).toBe('RESPUESTA_FUNCIONARIO');
    expect(respuesta.metadata?.fechaRespuestaReal).toBe(RESPUESTA);
    expect(salida.accion).toBe('OFICIO_SALIDA_REGISTRADO');
    expect(salida.nota).toContain('2-SAL-2026-00000031');
  });

  /* 9 · el remitente institucional queda como persona jurídica sin documento */
  it('marca entidad como JURIDICA con documento no aportado', () => {
    expect(paquete.radicado.solicitante.tipoPersona).toBe('JURIDICA');
    expect(paquete.radicado.solicitante.datosNoAportados?.documento).toBe(true);
    expect(JSON.stringify(paquete)).not.toContain('undefined');
  });
});
