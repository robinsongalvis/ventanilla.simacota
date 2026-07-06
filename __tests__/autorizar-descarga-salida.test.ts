import { describe, expect, it } from 'vitest';
import {
  aSalidaParaDescarga,
  autorizarDescargaArchivo,
  autorizarDescargaSalida,
  parsearPathArchivo,
  type SalidaParaDescarga,
  type UsuarioParaDescarga,
} from '@/lib/seguridad/autorizar-descarga-archivo';
import type { SalidaOficial } from '@/src/types/salida';

/* ══════════════════════════════════════════════════════════════
   Fase B · PDF adjunto — autorización de descarga del oficio 2-SAL.

   Espejo exacto de las reglas de lectura del libro: Admin, Recepción
   y Control Interno global; funcionario y jefe solo si la salida la
   despachó su dependencia. Mismas garantías anti-IDOR de H-01.
══════════════════════════════════════════════════════════════ */

const SALIDA_ID = '2-SAL-2026-00000034';
const PATH_OFICIO = `salidas/${SALIDA_ID}/1700000000_oficio_firmado.pdf`;

const SALIDA_BASE: SalidaParaDescarga = {
  dependenciaOrigen: 'SEC_GOBIERNO',
  archivoPath: PATH_OFICIO,
};

function user(rol: UsuarioParaDescarga['rol'], tenantId: UsuarioParaDescarga['tenantId'] = 'SEC_GOBIERNO'): UsuarioParaDescarga {
  return { uid: `uid-${rol}`, rol, tenantId };
}

describe('parsearPathArchivo — prefijo salidas', () => {
  /* 1 */
  it('acepta paths bien formados de oficios de salida', () => {
    expect(parsearPathArchivo(PATH_OFICIO)).toMatchObject({
      prefijo: 'salidas', radicadoId: SALIDA_ID,
    });
  });

  /* 2 */
  it('sigue rechazando paths peligrosos con el prefijo nuevo', () => {
    expect(parsearPathArchivo('salidas/../etc/passwd')).toBeNull();
    expect(parsearPathArchivo('salidas//doble/barra.pdf')).toBeNull();
    expect(parsearPathArchivo(`/salidas/${SALIDA_ID}/x.pdf`)).toBeNull();
    expect(parsearPathArchivo(`salidas/${SALIDA_ID}/a/b.pdf`)).toBeNull();
  });
});

describe('autorizarDescargaSalida', () => {
  /* 3 · roles globales descargan de cualquier dependencia */
  it.each(['ADMIN', 'RECEPCIONISTA', 'CONTROL_INTERNO'] as const)(
    '%s descarga el oficio de cualquier dependencia',
    (rol) => {
      const decision = autorizarDescargaSalida({
        path: PATH_OFICIO,
        usuario: user(rol, 'SEC_PLANEACION'),
        salida: SALIDA_BASE,
      });
      expect(decision.ok).toBe(true);
      if (decision.ok) {
        expect(decision.tipoArchivo).toBe('OFICIO_SALIDA');
        expect(decision.radicadoId).toBe(SALIDA_ID);
      }
    },
  );

  /* 4 · funcionario/jefe solo de su dependencia */
  it('FUNCIONARIO descarga si la salida la despachó su dependencia', () => {
    expect(autorizarDescargaSalida({
      path: PATH_OFICIO,
      usuario: user('FUNCIONARIO', 'SEC_GOBIERNO'),
      salida: SALIDA_BASE,
    }).ok).toBe(true);
  });

  /* 5 */
  it('JEFE_DEPENDENCIA de otra dependencia recibe 403', () => {
    const decision = autorizarDescargaSalida({
      path: PATH_OFICIO,
      usuario: user('JEFE_DEPENDENCIA', 'SEC_HACIENDA'),
      salida: SALIDA_BASE,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
      expect(decision.motivo).toBe('SIN_PERMISO_DE_DEPENDENCIA');
    }
  });

  /* 6 · anti-IDOR: el path debe ser EXACTAMENTE el de la salida */
  it('rechaza con 404 un path que no pertenece a la salida', () => {
    const decision = autorizarDescargaSalida({
      path: `salidas/${SALIDA_ID}/otro_archivo.pdf`,
      usuario: user('ADMIN'),
      salida: SALIDA_BASE,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(404);
      expect(decision.motivo).toBe('ARCHIVO_NO_PERTENECE_A_LA_SALIDA');
      expect(decision.mensaje).toBe('Archivo no encontrado.');
    }
  });

  /* 7 · salida sin archivo o inexistente: mismo mensaje uniforme */
  it('rechaza con 404 uniforme cuando la salida no existe o no tiene PDF', () => {
    const sinSalida = autorizarDescargaSalida({
      path: PATH_OFICIO, usuario: user('ADMIN'), salida: null,
    });
    const sinPdf = autorizarDescargaSalida({
      path: PATH_OFICIO, usuario: user('ADMIN'),
      salida: { ...SALIDA_BASE, archivoPath: null },
    });
    for (const d of [sinSalida, sinPdf]) {
      expect(d.ok).toBe(false);
      if (!d.ok) {
        expect(d.status).toBe(404);
        expect(d.mensaje).toBe('Archivo no encontrado.');
      }
    }
  });

  /* 8 · sin sesión: 401 */
  it('rechaza con 401 sin usuario', () => {
    const decision = autorizarDescargaSalida({
      path: PATH_OFICIO, usuario: null, salida: SALIDA_BASE,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.status).toBe(401);
  });

  /* 9 · un path de radicados no entra por esta puerta */
  it('rechaza con 400 un path que no es del prefijo salidas', () => {
    const decision = autorizarDescargaSalida({
      path: 'respuestas/1-WEB-2026-00000001/x.pdf',
      usuario: user('ADMIN'),
      salida: SALIDA_BASE,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.status).toBe(400);
  });
});

describe('defensa en profundidad entre puertas', () => {
  /* 10 · un path de salidas jamás autoriza por la puerta de radicados */
  it('autorizarDescargaArchivo niega paths de salidas aunque el radicado exista', () => {
    const decision = autorizarDescargaArchivo({
      path: PATH_OFICIO,
      usuario: user('ADMIN'),
      radicado: {
        tenantId: 'SEC_GOBIERNO',
        adjuntosPaths: [PATH_OFICIO], // ni siquiera inyectándolo como adjunto
        respuestaOficialPath: PATH_OFICIO,
      },
    });
    expect(decision.ok).toBe(false);
  });

  /* 11 · el extractor del doc de salida */
  it('aSalidaParaDescarga extrae dependencia y path', () => {
    const doc = {
      salidaId: SALIDA_ID, consecutivo: 34, fechaSalida: '2026-07-06T15:00:00.000Z',
      tipoSalida: 'RESPUESTA', radicadoEntradaId: '1-WEB-2026-00000001',
      destinatario: { nombre: 'María' }, asunto: 'Respuesta',
      dependenciaOrigen: 'SEC_GOBIERNO',
      firmante: { uid: 'u', nombre: 'F' }, medioEnvio: 'CORREO',
      registradoPor: { uid: 'u', nombre: 'L' },
      archivoPath: PATH_OFICIO,
    } as SalidaOficial;
    expect(aSalidaParaDescarga(doc)).toEqual({
      dependenciaOrigen: 'SEC_GOBIERNO',
      archivoPath: PATH_OFICIO,
    });
    expect(aSalidaParaDescarga(null)).toBeNull();
  });
});
