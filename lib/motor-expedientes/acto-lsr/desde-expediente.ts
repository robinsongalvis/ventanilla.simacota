/**
 * lib/motor-expedientes/acto-lsr/desde-expediente.ts
 *
 * EL PUENTE ENTRE EL EXPEDIENTE Y EL ACTO — y el informe de lo que falta.
 *
 * ── LO QUE ESTE ARCHIVO DESTAPA ───────────────────────────────────────────
 *
 * El expediente de hoy puede dar SEIS de los datos que el F-PGJ-002 necesita.
 * El resto —nombre del predio, escritura, profesional responsable, los lotes
 * resultantes con su destino y su accesibilidad, la referencia de pago, los
 * titulares en plural— no existe en ningún campo del sistema.
 *
 * Eso no es un defecto de este módulo: es el trabajo de intake que el frente de
 * la resolución exige, y aparece aquí, enumerado, en vez de descubrirse el día
 * que alguien pulse «generar».
 *
 * Nótese un detalle que decide diseño: el expediente guarda UN solicitante
 * (`solicitanteNombre` / `solicitanteDocumento`) y el acto real tiene TRES
 * titulares, cada uno con su bloque de notificación y su firma. No es un campo
 * que se alargue: es un modelo que cambia.
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto MIRA: qué puede dar el expediente, qué no, y si el trámite está en
 * condiciones de recibir un acto. NO escribe nada, NO emite números y NO
 * completa ningún dato ausente.
 */
import { datosVacios, type DatosActoLsr } from './datos-acto-lsr';

/** Lo mínimo que hace falta del expediente. Estructural: no importa el documento entero. */
export interface ExpedienteParaActo {
  id: string;
  estadoJuridico: string;
  subtipos?: string[];
  esPrueba?: boolean;
  numeroExpediente?: { numero: string; serieId: string } | null;
  numeroRadicadoEntrada?: string | null;
  radicadoId?: string | null;
  solicitanteNombre?: string;
  solicitanteDocumento?: string;
  predio?: { direccion?: string; barrioVereda?: string; matriculaInmobiliaria?: string; areaTexto?: string };
  completitud?: { faltantes?: unknown[] };
  fechaRadicacionDebidaForma?: string | null;
}

export interface ImpedimentoFlujo {
  codigo: string;
  mensaje: string;
}

/**
 * LAS VALIDACIONES DEL FLUJO, ANTES DE GENERAR NADA.
 *
 * No comprueban que el documento esté completo —de eso se ocupa el generador—
 * sino que el TRÁMITE esté en condiciones de recibir un acto. Son cosas
 * distintas: un expediente puede tener todos los datos del predio y aun así no
 * poder resolverse porque el ciudadano tiene un acta sin responder.
 *
 * Cada una responde a un daño concreto, no a una idea de orden.
 */
export function impedimentosParaGenerar(exp: ExpedienteParaActo, hoy: Date = new Date()): ImpedimentoFlujo[] {
  const impedimentos: ImpedimentoFlujo[] = [];
  void hoy;

  /* EL FORMATO ES DE SUBDIVISIÓN RURAL. Emitir un F-PGJ-002 sobre una licencia
     de construcción produciría un acto que cita la Ley 160 y la UAF para un
     trámite que no las tiene. */
  const subtipos = exp.subtipos ?? [];
  if (subtipos.length > 0 && !subtipos.some((s) => s.toUpperCase().includes('SUBDIVISION'))) {
    impedimentos.push({
      codigo: 'NO_ES_SUBDIVISION',
      mensaje: 'Este formato (F-PGJ-002) es de licencia de subdivisión rural; el expediente es de otra figura.',
    });
  }

  /* EL ACTO SE DICTA SOBRE UN TRÁMITE VIVO Y EN SU MOMENTO. Desde
     EN_VIABILIDAD el mapa de estados permite conceder o negar; antes, no. */
  if (exp.estadoJuridico !== 'EN_VIABILIDAD') {
    impedimentos.push({
      codigo: 'ESTADO_NO_PERMITE_RESOLVER',
      mensaje: `El expediente está en «${exp.estadoJuridico}»: la resolución se dicta desde «EN_VIABILIDAD».`,
    });
  }

  /* SIN ANCLA NO HAY TRÁMITE QUE RESOLVER: la radicación en debida forma es el
     hecho que abre el plazo, y el acto resuelve una solicitud radicada. */
  if (!exp.fechaRadicacionDebidaForma) {
    impedimentos.push({
      codigo: 'SIN_RADICACION_EN_DEBIDA_FORMA',
      mensaje: 'No consta la radicación en legal y debida forma: no hay solicitud en firme que resolver.',
    });
  }

  /* DOCUMENTACIÓN INCOMPLETA. Conceder con requisitos faltantes es conceder
     sobre lo que no se evaluó. */
  const faltantes = exp.completitud?.faltantes;
  if (faltantes === undefined) {
    impedimentos.push({
      codigo: 'COMPLETITUD_SIN_EVALUAR',
      mensaje: 'La documentación nunca se evaluó en servidor. «Sin evaluar» no es «completa».',
    });
  } else if (faltantes.length > 0) {
    impedimentos.push({
      codigo: 'DOCUMENTACION_INCOMPLETA',
      mensaje: `Faltan ${faltantes.length} requisito(s) por aportar.`,
    });
  }

  /* EL NÚMERO DEL EXPEDIENTE TIENE QUE SER LEGAL. Un acto que cita un número
     de demostración es un acto que cita algo que no existe. */
  if (exp.esPrueba === true) {
    impedimentos.push({
      codigo: 'EXPEDIENTE_DE_PRUEBA',
      mensaje: 'El expediente está marcado como de prueba: no puede producir un acto administrativo.',
    });
  }
  const serie = exp.numeroExpediente?.serieId;
  if (!exp.numeroExpediente?.numero || serie === 'demo' || serie === 'e2e-stage') {
    impedimentos.push({
      codigo: 'SIN_NUMERO_LEGAL',
      mensaje: 'El expediente no tiene número legal emitido; el acto no puede identificarlo.',
    });
  }

  /* EL NÚMERO DE ENTRADA, que es el que el ciudadano tiene en la mano. */
  if (!exp.numeroRadicadoEntrada && !exp.radicadoId) {
    impedimentos.push({
      codigo: 'SIN_RADICADO_DE_ENTRADA',
      mensaje: 'No consta el radicado de ventanilla: el acto no puede referirse a la solicitud que resuelve.',
    });
  }

  return impedimentos;
}

export interface CamposQueElExpedienteNoTiene {
  campo: string;
  dondeDeberiaCapturarse: string;
}

/**
 * Lo que hoy NO existe en ningún campo del sistema. Es la lista de trabajo del
 * intake, y por eso viaja como dato y no como comentario.
 */
export const CAMPOS_SIN_ORIGEN: readonly CamposQueElExpedienteNoTiene[] = [
  { campo: 'Nombre del predio', dondeDeberiaCapturarse: 'Datos del predio (junto a matrícula y vereda)' },
  { campo: 'Cédula catastral', dondeDeberiaCapturarse: 'Datos del predio' },
  { campo: 'Estrato', dondeDeberiaCapturarse: 'Datos del predio' },
  { campo: 'Titulares adicionales', dondeDeberiaCapturarse: 'Intake — hoy el expediente guarda UN solicitante y el acto admite varios' },
  { campo: 'Zona de UAF del predio y su fuente', dondeDeberiaCapturarse: 'Hechos del caso — determinación técnica por la altura del predio, no por la vereda' },
  { campo: 'Escritura pública (número, fecha, notaría, círculo)', dondeDeberiaCapturarse: 'Hechos del caso' },
  { campo: 'Profesional responsable (nombre, clase, matrícula)', dondeDeberiaCapturarse: 'Hechos del caso' },
  { campo: 'Lotes resultantes (número, propietario, área)', dondeDeberiaCapturarse: 'Pantalla propia de la subdivisión' },
  { campo: 'Destino productivo por lote', dondeDeberiaCapturarse: 'Pantalla propia de la subdivisión — redacción del técnico' },
  { campo: 'Accesibilidad por lote', dondeDeberiaCapturarse: 'Pantalla propia de la subdivisión — redacción del técnico' },
  { campo: 'Referencia de pago de expensas', dondeDeberiaCapturarse: 'Hechos del caso — viene de Tesorería' },
  { campo: 'Fecha de publicación / edicto a vecinos', dondeDeberiaCapturarse: 'Actuación propia' },
  { campo: 'Firmantes (secretario y notificador)', dondeDeberiaCapturarse: 'Configuración de la dependencia, no del expediente' },
];

/**
 * Vuelca en el contrato del acto lo que el expediente SÍ puede dar hoy. Lo que
 * no tiene queda en `null` — nunca relleno con algo parecido.
 */
export function datosDesdeExpediente(exp: ExpedienteParaActo): DatosActoLsr {
  const datos = datosVacios();
  datos.vereda = exp.predio?.barrioVereda ?? null;
  datos.direccion = exp.predio?.direccion ?? null;
  datos.matriculaInmobiliaria = exp.predio?.matriculaInmobiliaria ?? null;
  datos.areaTotalTexto = exp.predio?.areaTexto ?? null;
  datos.fechas.firmeza = null;
  if (exp.solicitanteNombre && exp.solicitanteDocumento) {
    datos.titulares = [{ nombre: exp.solicitanteNombre, documento: exp.solicitanteDocumento }];
  }
  return datos;
}
