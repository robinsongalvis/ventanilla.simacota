import { describe, expect, it } from 'vitest';
import {
  aRadicadoParaDescarga,
  autorizarDescargaArchivo,
  parsearPathArchivo,
  type RadicadoParaDescarga,
  type UsuarioParaDescarga,
} from '@/lib/seguridad/autorizar-descarga-archivo';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

const PATH_ADJUNTO = 'radicados/1-WEB-2026-00000001/1700000000_1_oficio.pdf';
const PATH_RESPUESTA = 'respuestas/1-WEB-2026-00000001/1700000099_respuesta.pdf';
const RADICADO_ID = '1-WEB-2026-00000001';

const RADICADO_BASE: RadicadoParaDescarga = {
  tenantId: 'SEC_GOBIERNO',
  adjuntosPaths: [PATH_ADJUNTO],
  respuestaOficialPath: PATH_RESPUESTA,
};

function user(rol: UsuarioParaDescarga['rol'], tenantId: UsuarioParaDescarga['tenantId'] = 'SEC_GOBIERNO'): UsuarioParaDescarga {
  return { uid: `uid-${rol}`, rol, tenantId };
}

describe('parsearPathArchivo', () => {
  it('acepta paths bien formados de adjuntos y respuestas', () => {
    expect(parsearPathArchivo(PATH_ADJUNTO)).toMatchObject({
      prefijo: 'radicados', radicadoId: RADICADO_ID,
    });
    expect(parsearPathArchivo(PATH_RESPUESTA)).toMatchObject({
      prefijo: 'respuestas', radicadoId: RADICADO_ID,
    });
  });

  it('rechaza paths peligrosos o mal formados', () => {
    expect(parsearPathArchivo(null)).toBeNull();
    expect(parsearPathArchivo('')).toBeNull();
    expect(parsearPathArchivo('   ')).toBeNull();
    expect(parsearPathArchivo('/radicados/x/y.pdf')).toBeNull();
    expect(parsearPathArchivo('radicados/../etc/passwd')).toBeNull();
    expect(parsearPathArchivo('radicados//doble/barra.pdf')).toBeNull();
    expect(parsearPathArchivo('otros/x/y.pdf')).toBeNull();             // prefijo no permitido
    expect(parsearPathArchivo('radicados/x/y/z.pdf')).toBeNull();        // segmento extra
    expect(parsearPathArchivo('radicados/x/archivo\x00.pdf')).toBeNull(); // control char
  });
});

describe('autorizarDescargaArchivo — roles globales', () => {
  /* 1 */
  it('ADMIN puede descargar adjuntos de cualquier dependencia', () => {
    const decision = autorizarDescargaArchivo({
      path: PATH_ADJUNTO,
      usuario: user('ADMIN', 'SEC_PLANEACION'),
      radicado: RADICADO_BASE,
    });
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.tipoArchivo).toBe('ADJUNTO_CIUDADANO');
      expect(decision.radicadoId).toBe(RADICADO_ID);
    }
  });

  /* 2 */
  it('RECEPCIONISTA puede descargar adjuntos de cualquier dependencia', () => {
    const decision = autorizarDescargaArchivo({
      path: PATH_ADJUNTO,
      usuario: user('RECEPCIONISTA', 'SEC_PLANEACION'),
      radicado: RADICADO_BASE,
    });
    expect(decision.ok).toBe(true);
  });

  /* 3 */
  it('CONTROL_INTERNO puede descargar adjuntos de cualquier dependencia', () => {
    const decision = autorizarDescargaArchivo({
      path: PATH_ADJUNTO,
      usuario: user('CONTROL_INTERNO', 'SEC_PLANEACION'),
      radicado: RADICADO_BASE,
    });
    expect(decision.ok).toBe(true);
  });
});

describe('autorizarDescargaArchivo — roles por dependencia', () => {
  /* 4 */
  it('FUNCIONARIO puede descargar archivos de su dependencia', () => {
    const decision = autorizarDescargaArchivo({
      path: PATH_ADJUNTO,
      usuario: user('FUNCIONARIO', 'SEC_GOBIERNO'),
      radicado: RADICADO_BASE,
    });
    expect(decision.ok).toBe(true);
  });

  /* 5 */
  it('FUNCIONARIO NO puede descargar archivos de otra dependencia', () => {
    const decision = autorizarDescargaArchivo({
      path: PATH_ADJUNTO,
      usuario: user('FUNCIONARIO', 'SEC_PLANEACION'),
      radicado: RADICADO_BASE,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
      expect(decision.motivo).toBe('SIN_PERMISO_DE_DEPENDENCIA');
      expect(decision.mensaje).not.toContain(PATH_ADJUNTO);
    }
  });

  /* 6 */
  it('JEFE_DEPENDENCIA puede descargar archivos de su dependencia', () => {
    const decision = autorizarDescargaArchivo({
      path: PATH_ADJUNTO,
      usuario: user('JEFE_DEPENDENCIA', 'SEC_GOBIERNO'),
      radicado: RADICADO_BASE,
    });
    expect(decision.ok).toBe(true);
  });

  /* 7 */
  it('JEFE_DEPENDENCIA NO puede descargar archivos de otra dependencia', () => {
    const decision = autorizarDescargaArchivo({
      path: PATH_ADJUNTO,
      usuario: user('JEFE_DEPENDENCIA', 'SEC_PLANEACION'),
      radicado: RADICADO_BASE,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
    }
  });
});

describe('autorizarDescargaArchivo — errores de autenticación y datos', () => {
  /* 8 */
  it('usuario sin sesión recibe 401', () => {
    const decision = autorizarDescargaArchivo({
      path: PATH_ADJUNTO,
      usuario: null,
      radicado: RADICADO_BASE,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(401);
      expect(decision.motivo).toBe('SESION_INVALIDA');
    }
  });

  /* 9 */
  it('path vacío o inválido recibe 400', () => {
    const decision = autorizarDescargaArchivo({
      path: '',
      usuario: user('ADMIN'),
      radicado: RADICADO_BASE,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(400);
      expect(decision.motivo).toBe('PATH_INVALIDO');
    }
  });

  /* 10 */
  it('path con ../ se rechaza con 400 (sin filtrar detalle)', () => {
    const decision = autorizarDescargaArchivo({
      path: 'radicados/x/../../etc/passwd',
      usuario: user('ADMIN'),
      radicado: RADICADO_BASE,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(400);
      expect(decision.mensaje).not.toContain('passwd');
    }
  });

  /* 11 */
  it('archivo no registrado en el radicado se rechaza con 404 uniforme', () => {
    const decision = autorizarDescargaArchivo({
      path: 'radicados/1-WEB-2026-00000001/no-existe.pdf',
      usuario: user('ADMIN'),
      radicado: RADICADO_BASE,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(404);
      expect(decision.motivo).toBe('ARCHIVO_NO_PERTENECE_AL_RADICADO');
      expect(decision.mensaje).toBe('Archivo no encontrado.');
    }
  });

  it('radicado no encontrado se rechaza con 404 con el mismo mensaje (no revela existencia)', () => {
    const decision = autorizarDescargaArchivo({
      path: PATH_ADJUNTO,
      usuario: user('ADMIN'),
      radicado: null,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(404);
      expect(decision.motivo).toBe('RADICADO_NO_ENCONTRADO');
      expect(decision.mensaje).toBe('Archivo no encontrado.');
    }
  });

  /* 12 */
  it('respuesta oficial se permite solo si el path coincide con respuestaOficial.archivoPath', () => {
    const okAdmin = autorizarDescargaArchivo({
      path: PATH_RESPUESTA,
      usuario: user('ADMIN', 'SEC_PLANEACION'),
      radicado: RADICADO_BASE,
    });
    expect(okAdmin.ok).toBe(true);
    if (okAdmin.ok) expect(okAdmin.tipoArchivo).toBe('RESPUESTA_OFICIAL');

    // Otra ruta de respuesta no registrada
    const noOk = autorizarDescargaArchivo({
      path: 'respuestas/1-WEB-2026-00000001/otra.pdf',
      usuario: user('ADMIN'),
      radicado: RADICADO_BASE,
    });
    expect(noOk.ok).toBe(false);
    if (!noOk.ok) expect(noOk.status).toBe(404);

    // Radicado sin respuestaOficial todavía
    const sinRespuesta: RadicadoParaDescarga = { ...RADICADO_BASE, respuestaOficialPath: null };
    const noResp = autorizarDescargaArchivo({
      path: PATH_RESPUESTA,
      usuario: user('ADMIN'),
      radicado: sinRespuesta,
    });
    expect(noResp.ok).toBe(false);
  });

  /* 13 */
  it('los mensajes no exponen archivoPath, bucket ni stack trace', () => {
    const decisiones = [
      autorizarDescargaArchivo({ path: '', usuario: user('ADMIN'), radicado: RADICADO_BASE }),
      autorizarDescargaArchivo({ path: PATH_ADJUNTO, usuario: null, radicado: RADICADO_BASE }),
      autorizarDescargaArchivo({ path: PATH_ADJUNTO, usuario: user('FUNCIONARIO', 'SEC_PLANEACION'), radicado: RADICADO_BASE }),
      autorizarDescargaArchivo({ path: 'radicados/1-WEB-2026-00000001/otra.pdf', usuario: user('ADMIN'), radicado: RADICADO_BASE }),
    ];
    for (const d of decisiones) {
      if (d.ok) continue;
      expect(d.mensaje).not.toContain('/');             // sin paths
      expect(d.mensaje).not.toContain('bucket');
      expect(d.mensaje).not.toMatch(/at\s+\w+/);         // sin stack
      expect(d.mensaje.length).toBeLessThan(120);
    }
  });
});

describe('aRadicadoParaDescarga', () => {
  it('extrae adjuntos y respuesta oficial del documento completo', () => {
    const doc = {
      clasificacion: { oficinaDestino: 'SEC_HACIENDA' },
      archivos: [
        { path: 'radicados/abc/1.pdf', nombre: '1.pdf' },
        { path: 'radicados/abc/2.pdf', nombre: '2.pdf' },
        { /* sin path */ nombre: 'x.pdf' },
      ],
      respuestaOficial: { archivoPath: 'respuestas/abc/r.pdf' },
    } as unknown as VentanillaRadicado;

    const r = aRadicadoParaDescarga(doc);
    expect(r).toEqual({
      tenantId: 'SEC_HACIENDA',
      adjuntosPaths: ['radicados/abc/1.pdf', 'radicados/abc/2.pdf'],
      respuestaOficialPath: 'respuestas/abc/r.pdf',
    });
  });

  it('devuelve null si no hay documento', () => {
    expect(aRadicadoParaDescarga(null)).toBeNull();
  });
});
