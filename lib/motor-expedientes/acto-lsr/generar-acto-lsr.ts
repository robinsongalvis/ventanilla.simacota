/**
 * lib/motor-expedientes/acto-lsr/generar-acto-lsr.ts
 *
 * EL GENERADOR DEL F-PGJ-002 — compone el acto, o dice por qué no puede.
 *
 * ── LA REGLA QUE GOBIERNA TODO ESTE ARCHIVO ───────────────────────────────
 *
 * **Nunca produce un documento que parezca terminado cuando no lo está.**
 *
 * Donde falta un dato del expediente o una decisión pendiente, no va un valor
 * plausible: va un BLOQUE DE HUECO que nombra lo que falta y quién lo decide, y
 * el resultado sale con `puedeExpedirse: false`. Un acto administrativo con un
 * número inventado o con el texto de recursos equivocado no es un borrador
 * imperfecto — es un vicio, y los vicios de notificación se pagan con la
 * nulidad del acto.
 *
 * Por la misma razón el número NO se pide a ningún contador: `ParametrosDelActo`
 * lo recibe ya emitido. Mientras la serie y el formato sigan sin decidir,
 * consumir un consecutivo real sería gastar un número bajo una regla que nadie
 * aprobó.
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto ARMA el modelo del documento y enumera lo que falta. NO decide ninguna
 * de las cuatro pendientes, NO emite números, NO escribe en Firestore y NO
 * renderiza a PDF ni a Word — el modelo es la entrada de ese renderizador, que
 * es otro trabajo.
 */
import {
  ADVERTENCIA_ALCANCE_LSR, ARTICULOS_FIJOS, CITAS_UAF, ENCABEZADO_F_PGJ_002,
  ORDINALES, PIE_F_PGJ_002, PREAMBULO_FACULTADES,
} from './estructura-f-pgj-002';
import { CAMPOS_OBLIGATORIOS_ACTO, type DatosActoLsr } from './datos-acto-lsr';
import {
  MESES_VIGENCIA_LSR, SMDLV_POR_LOTE_LSR, smdlvDeLaLicencia, uafDeterminada,
  vencimientoDeLaLicencia, type RangoUaf,
} from './reglas-acto-lsr';
import { decisionesQueFaltan, type ParametrosDelActo } from './decisiones-pendientes';

export type BloqueActo =
  | { clase: 'TITULO'; texto: string }
  | { clase: 'PARRAFO'; texto: string }
  | { clase: 'ARTICULO'; ordinal: number; nombre: string; texto: string }
  | { clase: 'TABLA_AREAS'; filas: { lote: string; propietario: string; area: string }[]; total: string }
  | { clase: 'FIRMA'; nombre: string; cargo: string }
  /** Un hueco EXPLÍCITO. Nunca se rellena con algo verosímil. */
  | { clase: 'HUECO'; queFalta: string; quienDecide: string };

export interface HallazgoActo {
  /** `BLOQUEANTE` impide expedir; `AVISO` no, pero el funcionario debe verlo. */
  nivel: 'BLOQUEANTE' | 'AVISO';
  queFalta: string;
  porQue: string;
}

export interface ActoLsrGenerado {
  encabezado: typeof ENCABEZADO_F_PGJ_002;
  pie: typeof PIE_F_PGJ_002;
  bloques: BloqueActo[];
  hallazgos: HallazgoActo[];
  /** `false` mientras quede un solo hallazgo bloqueante. */
  puedeExpedirse: boolean;
  /** Lo que el generador calculó por regla, para poder auditarlo sin leer el texto. */
  calculado: {
    uaf: RangoUaf | null;
    smdlv: number;
    cantidadLotes: number;
    vencimientoVigencia: string | null;
  };
}

const HUECO = (queFalta: string, quienDecide: string): BloqueActo => ({ clase: 'HUECO', queFalta, quienDecide });

export function generarActoLsr(datos: DatosActoLsr, parametros: ParametrosDelActo): ActoLsrGenerado {
  const hallazgos: HallazgoActo[] = [];
  const bloques: BloqueActo[] = [];

  /* ── 1. Lo que falta del EXPEDIENTE ───────────────────────────────────── */
  for (const obligatorio of CAMPOS_OBLIGATORIOS_ACTO) {
    const valor = datos[obligatorio.campo as keyof DatosActoLsr];
    const vacio = Array.isArray(valor) ? valor.length === 0 : valor === null || valor === undefined || valor === '';
    if (vacio) {
      hallazgos.push({ nivel: 'BLOQUEANTE', queFalta: obligatorio.comoSeLlama, porQue: obligatorio.porQue });
    }
  }

  /* ── 2. Lo que falta de PLANEACIÓN o JURÍDICA ─────────────────────────── */
  for (const decision of decisionesQueFaltan(parametros)) {
    hallazgos.push({
      nivel: 'BLOQUEANTE',
      queFalta: decision.pregunta,
      porQue: `${decision.bloquea} Decide: ${decision.decide.replace('_O_', ' o ')}.`,
    });
  }

  /* ── 3. La UAF: regla de negocio, no dato ─────────────────────────────── */
  const uaf = uafDeterminada(datos.determinacionUaf);
  if (datos.determinacionUaf && !uaf) {
    hallazgos.push({
      nivel: 'BLOQUEANTE',
      queFalta: 'La fuente de la determinación de la Unidad Agrícola Familiar',
      porQue:
        'Se declaró la zona pero no de dónde salió la altura del predio. De esta zona depende que la subdivisión sea válida '
        + 'o nula (Ley 160 art. 44), y un acto que la afirma sin respaldo no puede defender su propia motivación.',
    });
  }

  const cantidadLotes = datos.lotes.length;
  const smdlv = smdlvDeLaLicencia(cantidadLotes);

  /* ── 4. El cuerpo ─────────────────────────────────────────────────────── */
  const numero = parametros.numeroResolucion;
  bloques.push(numero
    ? { clase: 'TITULO', texto: `RESOLUCIÓN LSR No. ${numero}` }
    : HUECO('El número de la resolución', 'Planeación — serie y formato'));

  bloques.push({
    clase: 'PARRAFO',
    texto:
      `POR EL CUAL SE APRUEBA EL PROYECTO DE SUBDIVISIÓN RURAL PARA EL PREDIO DENOMINADO ${datos.nombrePredio ?? '[ predio ]'} `
      + `UBICADO EN LA VEREDA ${datos.vereda ?? '[ vereda ]'} JURISDICCIÓN DEL MUNICIPIO DE SIMACOTA SANTANDER, CONFORME A LAS `
      + 'NORMAS DE DESARROLLO URBANÍSTICO, Y SE CONCEDE LA LICENCIA DE SUBDIVISIÓN POR UN PLAZO DETERMINADO.',
  });
  bloques.push({ clase: 'PARRAFO', texto: ADVERTENCIA_ALCANCE_LSR });
  bloques.push({ clase: 'PARRAFO', texto: PREAMBULO_FACULTADES });
  bloques.push({ clase: 'TITULO', texto: 'CONSIDERANDO' });
  bloques.push({ clase: 'PARRAFO', texto: CITAS_UAF.articulo44 });
  bloques.push({ clase: 'PARRAFO', texto: CITAS_UAF.fuenteRangos });
  if (uaf) bloques.push({ clase: 'PARRAFO', texto: `${uaf.descripcion} Unidad agrícola familiar: de ${uaf.desdeHas} a ${uaf.hastaHas} hectáreas.` });
  else bloques.push(HUECO('La determinación de la zona de UAF del predio, con su fuente', 'Determinación técnica del expediente'));

  bloques.push({ clase: 'TITULO', texto: 'RESUELVE' });

  const articulos: BloqueActo[] = [];
  const art = (ordinal: number, texto: string) =>
    articulos.push({ clase: 'ARTICULO', ordinal, nombre: ORDINALES[ordinal] ?? String(ordinal), texto });

  art(1, `Aprobar el proyecto de subdivisión rural del predio ${datos.nombrePredio ?? '[ predio ]'}, identificado con matrícula `
    + `inmobiliaria número ${datos.matriculaInmobiliaria ?? '[ matrícula ]'}, propiedad de ${listarTitulares(datos)}`
    + (datos.escritura
      ? `, con escritura pública número ${datos.escritura.numero} de la ${datos.escritura.notaria} del círculo de ${datos.escritura.circulo}.`
      : ', con la escritura pública que reposa en el expediente.'));

  /* EL ARTÍCULO DE TÉRMINOS depende de una decisión pendiente: la vigencia son
     12 meses, pero desde la expedición o desde la firmeza es justo lo que nadie
     ha resuelto. Se escribe el plazo y se deja el ancla en hueco. */
  const ancla = parametros.origenVigencia === 'EXPEDICION'
    ? datos.fechas.expedicion
    : parametros.origenVigencia === 'FIRMEZA' ? datos.fechas.firmeza : null;
  const vencimiento = ancla ? vencimientoDeLaLicencia(ancla) : null;
  art(2, parametros.origenVigencia
    ? `Los términos de ejecución de la presente licencia son de doce (${MESES_VIGENCIA_LSR}) meses contados a partir de la fecha `
      + `de ${parametros.origenVigencia === 'EXPEDICION' ? 'expedición' : 'firmeza'} del acto.`
    : `Los términos de ejecución de la presente licencia son de doce (${MESES_VIGENCIA_LSR}) meses.`);
  if (!parametros.origenVigencia) articulos.push(HUECO('Desde cuándo corren los 12 meses', 'Planeación / Jurídica'));

  art(4, `Se establecen como normas propias del proyecto las siguientes. Ubicación: predio `
    + `${datos.nombrePredio ?? '[ predio ]'}, vereda ${datos.vereda ?? '[ vereda ]'}, jurisdicción del Municipio de Simacota, Santander.`);

  if (datos.lotes.length > 0) {
    articulos.push({
      clase: 'TABLA_AREAS',
      filas: datos.lotes.map((l) => ({ lote: `LOTE ${l.numero}`, propietario: l.propietario, area: l.areaTexto })),
      total: datos.areaTotalTexto ?? '[ área total ]',
    });
  }

  art(5, `Concédase licencia de subdivisión a nombre de ${listarTitulares(datos)}, del predio denominado `
    + `${datos.nombrePredio ?? '[ predio ]'} ubicado en la vereda ${datos.vereda ?? '[ vereda ]'}.`);

  art(6, datos.profesional
    ? `Para todos los efectos legales se tiene como responsable del proyecto al ${claseProfesional(datos.profesional.clase)} `
      + `${datos.profesional.nombre}, ${datos.profesional.matricula}.`
    : 'Para todos los efectos legales se tiene como responsable del proyecto al profesional que firma los planos.');

  /* EL ARTÍCULO DE RECURSOS NO SE ESCRIBE SOLO. Es la decisión de Jurídica: el
     acto real dice «reposición y apelación» y el sistema redacta «solo
     reposición» en sus otros actos. Enunciarlos mal vicia la notificación. */
  if (parametros.textoRecursos) art(9, parametros.textoRecursos);
  else articulos.push(HUECO('El texto de los recursos que proceden', 'Jurídica'));

  if (datos.lotes.some((l) => l.accesibilidad)) {
    art(12, 'Que los linderos que se ocasionen con posterioridad a la expedición de la presente licencia se registrarán mediante '
      + 'acto de subdivisión suscrito ante notario público, de conformidad con el Decreto 2218 del 18 de noviembre de 2015, '
      + 'artículo 4, numeral 1. La accesibilidad a los lotes resultantes se garantiza así: '
      + datos.lotes.map((l) => `LOTE ${l.numero}: ${l.accesibilidad}`).join(' '));
  }

  art(15, `Que según el Acuerdo Municipal No. 026 del 21 de diciembre de 2020, artículo 194, ítem 10, la tarifa de la licencia de `
    + `subdivisión para segregaciones rurales se fija por la cantidad de lotes a segregar a razón de cinco (${SMDLV_POR_LOTE_LSR}) `
    + `S.M.D.L.V.: ${cantidadLotes} lotes = ${smdlv} S.M.D.L.V. Referencia de pago `
    + `${datos.referenciaPagoExpensas ?? '[ referencia de la Tesorería ]'}.`);

  for (const fijo of ARTICULOS_FIJOS) articulos.push({ clase: 'ARTICULO', ordinal: fijo.ordinal, nombre: fijo.nombre, texto: fijo.texto });

  /* EN ORDEN DE ARTÍCULO, no en el orden en que se armaron: el acto se lee de
     primero a decimosexto, y los huecos se quedan donde les toca para que se
     vea QUÉ artículo falta, no solo que falta algo. */
  articulos.sort((a, b) => ordinalDe(a) - ordinalDe(b));
  bloques.push(...articulos);

  if (datos.firmantes) {
    bloques.push({ clase: 'FIRMA', nombre: datos.firmantes.secretario.nombre, cargo: datos.firmantes.secretario.cargo });
  } else {
    bloques.push(HUECO('Quién firma el acto', 'Planeación'));
  }

  return {
    encabezado: ENCABEZADO_F_PGJ_002,
    pie: PIE_F_PGJ_002,
    bloques,
    hallazgos,
    puedeExpedirse: hallazgos.every((h) => h.nivel !== 'BLOQUEANTE'),
    calculado: { uaf, smdlv, cantidadLotes, vencimientoVigencia: vencimiento },
  };
}

function ordinalDe(b: BloqueActo): number {
  if (b.clase === 'ARTICULO') return b.ordinal;
  if (b.clase === 'TABLA_AREAS') return 4.5;   // va dentro del artículo cuarto
  return 99;                                    // los huecos, al final de su tramo
}

function listarTitulares(d: DatosActoLsr): string {
  if (d.titulares.length === 0) return '[ titulares ]';
  return d.titulares.map((t) => `${t.nombre}, identificado(a) con ${t.documento}`).join('; ');
}

function claseProfesional(c: 'TOPOGRAFO' | 'ARQUITECTO' | 'INGENIERO'): string {
  return c === 'TOPOGRAFO' ? 'tecnólogo en topografía' : c === 'ARQUITECTO' ? 'arquitecto' : 'ingeniero';
}

/** Vista en texto plano, para revisar y para contrastar contra el acto real. */
export function renderTextoActo(acto: ActoLsrGenerado): string {
  const lineas: string[] = [];
  for (const b of acto.bloques) {
    if (b.clase === 'TITULO') lineas.push('', b.texto, '');
    else if (b.clase === 'PARRAFO') lineas.push(b.texto);
    else if (b.clase === 'ARTICULO') lineas.push(`ARTÍCULO ${b.nombre}: ${b.texto}`);
    else if (b.clase === 'TABLA_AREAS') {
      lineas.push('CUADRO DE ÁREAS');
      for (const f of b.filas) lineas.push(`  ${f.lote} · ${f.propietario} · ${f.area}`);
      lineas.push(`  ÁREA TOTAL · ${b.total}`);
    } else if (b.clase === 'FIRMA') lineas.push('', '____________________', b.nombre, b.cargo);
    else lineas.push(`⟨ FALTA: ${b.queFalta} — decide: ${b.quienDecide} ⟩`);
  }
  return lineas.join('\n');
}
