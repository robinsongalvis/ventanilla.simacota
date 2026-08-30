import { describe, it, expect } from 'vitest';
import { sumarDiasHabiles } from '@/lib/tiempos-radicado';
import {
  DIAS_HABILES_RECURSOS,
  DIAS_HABILES_SUBSANACION_TACITO,
  DIAS_HABILES_PAGO_VIABILIDAD,
  procedeDesistimientoTacito,
  validarEvidenciaFirmeza,
  validarEvidenciaNotificacion,
  validarEvidenciaResolucion,
  vencimientoRecursos,
} from '@/lib/motor-expedientes/cierre-licencia';

const AHORA = new Date('2026-08-28T12:00:00Z');

describe('la resolución', () => {
  it('exige número y fecha', () => {
    expect(validarEvidenciaResolucion({}, AHORA)?.campo).toBe('numeroResolucion');
    expect(validarEvidenciaResolucion({ numeroResolucion: 'R-123' }, AHORA)?.campo).toBe('fechaResolucion');
  });

  it('rechaza una fecha futura', () => {
    /* Registrar un acto que todavía no se expidió. */
    const e = validarEvidenciaResolucion(
      { numeroResolucion: 'R-123', fechaResolucion: '2026-09-15T12:00:00Z' },
      AHORA,
    );
    expect(e?.mensaje).toMatch(/no puede ser futura/i);
  });

  it('acepta una resolución de hoy', () => {
    expect(validarEvidenciaResolucion(
      { numeroResolucion: 'R-123', fechaResolucion: '2026-08-28T09:00:00Z' },
      AHORA,
    )).toBeNull();
  });
});

describe('la notificación', () => {
  it('NO puede ser futura: de ella corren los recursos del ciudadano', () => {
    /* Adelantarla adelanta el vencimiento del plazo de recurso, y se lo recorta
       sin que se entere. */
    const e = validarEvidenciaNotificacion(
      { fechaNotificacion: '2026-09-10T12:00:00Z', modo: 'PERSONAL' },
      '2026-08-20T12:00:00Z',
      AHORA,
    );
    expect(e?.mensaje).toMatch(/plazos de recurso/i);
  });

  it('no puede ser anterior a la resolución que notifica', () => {
    const e = validarEvidenciaNotificacion(
      { fechaNotificacion: '2026-08-10T12:00:00Z', modo: 'PERSONAL' },
      '2026-08-20T12:00:00Z',
      AHORA,
    );
    expect(e?.mensaje).toMatch(/anterior a la resolución/i);
  });

  it('exige decir CÓMO se surtió', () => {
    const e = validarEvidenciaNotificacion({ fechaNotificacion: '2026-08-25T12:00:00Z' }, undefined, AHORA);
    expect(e?.campo).toBe('modo');
  });
});

describe('la firmeza — el control que protege el recurso', () => {
  const NOTIFICADA_EL = '2026-08-20T12:00:00Z';

  it('el plazo de recursos son 10 días hábiles desde la notificación', () => {
    expect(DIAS_HABILES_RECURSOS).toBe(10);
    const vence = vencimientoRecursos(NOTIFICADA_EL);
    expect(new Date(vence).getTime()).toBeGreaterThan(new Date(NOTIFICADA_EL).getTime());
  });

  it('NO se puede declarar por vencimiento antes de que venza', () => {
    /* ESTE ES EL CASO QUE IMPORTA: declararla antes le quitaría al ciudadano un
       recurso que todavía tenía. */
    const e = validarEvidenciaFirmeza(
      { motivo: 'PLAZO_VENCIDO_SIN_RECURSOS', fechaFirmeza: '2026-08-25T12:00:00Z' },
      NOTIFICADA_EL,
      new Date('2026-08-25T12:00:00Z'),
    );
    expect(e?.mensaje).toMatch(/no se puede declarar la firmeza por vencimiento/i);
    expect(e?.mensaje, 'el mensaje dice cuándo vence de verdad').toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('sí se puede el día en que vence, y después', () => {
    const vence = vencimientoRecursos(NOTIFICADA_EL);
    expect(validarEvidenciaFirmeza(
      { motivo: 'PLAZO_VENCIDO_SIN_RECURSOS', fechaFirmeza: vence },
      NOTIFICADA_EL,
      new Date(vence),
    )).toBeNull();
  });

  it('sin fecha de notificación NO se puede afirmar que el plazo venció', () => {
    const e = validarEvidenciaFirmeza(
      { motivo: 'PLAZO_VENCIDO_SIN_RECURSOS', fechaFirmeza: '2026-08-28T12:00:00Z' },
      undefined,
      AHORA,
    );
    expect(e?.mensaje).toMatch(/no consta la fecha de notificación/i);
  });

  it('los otros dos motivos NO dependen del calendario', () => {
    /* Renuncia expresa y recursos resueltos son hechos, no plazos: exigirles la
       aritmética del vencimiento bloquearía firmezas legítimas. */
    for (const motivo of ['RECURSOS_RESUELTOS', 'RENUNCIA_EXPRESA'] as const) {
      expect(validarEvidenciaFirmeza(
        { motivo, fechaFirmeza: '2026-08-22T12:00:00Z' },
        NOTIFICADA_EL,
        AHORA,
      ), `${motivo} no debería exigir el vencimiento`).toBeNull();
    }
  });
});

describe('el desistimiento tácito', () => {
  const COMUNICADA_EL = '2026-06-01T12:00:00Z';

  it('procede a los 30 días hábiles de la COMUNICACIÓN del acta', () => {
    expect(DIAS_HABILES_SUBSANACION_TACITO).toBe(30);
    expect(procedeDesistimientoTacito({
      fechaComunicacionActa: COMUNICADA_EL,
      huboRespuestaSubsanacion: false,
      ahora: AHORA,
    })).toBeNull();
  });

  it('NO procede antes, y el mensaje dice cuántos van', () => {
    const e = procedeDesistimientoTacito({
      fechaComunicacionActa: '2026-08-20T12:00:00Z',
      huboRespuestaSubsanacion: false,
      ahora: AHORA,
    });
    expect(e?.mensaje).toMatch(/días hábiles desde la comunicación/i);
    expect(e?.mensaje).toMatch(/30/);
  });

  it('NO procede si el ciudadano ya respondió, aunque hayan pasado los 30 días', () => {
    /* Entre que el vigía mira y el funcionario pulsa puede haber entrado la
       respuesta. Archivar sobre la foto de ayer cerraría una solicitud viva. */
    const e = procedeDesistimientoTacito({
      fechaComunicacionActa: COMUNICADA_EL,
      huboRespuestaSubsanacion: true,
      ahora: AHORA,
    });
    expect(e?.mensaje).toMatch(/ya respondió/i);
    expect(e?.mensaje, 'y dice qué hacer en su lugar').toMatch(/acto de fondo/i);
  });

  it('sin fecha de comunicación NO se cuenta el plazo', () => {
    /* El plazo corre desde la COMUNICACIÓN, no desde la expedición del acta. */
    const e = procedeDesistimientoTacito({
      fechaComunicacionActa: undefined,
      huboRespuestaSubsanacion: false,
      ahora: AHORA,
    });
    expect(e?.mensaje).toMatch(/no consta la fecha en que el acta se comunicó/i);
  });
});

describe('la prórroga de 15 días hábiles (ADR-0038 §2.3)', () => {
  /* Vivía SOLO en el texto del correo al ciudadano: el correo prometía quince
     días que el reloj no sabía contar, y un desistimiento tácito podía
     declararse mientras la prórroga corría. */
  const COMUNICADA = '2026-06-01T12:00:00.000Z';
  const alDia = (n: number) => sumarDiasHabiles(COMUNICADA, n);

  it('sin prórroga, a los 30 días hábiles procede', () => {
    expect(procedeDesistimientoTacito({
      fechaComunicacionActa: COMUNICADA, huboRespuestaSubsanacion: false, ahora: alDia(30),
    })).toBeNull();
  });

  it('CON prórroga concedida, a los 30 NO procede — y el motivo la nombra', () => {
    const e = procedeDesistimientoTacito({
      fechaComunicacionActa: COMUNICADA, huboRespuestaSubsanacion: false, ahora: alDia(30),
      prorrogaConcedida: true,
    });
    expect(e).not.toBeNull();
    expect(e!.mensaje).toMatch(/45/);
    expect(e!.mensaje).toMatch(/prórroga concedida/);
    expect(e!.mensaje).toMatch(/2\.2\.6\.1\.2\.2\.4/);
  });

  it('con prórroga, a los 45 sí procede', () => {
    expect(procedeDesistimientoTacito({
      fechaComunicacionActa: COMUNICADA, huboRespuestaSubsanacion: false, ahora: alDia(45),
      prorrogaConcedida: true,
    })).toBeNull();
  });

  it('LA AUSENCIA DEL DATO NO ES UNA PRÓRROGA: «a solicitud de parte» no se presume', () => {
    /* Si no consta que se concedió, el plazo son 30. Presumirla protegería al
       ciudadano de un archivo — pero inventaría un hecho que nadie registró. */
    expect(procedeDesistimientoTacito({
      fechaComunicacionActa: COMUNICADA, huboRespuestaSubsanacion: false, ahora: alDia(31),
    })).toBeNull();
    expect(procedeDesistimientoTacito({
      fechaComunicacionActa: COMUNICADA, huboRespuestaSubsanacion: false, ahora: alDia(31),
      prorrogaConcedida: false,
    })).toBeNull();
  });
});

describe('el plazo del ciudadano en viabilidad (ADR-0038 §9.3)', () => {
  it('son treinta días HÁBILES, y su fuente es el artículo al que se remite', () => {
    /* Estuvo en duda: el art. 2.2.6.1.2.3.1 par. 1 dice «treinta (30) días» sin
       la palabra. No la dice porque REMITE al 2.2.6.6.8.2, que sí la escribe.
       Un artículo que remite a otro no está callando: está citando. */
    expect(DIAS_HABILES_PAGO_VIABILIDAD).toBe(30);
  });

  it('es el MISMO número que el de la subsanación, y aun así son plazos distintos', () => {
    /* Coinciden hoy y podrían dejar de coincidir: son artículos distintos, con
       hechos que los disparan distintos. Colapsarlos en una constante los ataría
       para siempre. */
    expect(DIAS_HABILES_PAGO_VIABILIDAD).toBe(DIAS_HABILES_SUBSANACION_TACITO);
  });
});
