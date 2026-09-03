import { describe, expect, it } from 'vitest';
import { buildConstanciaRadicacionLicenciaHtml } from '@/lib/constancias/constancia-radicacion-licencia';
import {
  buildAcuseReciboExpedienteHtml,
  buildAcuseReciboExpedienteSubject,
} from '@/lib/email/templates/acuse-recibo-expediente-licencia';
import { contenidoConstanciaPaquete } from '@/lib/sello/paquete-sellado';
import { filasSello } from '@/lib/sello/generar-sello-pdf';
import { enMayusculaInicial } from '@/lib/motor-expedientes/describir-tramite';

/* ══════════════════════════════════════════════════════════════
   LOS PAPELES MUESTRAN LOS DOS NÚMEROS, ETIQUETADOS — custodio del paso 2
   del ADR-0041 (2-sep-2026).

   El expediente de licencias pasa a tener dos números con significados
   distintos: el `1-110-…` de ENTRADA (el que el ciudadano tiene y el que
   sirve para consultar en línea) y el `68745-…` del EXPEDIENTE en Planeación.
   Los papeles tienen que mostrar ambos y decir cuál es cuál — dos números sin
   etiqueta obligan al ciudadano a adivinar y a la funcionaria a explicárselo
   en cada visita.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA, sobre los CUATRO papeles
   y en las DOS direcciones:
     · con los dos números: aparecen ambos, cada uno bajo su rótulo, y el
       papel dice cuál sirve para consultar en línea;
     · con uno solo (la situación de HOY): el papel se ve exactamente como
       antes — ni etiqueta vacía, ni rótulo colgando, ni el mismo número
       repetido bajo dos nombres.
   Esto NO mira: el dibujo del PDF (posiciones y tamaños — custodiados en
   `sello-pdf-*`), ni las pantallas (React, custodiadas aparte).
══════════════════════════════════════════════════════════════ */

const ENTRADA = '1-110-202609-00000041';
const EXPEDIENTE = '68745-0-26-0021';

describe('la carátula del paquete', () => {
  const base = {
    numeroRadicado: ENTRADA,
    solicitanteNombre: 'Andrés Pérez',
    solicitanteDocumento: 'CC 123446432',
    descripcionTramite: 'Licencia de urbanización',
    desdeCuandoCorreElPlazo: '2026-09-01T13:00:00.000Z',
    requisitosVerificados: 18,
    funcionarioNombre: 'Funcionaria de Planeación',
    expedidaEnLegible: '1 de septiembre de 2026, 12:00 p. m.',
  };

  it('con los dos: cada número bajo su rótulo, y dice cuál sirve para consultar', () => {
    const c = contenidoConstanciaPaquete({ ...base, numeroExpediente: EXPEDIENTE }, [], []);
    expect(c.numeros).toEqual([
      { etiqueta: 'RADICADO DE ENTRADA (Ventanilla)', valor: ENTRADA },
      { etiqueta: 'EXPEDIENTE (Planeación)', valor: EXPEDIENTE },
    ]);
    expect(c.notaConsulta).toMatch(/consultar en l[ií]nea/i);
    expect(c.notaConsulta).toMatch(/RADICADO DE ENTRADA/);
  });

  it('con uno solo: un número, y NINGUNA nota que sobre', () => {
    /* La situación de hoy. Si esto se rompiera, el papel actual saldría con
       un rótulo colgando o una instrucción sobre un número que no existe. */
    const c = contenidoConstanciaPaquete(base, [], []);
    expect(c.numeros).toHaveLength(1);
    expect(c.numeros[0].valor).toBe(ENTRADA);
    expect(c.notaConsulta).toBeNull();
  });
});

describe('el sello estampado', () => {
  const datos = { radicadoId: ENTRADA, fechaHoraLegible: '1 de septiembre de 2026, 8:00 a. m.' };

  it('con expediente: aparece la línea «Exp.» — y el de entrada sigue siendo el titular', () => {
    const filas = filasSello({ ...datos, numeroExpediente: EXPEDIENTE });
    const textos = filas.map((f) => f.texto);
    expect(textos).toContain(ENTRADA);
    expect(textos).toContain(`Exp. ${EXPEDIENTE}`);
    /* El orden importa: el sello dice «RECIBIDO POR VENTANILLA ÚNICA», así que
       el número de entrada va inmediatamente debajo de ese rótulo. */
    expect(textos.indexOf(ENTRADA)).toBeLessThan(textos.indexOf(`Exp. ${EXPEDIENTE}`));
  });

  it('sin expediente: el sello de ventanilla queda EXACTO — tres filas, sin «Exp.»', () => {
    expect(filasSello(datos).map((f) => f.texto)).toEqual([
      'RECIBIDO POR VENTANILLA ÚNICA',
      ENTRADA,
      datos.fechaHoraLegible,
    ]);
  });

  it('con expediente Y folio: cinco filas, y ninguna pisa a la siguiente', () => {
    const filas = filasSello({ ...datos, numeroExpediente: EXPEDIENTE }, { n: 3, de: 28 });
    expect(filas).toHaveLength(5);
    for (let i = 1; i < filas.length; i += 1) {
      expect(
        filas[i].dy - filas[i - 1].dy,
        `«${filas[i].texto}» queda a ${filas[i].dy - filas[i - 1].dy} pt de «${filas[i - 1].texto}» y no cabe`,
      ).toBeGreaterThanOrEqual(filas[i].tamano);
    }
  });
});

describe('la constancia de radicación', () => {
  const base = {
    numeroRadicado: ENTRADA,
    solicitanteNombre: 'Andrés Pérez',
    solicitanteDocumento: '123446432',
    tipoDocumento: 'CC',
    descripcionTramite: 'licencia de urbanización',
    desdeCuandoCorreElPlazo: '2026-09-01T13:00:00.000Z',
    venceEl: '2026-11-05T13:00:00.000Z',
    requisitosVerificados: 18,
    funcionarioNombre: 'Funcionaria de Planeación',
    expedidaEn: '2026-09-01T17:00:00.000Z',
  };

  it('con los dos: ambos números, ambos rótulos, y la nota de consulta', () => {
    const html = buildConstanciaRadicacionLicenciaHtml({ ...base, numeroExpediente: EXPEDIENTE });
    expect(html).toContain(ENTRADA);
    expect(html).toContain(EXPEDIENTE);
    expect(html).toMatch(/de entrada \(Ventanilla\)/i);
    expect(html).toMatch(/expediente \(Planeaci[oó]n\)/i);
    expect(html).toMatch(/consultar en l[ií]nea/i);
  });

  it('con uno solo: el rótulo NO se ensucia con la aclaración que no hace falta', () => {
    const html = buildConstanciaRadicacionLicenciaHtml(base);
    expect(html).toMatch(/Número de radicado</);
    expect(html).not.toMatch(/de entrada \(Ventanilla\)/i);
    expect(html).not.toMatch(/consultar en l[ií]nea/i);
  });
});

describe('el acuse por correo', () => {
  const base = {
    numeroRadicado: ENTRADA,
    solicitanteNombre: 'Andrés Pérez',
    solicitanteDocumento: '123446432',
    tipoDocumento: 'CC',
    descripcionTramite: 'licencia de urbanización',
    fechaRecepcion: '2026-09-01T13:00:00.000Z',
    documentosEntregados: ['Cédula'],
    documentosFaltantes: [],
    requisitosAplicables: 18,
  };

  it('el TITULAR es el radicado de entrada — el único número que existe al crear', () => {
    /* Este correo sale al CREAR el expediente, y desde el ADR-0041 en ese
       momento el expediente no tiene número propio. Protagonizarlo producía
       «Expediente undefined»; antes del ADR, un DEMO- que no servía para
       nada. */
    expect(buildAcuseReciboExpedienteSubject(ENTRADA)).toContain(ENTRADA);
    expect(buildAcuseReciboExpedienteSubject(ENTRADA)).toMatch(/Radicado/);
    const html = buildAcuseReciboExpedienteHtml(base);
    expect(html).toContain(ENTRADA);
    expect(html).toMatch(/Radicado de entrada:/);
  });

  it('sin expediente todavía, NO inventa una fila vacía', () => {
    expect(buildAcuseReciboExpedienteHtml(base)).not.toMatch(/Expediente \(Planeaci[oó]n\):/);
  });

  it('cuando el expediente ya tiene número, aparece como DATO, no como titular', () => {
    const html = buildAcuseReciboExpedienteHtml({ ...base, numeroExpediente: EXPEDIENTE });
    expect(html).toMatch(/Expediente \(Planeaci[oó]n\):/);
    expect(html).toContain(EXPEDIENTE);
    // El titular no cambia: el asunto sigue nombrando el radicado.
    expect(buildAcuseReciboExpedienteSubject(ENTRADA)).not.toContain(EXPEDIENTE);
  });
});

/* ══════════════════════════════════════════════════════════════
   EL NOMBRE DE LA FIGURA, SEGÚN DÓNDE VAYA — custodio del 3-sep-2026.

   Lo vio el propietario en el papel del ensayo: la carátula decía «Trámite:
   licencia de urbanización», con minúscula inicial. El mismo texto se usa en
   DOS posiciones gramaticales distintas y solo una de ellas la quiere:

     · DENTRO DE FRASE — «su solicitud de licencia de urbanización y…» →
       minúscula, y así debe seguir;
     · TRAS UNA ETIQUETA — «Trámite: …» → mayúscula inicial.

   `describirTramiteDesdeSubtipos` devuelve minúscula a propósito (su uso
   principal es el primero), así que la mayúscula la pone quien la necesita.

   Y SOLO LA PRIMERA LETRA: mayusculizar cada palabra produce «Licencia De
   Urbanización» — el defecto hermano que este mismo día se corrigió en la
   cabecera de la pantalla.

   ALCANCE (ADR-0033 §4.6-bis). MIRA los tres papeles donde el nombre va tras
   etiqueta, y que las frases NO se toquen. NO mira la pantalla (su custodio
   está en `numeros-del-expediente`).
══════════════════════════════════════════════════════════════ */
describe('el nombre de la figura empieza en mayúscula cuando va tras una etiqueta', () => {
  const TRAMITE = 'licencia de urbanización';

  it('la función mayusculiza SOLO la primera letra, nunca cada palabra', () => {
    expect(enMayusculaInicial(TRAMITE)).toBe('Licencia de urbanización');
    expect(
      enMayusculaInicial(TRAMITE),
      'está mayusculizando palabras interiores — en español el «de» no lleva mayúscula',
    ).not.toMatch(/\bDe\b/);
  });

  it('un texto vacío no explota ni inventa nada', () => {
    expect(enMayusculaInicial('')).toBe('');
  });

  it('la carátula del paquete lo imprime con mayúscula', () => {
    const c = contenidoConstanciaPaquete({
      numeroRadicado: ENTRADA,
      solicitanteNombre: 'Andrés Pérez',
      solicitanteDocumento: 'CC 123446432',
      descripcionTramite: TRAMITE,
      desdeCuandoCorreElPlazo: '2026-09-01T13:00:00.000Z',
      requisitosVerificados: 18,
      funcionarioNombre: 'Funcionaria de Planeación',
      expedidaEnLegible: '1 de septiembre de 2026, 12:00 p. m.',
    }, [], []);
    const fila = c.campos.find(([e]) => e.startsWith('Trámite'));
    expect(fila?.[1]).toBe('Licencia de urbanización');
  });

  it('la constancia lo imprime con mayúscula en el campo, y en minúscula DENTRO de la frase', () => {
    const html = buildConstanciaRadicacionLicenciaHtml({
      numeroRadicado: ENTRADA,
      solicitanteNombre: 'Andrés Pérez',
      solicitanteDocumento: '123446432',
      tipoDocumento: 'CC',
      descripcionTramite: TRAMITE,
      desdeCuandoCorreElPlazo: '2026-09-01T13:00:00.000Z',
      venceEl: '2026-11-05T13:00:00.000Z',
      requisitosVerificados: 18,
      funcionarioNombre: 'Funcionaria de Planeación',
      expedidaEn: '2026-09-01T17:00:00.000Z',
    });
    expect(html).toContain('<td>Trámite</td><td>Licencia de urbanización</td>');
    /* La frase NO se toca: ahí la minúscula es lo correcto. */
    expect(html, 'la frase quedó con mayúscula en mitad de una oración').toContain(`<strong>${TRAMITE}</strong> presentada por`);
  });

  it('el acuse por correo, igual: mayúscula en el campo, minúscula en la frase', () => {
    const html = buildAcuseReciboExpedienteHtml({
      numeroRadicado: ENTRADA,
      solicitanteNombre: 'Andrés Pérez',
      solicitanteDocumento: '123446432',
      tipoDocumento: 'CC',
      descripcionTramite: TRAMITE,
      fechaRecepcion: '2026-09-01T13:00:00.000Z',
      documentosEntregados: ['Cédula'],
      documentosFaltantes: [],
      requisitosAplicables: 18,
    });
    expect(html).toContain('Licencia de urbanización');
    expect(html, 'la frase quedó con mayúscula en mitad de una oración').toContain(`${TRAMITE} bajo el radicado`);
  });
});
