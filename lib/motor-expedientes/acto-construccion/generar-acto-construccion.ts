/**
 * lib/motor-expedientes/acto-construccion/generar-acto-construccion.ts
 *
 * EL GENERADOR DE LA RESOLUCIÓN DE CONSTRUCCIÓN — arma el modelo hasta el borde
 * de lo que falta, o dice por qué no puede.
 *
 * ── LA REGLA QUE GOBIERNA TODO ESTE ARCHIVO ───────────────────────────────
 *
 * **Mientras Planeación no entregue el formato, este generador NUNCA da un acto
 * por expedible.** Puede armar el esqueleto (`estructura-acto-construccion.ts`)
 * y volcar en él los datos que el expediente sí tiene, para que se vea el acto
 * «hasta el borde»; pero cada tramo de prosa que falta queda como HUECO que
 * nombra qué falta y quién lo decide, y el resultado sale con
 * `puedeExpedirse: false`.
 *
 * Es una postura más estricta que la de subdivisión, y a propósito: allí
 * teníamos el acto real y solo faltaban cuatro decisiones; aquí falta el
 * documento entero. Producir algo que parezca una resolución de construcción
 * sería exactamente el vicio que este módulo existe para no cometer.
 *
 * El número NO se pide a ningún contador: `ParametrosActoConstruccion` lo
 * recibe ya emitido. La serie LC está decidida pero sin abrir en producción, y
 * abrirla es del propietario.
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto ARMA el modelo del documento y enumera lo que falta. NO redacta la
 * resolución (no hay formato), NO decide ningún pendiente, NO emite números, NO
 * escribe en Firestore y NO renderiza a PDF ni a Word.
 */

import {
  CAMPOS_OBLIGATORIOS_CONSTRUCCION,
  type DatosActoConstruccion,
} from './datos-acto-construccion';
import {
  ESQUELETO_ACTO_CONSTRUCCION,
  type TramoActo,
} from './estructura-acto-construccion';
import { type ParametrosActoConstruccion } from './decisiones-pendientes-construccion';
import {
  TARIFA_EXPENSAS_CONSTRUCCION,
  vigenciaDeLaConstruccion,
  type ResultadoVigenciaConstruccion,
} from './reglas-acto-construccion';
import { estadoDeModalidad } from './requisitos-por-modalidad';
import { describirModalidades } from '../modalidad-construccion';

export type BloqueConstruccion =
  | { clase: 'SECCION'; clave: string; titulo: string }
  /** Un dato del expediente que SÍ pudimos colocar, con su etiqueta. */
  | { clase: 'DATO'; etiqueta: string; valor: string }
  /** Un hueco EXPLÍCITO: prosa del formato, o una decisión pendiente. Nunca se rellena. */
  | { clase: 'HUECO'; queFalta: string; quienDecide: string };

export interface HallazgoConstruccion {
  nivel: 'BLOQUEANTE' | 'AVISO';
  queFalta: string;
  porQue: string;
}

export interface ActoConstruccionGenerado {
  esqueleto: BloqueConstruccion[];
  hallazgos: HallazgoConstruccion[];
  /** `false` mientras falte el formato o quede un solo hallazgo bloqueante. */
  puedeExpedirse: boolean;
  calculado: {
    modalidades: string[];
    /** Modalidades cuyos requisitos NO tenemos verificados (bloquean una resolución correcta). */
    modalidadesSinRequisitos: string[];
    vigencia: ResultadoVigenciaConstruccion;
  };
}

function valorODato(datos: DatosActoConstruccion, campo: string): string | null {
  switch (campo) {
    case 'modalidades': return describirModalidades(datos.modalidades);
    case 'nombrePredio': return datos.nombrePredio;
    case 'matriculaInmobiliaria': return datos.matriculaInmobiliaria;
    case 'titulares': return datos.titulares.length ? datos.titulares.map((t) => `${t.nombre} (${t.documento})`).join('; ') : null;
    case 'profesional': return datos.profesional ? `${datos.profesional.nombre} — ${datos.profesional.matricula}` : null;
    case 'obra.areaIntervenidaTexto': return datos.obra.areaIntervenidaTexto;
    case 'obra.numeroPisos': return datos.obra.numeroPisos === null ? null : String(datos.obra.numeroPisos);
    case 'obra.usoDestino': return datos.obra.usoDestino;
    case 'referenciaPagoExpensas': return datos.referenciaPagoExpensas;
    case 'firmantes': return datos.firmantes ? `${datos.firmantes.secretario.nombre} — ${datos.firmantes.secretario.cargo}` : null;
    default: return null;
  }
}

export function generarActoConstruccion(
  datos: DatosActoConstruccion,
  parametros: ParametrosActoConstruccion,
): ActoConstruccionGenerado {
  const hallazgos: HallazgoConstruccion[] = [];
  const esqueleto: BloqueConstruccion[] = [];

  /* ── 1. El formato: el bloqueante de fondo ────────────────────────────── */
  if (!parametros.formatoEntregado) {
    hallazgos.push({
      nivel: 'BLOQUEANTE',
      queFalta: 'El formato oficial de la resolución de construcción',
      porQue: 'Planeación no lo ha entregado. Sin él solo se arma el esqueleto; no hay resolución que expedir.',
    });
  }

  /* ── 2. Lo que falta del EXPEDIENTE ───────────────────────────────────── */
  for (const obligatorio of CAMPOS_OBLIGATORIOS_CONSTRUCCION) {
    if (valorODato(datos, obligatorio.campo) === null) {
      hallazgos.push({ nivel: 'BLOQUEANTE', queFalta: obligatorio.comoSeLlama, porQue: obligatorio.porQue });
    }
  }

  /* ── 3. Lo que falta de PLANEACIÓN o JURÍDICA, con la severidad justa ──
     Se marca lo que bloquea ESTE acto (recursos, tarifa de expensas), no toda
     la lista de pendientes del dominio (esa la da `pendientesQueFaltan`, para
     el informe). Un nombre de modalidad sin cotejar es un AVISO: se puede
     expedir con él, pero el funcionario debe verlo. */
  if (!parametros.textoRecursos) {
    hallazgos.push({
      nivel: 'BLOQUEANTE',
      queFalta: 'El texto de los recursos que proceden',
      porQue: 'Lo confirma Jurídica (precedente fuerte de solo reposición). Enunciarlos mal vicia la notificación.',
    });
  }
  if (TARIFA_EXPENSAS_CONSTRUCCION === null) {
    hallazgos.push({
      nivel: 'BLOQUEANTE',
      queFalta: 'La tarifa de expensas de construcción',
      porQue: 'No está en el repositorio (a diferencia de la de subdivisión). Sin ella no se puede liquidar el acto. La entrega Planeación.',
    });
  }
  const nombresSinCotejar = datos.modalidades.filter((c) => estadoDeModalidad(c)?.nombreVerificado !== true);
  if (nombresSinCotejar.length > 0) {
    hallazgos.push({
      nivel: 'AVISO',
      queFalta: `Cotejo del nombre de: ${nombresSinCotejar.join(', ')}`,
      porQue: 'El nombre no se ha verificado contra el texto oficial del art. 2.2.6.1.1.7 (solo «demolición» está confirmada).',
    });
  }

  /* ── 4. Las modalidades sin requisitos: aviso, no bloqueante del acto ──── */
  const modalidadesSinRequisitos = datos.modalidades.filter(
    (c) => estadoDeModalidad(c)?.requisitos !== 'VERIFICADO',
  );
  for (const codigo of modalidadesSinRequisitos) {
    const est = estadoDeModalidad(codigo);
    hallazgos.push({
      nivel: 'BLOQUEANTE',
      queFalta: `Requisitos de la modalidad «${est?.nombre ?? codigo}»`,
      porQue: 'No hay lista de requisitos verificada para esta modalidad; solo obra nueva la tiene. No se evaluó contra nada.',
    });
  }

  /* ── 5. El esqueleto, con los datos volcados donde caben ──────────────── */
  const numero = parametros.numeroResolucion;
  for (const tramo of [...ESQUELETO_ACTO_CONSTRUCCION].sort((a, b) => a.orden - b.orden)) {
    esqueleto.push({ clase: 'SECCION', clave: tramo.clave, titulo: tramo.titulo });

    if (tramo.clave === 'NUMERO_Y_TITULO') {
      esqueleto.push(numero
        ? { clase: 'DATO', etiqueta: 'Número', valor: numero }
        : { clase: 'HUECO', queFalta: 'El número de la resolución', quienDecide: 'Emisión bajo la serie LC (sin abrir en producción)' });
    }

    if (tramo.alojaDatosDinamicos) volcarDatosDelTramo(tramo, datos, esqueleto);

    if (tramo.contenido.estado === 'PENDIENTE_FORMATO') {
      esqueleto.push({
        clase: 'HUECO',
        queFalta: `Texto de «${tramo.titulo}»`,
        quienDecide: tramo.contenido.decide.replace(/_O_/g, ' o ') + ' — ' + tramo.contenido.nota,
      });
    }
  }

  const vigencia = vigenciaDeLaConstruccion(datos.fechas.firmeza, datos.modalidades);

  return {
    esqueleto,
    hallazgos,
    puedeExpedirse: parametros.formatoEntregado && hallazgos.every((h) => h.nivel !== 'BLOQUEANTE'),
    calculado: { modalidades: [...datos.modalidades], modalidadesSinRequisitos, vigencia },
  };
}

/** Vuelca en un tramo los datos del expediente que le corresponden — como DATO o como HUECO si faltan. */
function volcarDatosDelTramo(tramo: TramoActo, datos: DatosActoConstruccion, salida: BloqueConstruccion[]): void {
  const camposPorTramo: Record<string, { etiqueta: string; campo: string }[]> = {
    CONSIDERANDOS_CUERPO: [
      { etiqueta: 'Predio', campo: 'nombrePredio' },
      { etiqueta: 'Matrícula', campo: 'matriculaInmobiliaria' },
      { etiqueta: 'Modalidad(es)', campo: 'modalidades' },
    ],
    ARTICULOS_RESOLUTIVOS: [
      { etiqueta: 'Titulares', campo: 'titulares' },
      { etiqueta: 'Área a construir', campo: 'obra.areaIntervenidaTexto' },
      { etiqueta: 'Número de pisos', campo: 'obra.numeroPisos' },
      { etiqueta: 'Uso / destino', campo: 'obra.usoDestino' },
      { etiqueta: 'Profesional responsable', campo: 'profesional' },
    ],
    ARTICULO_EXPENSAS: [{ etiqueta: 'Referencia de pago', campo: 'referenciaPagoExpensas' }],
    FIRMA: [{ etiqueta: 'Firma', campo: 'firmantes' }],
  };
  for (const { etiqueta, campo } of camposPorTramo[tramo.clave] ?? []) {
    const valor = valorODato(datos, campo);
    salida.push(valor !== null
      ? { clase: 'DATO', etiqueta, valor }
      : { clase: 'HUECO', queFalta: etiqueta, quienDecide: 'Intake — dato del expediente que aún no existe' });
  }
}

/** Vista en texto plano, para revisar el «hasta el borde» sin montar nada. */
export function renderTextoActoConstruccion(acto: ActoConstruccionGenerado): string {
  const lineas: string[] = [];
  for (const b of acto.esqueleto) {
    if (b.clase === 'SECCION') lineas.push('', `── ${b.titulo} ──`);
    else if (b.clase === 'DATO') lineas.push(`   ${b.etiqueta}: ${b.valor}`);
    else lineas.push(`   ⟨ FALTA: ${b.queFalta} — ${b.quienDecide} ⟩`);
  }
  lineas.push('', acto.puedeExpedirse ? '✔ EXPEDIBLE' : '✘ NO EXPEDIBLE — faltan piezas (ver hallazgos).');
  return lineas.join('\n').trimStart();
}
