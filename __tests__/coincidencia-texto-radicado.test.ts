import { describe, expect, it } from 'vitest';
import {
  coincideTextoRadicado,
  normalizarTextoBusqueda,
  type RadicadoParaTexto,
} from '@/lib/busqueda/coincidencia-texto-radicado';

/* ══════════════════════════════════════════════════════════════
   EL PREDICADO ÚNICO DE BÚSQUEDA — custodio del paso 2 del ADR-0041
   (1-sep-2026).

   Nace de una pregunta del propietario: «¿qué pasa cuando alguien busca con el
   1-110 pero es 68745, y al revés?». Al ir a añadir el número del expediente
   apareció que la pregunta «¿este radicado coincide con este texto?» se
   respondía en DOS sitios —el mostrador y el Tablero—, cada uno con su propia
   lista de campos y su propia copia de la guarda de identidad reservada.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA:
     · que los DOS números encuentren el trámite;
     · que la guarda de identidad se sostenga con CADA marcador de reserva EN
       SOLITARIO — nombre, documento y correo no coinciden;
     · que los números SÍ coincidan aunque la identidad esté protegida (si no,
       un ciudadano con reserva no podría ser atendido en su propio mostrador);
     · que el término vacío no filtre, y que las tildes no importen.
   Esto NO mira: qué radicados se le muestran a quien busca (autorización por
   tenant, aguas arriba), ni el orden de los resultados, ni las superficies que
   consumen esta función (una línea cada una, visible en el diff).
══════════════════════════════════════════════════════════════ */

const RADICADO = '1-110-202609-00000041';
const EXPEDIENTE = '68745-0-26-0021';
const NOMBRE = 'María Gómez Pérez';
const DOCUMENTO = '1101321226';
const CORREO = 'maria@ejemplo.com';

function radicado(sobre: Partial<RadicadoParaTexto> = {}): RadicadoParaTexto {
  return {
    radicadoId: RADICADO,
    esAnonimo: false,
    identidadReservada: false,
    tipoPresentacion: 'IDENTIFICADA',
    solicitante: { nombreCompleto: NOMBRE, numeroDocumento: DOCUMENTO, email: CORREO },
    detalle: { asunto: 'Solicitud de licencia de construcción' },
    clasificacion: { oficinaDestino: 'SEC_PLANEACION', funcionarioResponsableNombre: 'Funcionaria Prueba' },
    termino: { tipoSolicitudNombre: 'Licencia de construcción' },
    vinculoExpediente: { numeroExpediente: EXPEDIENTE },
    ...sobre,
  } as RadicadoParaTexto;
}

/** Como lo llaman las superficies: normalizando el término primero. */
function busca(termino: string, sobre: Partial<RadicadoParaTexto> = {}, nombreDependencia?: string): boolean {
  return coincideTextoRadicado(radicado(sobre), normalizarTextoBusqueda(termino), { nombreDependencia });
}

describe('los dos números encuentran el trámite', () => {
  it('por el radicado de ENTRADA (1-110) — el que el ciudadano tiene', () => {
    expect(busca(RADICADO)).toBe(true);
  });

  it('por el número del EXPEDIENTE (68745) — el que le imprimimos en la constancia', () => {
    /* El hueco que el propietario cazó: sin esto, quien atiende el mostrador
       no encuentra al ciudadano que llega leyendo el número de SU licencia. */
    expect(busca(EXPEDIENTE)).toBe(true);
  });

  it('por un fragmento del número del expediente, como se teclea de verdad', () => {
    expect(busca('26-0021')).toBe(true);
  });

  it('un expediente NO vinculado no coincide por un número que no es suyo', () => {
    expect(busca(EXPEDIENTE, { vinculoExpediente: null })).toBe(false);
  });
});

describe('la guarda de identidad reservada — cada marcador EN SOLITARIO', () => {
  /* En solitario, con los otros tres apagados: combinados, basta que uno se
     reconozca para que todo salga bien y el hueco no se note. Es la lección
     del oficio que solo reconocía dos de los cuatro (issue #301). */
  const MARCADORES: [string, Partial<RadicadoParaTexto>][] = [
    ['esAnonimo = true', { esAnonimo: true, identidadReservada: false, tipoPresentacion: 'IDENTIFICADA' }],
    ['identidadReservada = true', { esAnonimo: false, identidadReservada: true, tipoPresentacion: 'IDENTIFICADA' }],
    ['tipoPresentacion = ANONIMA', { esAnonimo: false, identidadReservada: false, tipoPresentacion: 'ANONIMA' }],
    ['tipoPresentacion = RESERVADA', { esAnonimo: false, identidadReservada: false, tipoPresentacion: 'RESERVADA' }],
  ];

  it.each(MARCADORES)('con %s, NO coincide por nombre, documento ni correo', (marcador, sobre) => {
    for (const [que, termino] of [['nombre', NOMBRE], ['documento', DOCUMENTO], ['correo', CORREO]] as const) {
      expect(
        busca(termino, sobre),
        `Con «${marcador}» el radicado coincidió por ${que}. Quien teclea el ${que} de una persona `
        + 'con identidad protegida y ve aparecer su fila, acaba de inferir lo que la pantalla oculta '
        + '(ADR-0012 / R9).',
      ).toBe(false);
    }
  });

  it.each(MARCADORES)('con %s, SÍ coincide por sus DOS números', (marcador, sobre) => {
    /* La otra dirección, y no es un detalle: una persona con reserva llega al
       mostrador con su papel en la mano igual que cualquiera. Si sus números
       no la encontraran, la protección se habría vuelto un castigo. */
    expect(busca(RADICADO, sobre), `«${marcador}» dejó de encontrarse por su radicado`).toBe(true);
    expect(busca(EXPEDIENTE, sobre), `«${marcador}» dejó de encontrarse por su expediente`).toBe(true);
  });

  it.each(MARCADORES)('con %s, sigue coincidiendo por el asunto (no es dato del solicitante)', (_m, sobre) => {
    expect(busca('licencia de construcción', sobre)).toBe(true);
  });
});

describe('la unión de campos: nadie perdió lo que ya buscaba', () => {
  it('el asunto — lo tenían las dos superficies', () => {
    expect(busca('solicitud de licencia')).toBe(true);
  });

  it('el correo del solicitante — lo tenía el mostrador; el Tablero lo gana', () => {
    expect(busca(CORREO)).toBe(true);
  });

  it('el tipo de trámite — lo tenía el mostrador; el Tablero lo gana', () => {
    expect(busca('Licencia de construcción')).toBe(true);
  });

  it('el nombre HUMANO de la dependencia — lo tenía el Tablero; el mostrador lo gana', () => {
    expect(busca('Planeación', {}, 'Secretaría de Planeación')).toBe(true);
  });

  it('el código interno de la dependencia — lo tenía el mostrador', () => {
    expect(busca('SEC_PLANEACION')).toBe(true);
  });

  it('el funcionario responsable', () => {
    expect(busca('Funcionaria Prueba')).toBe(true);
  });
});

describe('normalización y término vacío', () => {
  it('las tildes no importan, en ninguna dirección', () => {
    expect(busca('maria gomez')).toBe(true);
    expect(busca('MARÍA GÓMEZ')).toBe(true);
  });

  it('término vacío coincide con todo — es «sin filtro», no «nada encaja»', () => {
    expect(busca('')).toBe(true);
    expect(busca('   ')).toBe(true);
  });

  it('un texto que no está en ningún campo no coincide', () => {
    expect(busca('texto-que-no-existe-en-ninguna-parte')).toBe(false);
  });
});
