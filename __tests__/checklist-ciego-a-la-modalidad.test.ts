import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { calcularCompletitudExpediente } from '@/lib/server/completitud-expediente';
import { MODALIDADES_CONSTRUCCION } from '@/lib/motor-expedientes/catalogo-subtipos-normativo';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
import {
  describirTramiteDesdeSubtipos,
  DESCRIPCION_TRAMITE_SIN_FIGURA,
} from '@/lib/motor-expedientes/describir-tramite';

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  UNA MINA, Y SU ESPOLETA.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * EL DEFECTO. El sistema VALIDA la modalidad del trámite contra el catálogo
 * normativo —nueve modalidades de construcción, del art. 2.2.6.1.1.7— y tres
 * líneas después LA IGNORA: escribe siempre `tramiteId` de obra nueva, y
 * `calcularCompletitudExpediente` evalúa contra esa única definición sin mirar
 * de qué modalidad se trata.
 *
 * Traducido al mostrador: alguien abre un expediente de DEMOLICIÓN y el
 * sistema le exige los diecinueve requisitos de OBRA NUEVA — proyecto
 * arquitectónico incluido, para tumbar una casa.
 *
 * POR QUÉ NO HA EXPLOTADO. El acto de radicar rechaza con 422 todo expediente
 * marcado `esPrueba`, y hoy TODOS nacen así por el candado R10. El defecto está
 * aguas abajo de un guard que no lo deja llegar.
 *
 * CUÁNDO EXPLOTA. El día exacto en que se quite `esPrueba` — que es una de las
 * tres precondiciones pendientes del propietario para operar de verdad. Ese día,
 * sin esta prueba, el defecto llega a producción sin que nadie lo supervise.
 *
 * QUÉ HACE ESTA PRUEBA. No congela el defecto ni finge que está resuelto:
 * ACOPLA la mina a su espoleta. Mientras la completitud siga siendo ciega a la
 * modalidad, el guard de `esPrueba` es obligatorio. Quitarlo pone esto en rojo
 * con instrucciones — que es exactamente el supervisor que hoy no hay.
 *
 * ── LA SEGUNDA SUPERFICIE ─────────────────────────────────────────────────
 *
 * La misma ceguera llegaba a los PAPELES QUE RECIBE EL CIUDADANO: la constancia
 * impresa y el acuse de recibo tomaban su descripción de la única definición
 * cableada, y le decían «licencia de construcción · obra nueva» a todo el
 * mundo. Un acto de reconocimiento recibía un papel de la Secretaría de
 * Planeación afirmando algo que nunca solicitó.
 *
 * Eso ya está corregido —la figura sale del expediente— y el tercer bloque de
 * esta prueba lo sostiene, incluida la parte que NO se puede corregir todavía:
 * el sistema no captura la modalidad en ninguna parte, así que los papeles no
 * la nombran. Si alguien vuelve a imprimir una modalidad sin capturarla antes,
 * esto se pone rojo.
 *
 * Hallazgo original de la auditoría de #234. Aviso para quien lea esto luego:
 * dije en su día que esa auditoría «caducó en casi todo lo demás» y era falso
 * —salió de una muestra, no de una lectura completa—. El repaso exhaustivo
 * encontró viva buena parte de su diagnóstico; el inventario verificado quedó
 * en el comentario de cierre de #234.
 */

const RUTA_COMPLETITUD = 'lib/server/completitud-expediente.ts';
const RUTA_EXPEDIENTES = 'lib/server/expedientes-licencias.ts';
const COMPLETITUD = readFileSync(RUTA_COMPLETITUD, 'utf8');
const EXPEDIENTES = readFileSync(RUTA_EXPEDIENTES, 'utf8');

/** Quita comentarios: la prosa de este repositorio NOMBRA los defectos que
 *  documenta, así que grepear el archivo entero confunde la explicación con el
 *  código. La primera versión de esta prueba leyó la palabra «modalidad» en un
 *  JSDoc, concluyó que el checklist ya estaba parametrizado, y se saltó en
 *  silencio los dos casos que importan. Falso verde dentro de la prueba escrita
 *  para impedir falsos verdes. */
function soloCodigo(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** ¿La completitud sigue evaluando contra una definición fija? */
function esCiegaALaModalidad(): boolean {
  const firma = soloCodigo(COMPLETITUD.slice(
    COMPLETITUD.indexOf('export function calcularCompletitudExpediente'),
    COMPLETITUD.indexOf('export function resumenDocumentosAcuse'),
  ));
  const recibeModalidad = /subtipos|tramiteId|modalidad|definicion\s*[:?]/i.test(firma);
  const usaLaConstante = /const tramite = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL/.test(firma);
  return usaLaConstante && !recibeModalidad;
}

/** El guard, buscado en el CÓDIGO del evaluador de radicación, no en la prosa. */
function elActoRechazaLosDePrueba(): boolean {
  return /if\s*\(\s*exp\.esPrueba === true\s*\)/.test(soloCodigo(EXPEDIENTES));
}

describe('la mina: el checklist no mira la modalidad', () => {
  it('el catálogo reconoce nueve modalidades y solo existe UNA definición', () => {
    expect(MODALIDADES_CONSTRUCCION.length).toBeGreaterThan(1);
    expect(DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id).toBe('licencia-construccion-obra-nueva');
  });

  it('la modalidad se valida contra el catálogo… y luego se descarta', () => {
    expect(EXPEDIENTES).toMatch(/CODIGOS_CATALOGO_NORMATIVO\.has\(codigo\)/);
    expect(EXPEDIENTES).toMatch(/tramiteId: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL\.id/);
  });

  /* La demostración de que el efecto es real, no una lectura del código: un
     expediente sin ningún aporte devuelve los requisitos de OBRA NUEVA, sea
     cual sea su modalidad — porque la modalidad ni siquiera entra. */
  it('un expediente de demolición recibiría el checklist de obra nueva', () => {
    const r = calcularCompletitudExpediente([], {
      esApoderado: false,
      predioRodeadoEspacioPublico: false,
      categoriaComplejidad: 'BAJA',
      sujetoTituloENSR10: true,
    }, new Date('2026-08-27T12:00:00Z'));

    const nombres = r.faltantes.map((f) => f.nombre.toLowerCase()).join(' | ');
    expect(r.completo).toBe(false);
    expect(
      nombres,
      'La completitud exige el proyecto arquitectónico sin preguntar si el trámite es una demolición.',
    ).toMatch(/proyecto arquitect/);
  });
});

describe('la espoleta: mientras el checklist sea ciego, el guard es obligatorio', () => {
  /**
   * ESTA ES LA PRUEBA QUE IMPORTA.
   *
   * Si alguien quita el guard de `esPrueba` sin haber parametrizado el
   * checklist por modalidad, este caso se pone rojo y dice qué hacer. Es el
   * único supervisor que hay entre el defecto y el mostrador.
   */
  it('si la completitud ignora la modalidad, el acto de radicar DEBE rechazar los expedientes de prueba', () => {
    /* SIN RETORNO TEMPRANO, a propósito. Un `return` aquí haría que la prueba
       pasara tanto si el defecto se corrigió como si el detector se equivocó —
       y no habría forma de distinguirlas. Se afirma el estado y se actúa sobre
       él, de modo que un detector roto se ve como un fallo, no como un verde. */
    const ciega = esCiegaALaModalidad();
    if (!ciega) {
      /* El defecto se corrigió: la completitud ya recibe la modalidad. El guard
         puede irse cuando el propietario decida, y esta prueba deja de tener
         objeto — bórrela en el mismo commit que lo quite. */
      expect(COMPLETITUD).toMatch(/subtipos|tramiteId|modalidad/);
      return;
    }

    expect(
      elActoRechazaLosDePrueba(),
      [
        'El checklist de completitud SIGUE siendo ciego a la modalidad —evalúa siempre contra',
        'la definición de obra nueva— y el guard de `esPrueba` acaba de desaparecer del acto',
        'de radicar. Sin ese guard, el primer expediente real de demolición, ampliación o',
        'cerramiento recibirá los requisitos de OBRA NUEVA.',
        '',
        'Antes de quitar el guard hay que hacer UNA de estas dos cosas:',
        '  (a) parametrizar `calcularCompletitudExpediente` por modalidad, o',
        '  (b) rechazar explícitamente las modalidades sin definición propia,',
        '      con un mensaje que diga cuál falta.',
        '',
        'Lo que no se puede es quitarlo y seguir: el defecto llegaría al mostrador sin nadie',
        'que lo viera. Ver la auditoría de #234.',
      ].join('\n'),
    ).toBe(true);
  });

  it('y el guard rechaza con un mensaje que se puede accionar', () => {
    const i = EXPEDIENTES.indexOf('esPrueba === true');
    expect(i, 'el guard ya no está: ver el caso anterior').toBeGreaterThan(-1);
    expect(EXPEDIENTES.slice(i, i + 400)).toMatch(/422|demostración/i);
  });

  /* El detector es la pieza de la que depende todo lo anterior. Si se rompe,
     los dos casos de arriba se vuelven inertes sin decirlo — que es justo lo
     que pasó en la primera versión de este archivo. */
  it('el detector distingue el estado actual, y no se deja engañar por la prosa', () => {
    expect(esCiegaALaModalidad(), 'hoy la completitud SÍ es ciega a la modalidad').toBe(true);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   LA SEGUNDA SUPERFICIE: LOS PAPELES QUE RECIBE EL CIUDADANO.

   La constancia impresa y el acuse de recibo son documentos con efectos, y
   afirmaban un trámite que el expediente no decía. Aquí la mina protege
   también esos dos papeles.
   ───────────────────────────────────────────────────────────────────────── */

const RUTA_CONSTANCIA = 'app/api/licencias/expedientes/[id]/constancia/route.ts';
const RUTA_ACUSE = 'app/api/licencias/expedientes/desde-radicado/route.ts';
const CONSTANCIA = readFileSync(RUTA_CONSTANCIA, 'utf8');
const ACUSE = readFileSync(RUTA_ACUSE, 'utf8');

/** ¿Algún sitio GUARDA la modalidad del trámite? Se busca en el código —no en
 *  la prosa— del módulo que escribe los expedientes: si un día se captura,
 *  será ahí donde se escriba el campo. */
function elSistemaCapturaLaModalidad(): boolean {
  return /modalidad\w*\s*:/.test(soloCodigo(EXPEDIENTES));
}

describe('los papeles del ciudadano: la figura sale del expediente', () => {
  it('ninguno de los dos papeles toma su descripción de la definición cableada', () => {
    for (const [ruta, fuente] of [[RUTA_CONSTANCIA, CONSTANCIA], [RUTA_ACUSE, ACUSE]] as const) {
      expect(
        soloCodigo(fuente),
        `${ruta}: el papel volvió a describir el trámite con la constante de obra nueva. ` +
          'La figura tiene que salir de `expediente.subtipos` — ver `lib/motor-expedientes/describir-tramite.ts`.',
      ).not.toMatch(/descripcionTramite:\s*DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL/);
      expect(
        soloCodigo(fuente),
        `${ruta}: el papel ya no deriva la figura del expediente.`,
      ).toMatch(/descripcionTramite:\s*describirTramiteDesdeSubtipos\(/);
    }
  });

  it('cada figura del catálogo se nombra como ella misma, no como obra nueva', () => {
    expect(describirTramiteDesdeSubtipos(['RECONOCIMIENTO'])).toMatch(/reconocimiento/);
    expect(describirTramiteDesdeSubtipos(['URBANIZACION'])).toMatch(/urbanizaci/);
    expect(describirTramiteDesdeSubtipos(['CONSTRUCCION'])).toMatch(/construcci/);
    /* Varias figuras en una misma solicitud: se nombran TODAS. Omitir una
       sería describir de menos lo que el ciudadano pidió. */
    const dos = describirTramiteDesdeSubtipos(['URBANIZACION', 'CONSTRUCCION']);
    expect(dos).toMatch(/urbanizaci/);
    expect(dos).toMatch(/construcci/);
  });

  it('un código que el catálogo no conoce se transcribe, no se descarta en silencio', () => {
    /* Descartarlo sería el defecto original cambiado de sitio: el papel
       quedaría describiendo de menos sin que nadie lo notara. */
    expect(describirTramiteDesdeSubtipos(['LCR VISR'])).toContain('LCR VISR');
    expect(describirTramiteDesdeSubtipos([])).toBe(DESCRIPCION_TRAMITE_SIN_FIGURA);
    expect(describirTramiteDesdeSubtipos(undefined)).toBe(DESCRIPCION_TRAMITE_SIN_FIGURA);
  });

  /**
   * LA ESPOLETA DE LOS PAPELES.
   *
   * Mientras el sistema no capture la modalidad, ningún papel puede nombrar
   * una. Si alguien vuelve a escribir «obra nueva» —o cualquiera de las otras
   * ocho— en la descripción del trámite sin haberla capturado antes, este caso
   * se pone rojo y dice por qué.
   */
  it('mientras nadie capture la modalidad, los papeles no nombran ninguna', () => {
    const capturada = elSistemaCapturaLaModalidad();
    if (capturada) {
      /* Se empezó a capturar: los papeles PUEDEN nombrarla, y este caso deja de
         tener objeto. Se afirma el hecho en vez de callarlo. */
      expect(soloCodigo(EXPEDIENTES)).toMatch(/modalidad/i);
      return;
    }

    const descripciones = [
      describirTramiteDesdeSubtipos(['CONSTRUCCION']),
      describirTramiteDesdeSubtipos(['RECONOCIMIENTO']),
      describirTramiteDesdeSubtipos(['URBANIZACION', 'CONSTRUCCION']),
    ].join(' | ').toLowerCase();

    const nombradas = MODALIDADES_CONSTRUCCION
      .map((m) => m.nombre.toLowerCase())
      .filter((nombre) => descripciones.includes(nombre));

    expect(
      nombradas,
      [
        `El papel del ciudadano nombra una modalidad (${nombradas.join(', ')}) que el sistema`,
        'NO captura en ninguna parte: no es un subtipo, no es una clave de contexto, no hay',
        'campo que la guarde. Nadie se la pregunta al funcionario.',
        '',
        'Es un documento con efectos: afirmar en él una modalidad inventada es lo que esta',
        'prueba existe para impedir. Antes de nombrarla hay que capturarla — y entonces este',
        'caso lo detecta solo y deja de exigirlo.',
      ].join('\n'),
    ).toEqual([]);
  });
});
