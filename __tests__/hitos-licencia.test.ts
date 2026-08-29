import { describe, it, expect } from 'vitest';
import { HITO_NOTIFICABLE, componerCorreoHito } from '@/lib/email/hitos-licencia';
import { buildHitoLicenciaHtml } from '@/lib/email/templates/hito-licencia';
import { ESTADO_CIUDADANO_LICENCIA } from '@/lib/seguridad/consulta-publica-licencia';
import { ESTILOS_ESTADO_JURIDICO } from '@/app/interno/licencias/estilos-estado-juridico';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';

const TODOS = Object.keys(ESTILOS_ESTADO_JURIDICO) as EstadoJuridicoLicencia[];

describe('el alcance está declarado sobre el dominio ENTERO', () => {
  it('los once estados tienen decisión: notificar o no, sin huecos', () => {
    /* Una lista de «los que sí» habría dejado un estado nuevo fuera en
       silencio — que es exactamente cómo un aviso deja de llegar sin que nadie
       se entere. */
    for (const estado of TODOS) {
      expect(HITO_NOTIFICABLE[estado], `sin decisión: ${estado}`).toBeTruthy();
    }
    expect(Object.keys(HITO_NOTIFICABLE).sort()).toEqual([...TODOS].sort());
  });

  it('cada exclusión trae su razón, no un false pelado', () => {
    for (const estado of TODOS) {
      const d = HITO_NOTIFICABLE[estado];
      if (!d.notifica) {
        expect(d.razon.length, `${estado}: excluido sin razón escrita`).toBeGreaterThan(30);
      }
    }
  });
});

describe('qué se comunica y qué no', () => {
  it('la radicación en debida forma SÍ: a partir de ahí corre el plazo', () => {
    expect(HITO_NOTIFICABLE.RADICADA_EN_DEBIDA_FORMA.notifica).toBe(true);
  });

  it('las decisiones SÍ', () => {
    for (const e of ['CONCEDIDA', 'NEGADA', 'DESISTIDA'] as const) {
      expect(HITO_NOTIFICABLE[e].notifica, `${e} debería avisarse`).toBe(true);
    }
  });

  it('el ACTA no manda hito: ya tiene su propio aviso, y es mejor', () => {
    /* Al cablear el disparador, este estado mandaba DOS correos por el mismo
       hecho. El aviso del acta imprime la fecha límite para responder; el hito
       genérico no la conoce. Dos correos por un hecho es lo que entrena a la
       gente a ignorar los nuestros. */
    expect(HITO_NOTIFICABLE.CON_ACTA_DE_OBSERVACIONES.notifica).toBe(false);
  });

  it('las etapas internas NO: serían ruido', () => {
    for (const e of ['EN_REVISION', 'EN_VIABILIDAD'] as const) {
      expect(HITO_NOTIFICABLE[e].notifica).toBe(false);
    }
  });

  it('NOTIFICADA no manda correo, y la razón es jurídica', () => {
    /* Un correo automático diciendo «ya le notificamos» podría leerse como la
       notificación misma, que tiene forma legal propia. */
    const d = HITO_NOTIFICABLE.NOTIFICADA;
    expect(d.notifica).toBe(false);
    expect(d.notifica === false && d.razon).toMatch(/notificaci/i);
  });

  it('PRESENTADA tampoco: ya se envió el acuse de recibo', () => {
    expect(HITO_NOTIFICABLE.PRESENTADA.notifica).toBe(false);
  });
});

describe('el texto sale del MISMO sitio que la consulta pública', () => {
  it('no se redacta dos veces el mismo hecho', () => {
    /* Dos redacciones divergen, y entonces el ciudadano lee una cosa en el
       correo y otra en la pantalla sobre el mismo expediente. */
    const hito = componerCorreoHito('CONCEDIDA', '1-110-202608-00000123');
    expect(hito?.titulo).toBe(ESTADO_CIUDADANO_LICENCIA.CONCEDIDA.titulo);
    expect(hito?.explicacion).toBe(ESTADO_CIUDADANO_LICENCIA.CONCEDIDA.explicacion);
  });

  it('devuelve null para un estado que no se comunica', () => {
    expect(componerCorreoHito('EN_REVISION', 'X')).toBeNull();
  });

  it('el asunto lleva el número, para que se encuentre en la bandeja', () => {
    expect(componerCorreoHito('CONCEDIDA', '1-110-202608-00000123')?.subject)
      .toContain('1-110-202608-00000123');
  });
});

describe('el correo NO se hace pasar por la notificación', () => {
  const html = () =>
    buildHitoLicenciaHtml({
      hito: componerCorreoHito('CONCEDIDA', '1-110-202608-00000123')!,
      numeroExpediente: '1-110-202608-00000123',
      solicitanteNombre: 'Ana Ruiz',
      urlConsulta: 'https://x/consulta',
    }).replace(/\s+/g, ' ');

  it('lo dice expresamente, y cita la ley', () => {
    /* Dar por notificado a alguien con un correo informativo le quitaría los
       plazos de recurso sin que se enterara. */
    expect(html()).toMatch(/no constituye la notificación/i);
    expect(html()).toMatch(/Ley 1437/);
  });

  it('y para una decisión dice que debe notificarse', () => {
    expect(html()).toMatch(/debe notificarse/i);
  });

  it('sin llamado a la acción, no se inventa uno', () => {
    const sinAccion = buildHitoLicenciaHtml({
      hito: componerCorreoHito('RADICADA_EN_DEBIDA_FORMA', 'X')!,
      numeroExpediente: 'X',
      solicitanteNombre: 'Ana',
      urlConsulta: 'https://x',
    }).replace(/\s+/g, ' ');
    expect(sinAccion).not.toMatch(/debe notificarse|debe atender/i);
  });
});
