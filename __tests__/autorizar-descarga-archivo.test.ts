import { describe, expect, it } from 'vitest';
import {
  aRadicadoParaDescarga,
  autorizarDescargaArchivo,
  autorizarDescargaDocumentoExpediente,
  autorizarDescargaSalida,
  parsearPathArchivo,
  parsearPathDocumentoExpediente,
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

  /* OJO CON EL ALCANCE (ADR-0033 §4.6-bis): el único `..` de esta lista
     ('radicados/../etc/passwd') lo tumba la FORMA —4 segmentos, y PATH_REGEX
     exige exactamente 3—, NO la guarda de `..`. La travesía que SÍ depende de
     esa guarda se vigila en el bloque «travesía de directorios» de más abajo. */
  it('rechaza paths mal FORMADOS: nulo, vacío, barra inicial, doble barra, prefijo ajeno, segmento de más, carácter de control', () => {
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

/* ══════════════════════════════════════════════════════════════
   TRAVESÍA DE DIRECTORIOS — el detector que faltaba

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Este bloque MIRA UNA SOLA COSA:
   que sigan en su sitio las dos guardas `path.includes('..')` — la de
   `parsearPathArchivo` y la de su gemela `parsearPathDocumentoExpediente`.
   NO mira roles, ni pertenencia, ni el endpoint, ni la firma de URLs, ni
   la validación de hash: de eso responden los bloques de abajo y
   `__tests__/autorizar-descarga-salida.test.ts`.

   POR QUÉ HIZO FALTA. Los TRES únicos `..` que había en toda la suite
   ('radicados/../etc/passwd', 'radicados/x/../../etc/passwd',
   'salidas/../etc/passwd') traen 4 o 6 segmentos y los tumba el REGEX, que
   exige EXACTAMENTE 3 — nunca la guarda. Borrar la línea
   `if (path.includes('..')) return null;` dejaba VERDE la suite entera: la
   travesía de 3 segmentos no la ejercitaba nadie. Comprobado por mutación.

   POR QUÉ EL REGEX NO BASTA. `..` es un segmento perfectamente legal para
   él: el punto vive DENTRO de la clase del alfabeto (`[A-Za-z0-9._-]`), así
   que 'radicados/../archivo.pdf' le encaja entero. Lo que el regex sí
   rechaza es la FORMA (prefijo ajeno, segmentos de más o de menos) y los
   caracteres fuera del alfabeto (`%2f`, controles).

   POR QUÉ LOS FIXTURES ENVENENAN LA LISTA DE PERTENENCIA. Para que el
   anti-IDOR no amortigüe la mutación: `aRadicadoParaDescarga` copia tal cual
   lo que esté escrito en `archivos[].path`, y en expedientes ni siquiera hay
   lista (se autoriza por TENANT). Con el path envenenado dentro, la guarda
   es lo único que queda en pie y el rojo dice «descarga concedida» en vez
   del tibio «404 en vez de 400».

   QUÉ NO ASEVERA. No asevera `includes` como implementación: si alguien lo
   sustituye por un análisis por segmentos —más fino y también correcto—,
   este bloque debe seguir verde, y lo estará. Tampoco asevera las otras tres
   comprobaciones de los parsers (`startsWith('/')`, `includes('//')`,
   caracteres de control): son REDUNDANTES con los dos regex, verificado
   ejecutándolos, así que borrarlas no cambia comportamiento y una prueba
   suya sería vacua.
══════════════════════════════════════════════════════════════ */
describe('travesía de directorios — la guarda de `..` que el regex NO cubre', () => {
  /* Paths de 3 segmentos que PATH_REGEX ACEPTA y que solo la guarda rechaza.
     El último (`..` como NOMBRE) es el que caza una guarda debilitada a
     `includes('../')` o `startsWith('..')`. */
  it.each([
    'radicados/../archivo.pdf',
    'respuestas/../archivo.pdf',
    'salidas/../oficio_firmado.pdf',
    `radicados/${RADICADO_ID}/..`,
  ] as const)('parsearPathArchivo devuelve null para «%s»', (path) => {
    expect(
      parsearPathArchivo(path),
      `TRAVESÍA DE DIRECTORIOS ABIERTA con «${path}». Este path tiene los 3 segmentos que exige `
      + 'PATH_REGEX y solo caracteres de su alfabeto (el punto vive DENTRO de la clase '
      + '[A-Za-z0-9._-]), así que EL REGEX LO ACEPTA. La única barrera es la línea '
      + "includes('..') de parsearPathArchivo, en lib/seguridad/autorizar-descarga-archivo.ts. "
      + 'Si la borraste creyéndola redundante: no lo es. Vuelve a ponerla.',
    ).toBeNull();
  });

  it('control de representatividad: PATH_REGEX sigue aceptando 3 segmentos CON puntos', () => {
    /* Este control NO es una segunda barrera de seguridad: es la declaración de
       QUÉ hace representativo al fixture de arriba. Si alguien ensancha o
       endurece el alfabeto de PATH_REGEX, los `..` de la prueba anterior
       podrían empezar a caer por la FORMA y quedarse verdes vigilando nada.
       Cubre el endurecimiento AMPLIO (sacar el punto del alfabeto); un
       endurecimiento quirúrgico anti-`..` no lo cazaría — pero ése deja la
       protección en pie, así que el silencio ahí no abre ningún hueco. */
    const mensaje = 'el fixture de travesía dejó de ser representativo: un path de 3 segmentos '
      + 'con puntos ya no se acepta, así que los «..» de la prueba anterior podrían estar '
      + 'cayendo por la FORMA y no por la guarda. Revisa PATH_REGEX antes de dar por buena '
      + 'esta vigilancia.';
    expect(parsearPathArchivo('radicados/a.b/archivo.pdf'), mensaje)
      .toMatchObject({ prefijo: 'radicados', radicadoId: 'a.b' });
    expect(parsearPathArchivo(`radicados/${RADICADO_ID}/.pdf`), mensaje)
      .toMatchObject({ prefijo: 'radicados', nombre: '.pdf' });
  });

  it('parsearPathDocumentoExpediente devuelve null cuando el NOMBRE de archivo es «..»', () => {
    expect(
      parsearPathDocumentoExpediente('expedientes/exp-0001/doc-0001/v0001/..'),
      'TRAVESÍA DE DIRECTORIOS ABIERTA en documentos de expediente: '
      + 'PATH_REGEX_DOCUMENTO_EXPEDIENTE acepta «..» como nombre de archivo, porque su último '
      + 'segmento admite el punto ([A-Za-z0-9._- ]). En expedienteId/documentoId no cabe (su '
      + "alfabeto, [A-Za-z0-9-], no tiene punto), pero en el nombre sí: la guarda includes('..') "
      + 'de parsearPathDocumentoExpediente es gemela de la de parsearPathArchivo y tan poco '
      + 'redundante como ella. Vuelve a ponerla.',
    ).toBeNull();
  });

  it('control de representatividad (gemela): el último segmento sigue admitiendo puntos', () => {
    expect(
      parsearPathDocumentoExpediente('expedientes/exp-0001/doc-0001/v0001/informe.final.pdf'),
      'el fixture de travesía de expedientes dejó de ser representativo: si el último segmento '
      + 'ya no admite puntos, el «..» de la prueba anterior podría estar cayendo por la FORMA y '
      + 'no por la guarda. Revisa PATH_REGEX_DOCUMENTO_EXPEDIENTE en '
      + 'lib/server/expedientes-documentos-tipos.ts antes de dar por buena esta vigilancia.',
    ).toMatchObject({
      expedienteId: 'exp-0001',
      documentoId:  'doc-0001',
      idVersion:    'v0001',
      nombre:       'informe.final.pdf',
    });
  });

  it('autorizarDescargaArchivo muere en el PARSEO aunque el path envenenado esté registrado como adjunto', () => {
    const ENVENENADO = 'radicados/../archivo.pdf';
    const decision = autorizarDescargaArchivo({
      path: ENVENENADO,
      usuario: user('ADMIN'),
      /* A propósito DENTRO de la lista: si ese path llegó a escribirse en
         `archivos[].path`, `aRadicadoParaDescarga` lo copia tal cual y
         `pertenece()` dice que sí. La pertenencia no puede salvar esto. */
      radicado: { ...RADICADO_BASE, adjuntosPaths: [ENVENENADO] },
    });
    expect(
      decision.ok,
      `DESCARGA DE TRAVESÍA CONCEDIDA: con «${ENVENENADO}» registrado como adjunto, la guarda `
      + "includes('..') era la única barrera. Sin ella este path sale AUTORIZADO y "
      + '/api/interno/archivo le firma una URL de Storage con ese nombre de objeto — que los '
      + 'consumidores que SÍ resuelven rutas (respaldo/restauración de adjuntos, mirrors '
      + 'locales) interpretan como salida del directorio.',
    ).toBe(false);
    if (!decision.ok) {
      expect(
        decision.motivo,
        'la travesía se rechazó por el motivo equivocado: tiene que morir en el PARSEO '
        + '(PATH_INVALIDO, 400). Si llega hasta la pertenencia o el rol, el parser ya la dio '
        + 'por buena y la guarda no está haciendo su trabajo.',
      ).toBe('PATH_INVALIDO');
      expect(decision.status).toBe(400);
    }
  });

  it('autorizarDescargaSalida muere en el PARSEO aunque el path envenenado sea el archivoPath de la salida', () => {
    const ENVENENADO = 'salidas/../oficio_firmado.pdf';
    const decision = autorizarDescargaSalida({
      path: ENVENENADO,
      usuario: user('ADMIN'),
      salida: { dependenciaOrigen: 'SEC_GOBIERNO', archivoPath: ENVENENADO },
    });
    expect(
      decision.ok,
      `DESCARGA DE TRAVESÍA CONCEDIDA por la puerta de salidas con «${ENVENENADO}» como `
      + "archivoPath de la salida. Esta puerta comparte parsearPathArchivo, así que borrar su "
      + "guarda includes('..') abre también el oficio 2-SAL, no solo los adjuntos del radicado.",
    ).toBe(false);
    if (!decision.ok) {
      expect(
        decision.motivo,
        'la travesía se rechazó por el motivo equivocado: tiene que morir en el PARSEO '
        + '(PATH_INVALIDO, 400), no en la pertenencia ni en el rol.',
      ).toBe('PATH_INVALIDO');
      expect(decision.status).toBe(400);
    }
  });

  it('autorizarDescargaDocumentoExpediente muere en el PARSEO — ahí no hay lista de pertenencia que amortigüe', () => {
    const ENVENENADO = 'expedientes/exp-0001/doc-0001/v0001/..';
    const decision = autorizarDescargaDocumentoExpediente({
      path: ENVENENADO,
      usuario: user('ADMIN'),
      expediente: { tenantId: 'SEC_GOBIERNO' },
    });
    expect(
      decision.ok,
      `DESCARGA DE TRAVESÍA CONCEDIDA en expedientes con «${ENVENENADO}»: esta puerta autoriza `
      + "por TENANT, sin lista de paths que amortigüe. Sin la guarda includes('..') de "
      + 'parsearPathDocumentoExpediente el path sale AUTORIZADO y el endpoint baja de Storage '
      + 'los bytes del objeto que se llame así.',
    ).toBe(false);
    if (!decision.ok) {
      expect(
        decision.motivo,
        'la travesía se rechazó por el motivo equivocado: tiene que morir en el PARSEO '
        + '(PATH_INVALIDO, 400), antes de tocar el expediente o el rol.',
      ).toBe('PATH_INVALIDO');
      expect(decision.status).toBe(400);
    }
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
  /* ALCANCE (ADR-0033 §4.6-bis): a este path lo tumba la FORMA —6 segmentos, y
     PATH_REGEX exige 3—, NO la guarda de `..`. Lo que esta prueba vigila de
     verdad es que el MENSAJE de un 400 no filtre el path. La guarda de `..` la
     vigila el bloque «travesía de directorios». */
  it('path de 6 segmentos con ../ se rechaza con 400 por FORMA, y el mensaje no filtra el detalle', () => {
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
