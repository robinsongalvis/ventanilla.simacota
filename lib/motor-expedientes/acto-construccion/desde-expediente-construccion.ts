/**
 * lib/motor-expedientes/acto-construccion/desde-expediente-construccion.ts
 *
 * EL PUENTE ENTRE EL EXPEDIENTE Y LA RESOLUCIÓN DE CONSTRUCCIÓN — y el informe
 * de lo que falta capturar.
 *
 * ── LO QUE ESTE ARCHIVO DESTAPA ───────────────────────────────────────────
 *
 * El expediente de hoy puede dar POCOS de los datos que una resolución de
 * construcción necesita: el solicitante, el predio (dirección, barrio/vereda,
 * matrícula, área en texto), las modalidades y —si el expediente está cerrado—
 * la fecha de firmeza. Todo lo TÉCNICO de la obra —área a construir, número de
 * pisos, uso, valor, sistema estructural—, el profesional responsable, la
 * escritura y los titulares en plural NO existen en ningún campo del sistema.
 *
 * Esa distancia es el trabajo de intake que la resolución exige, y aparece
 * aquí, enumerada (`CAMPOS_SIN_ORIGEN_CONSTRUCCION`), en vez de descubrirse el
 * día que alguien pulse «generar».
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto MIRA: qué puede dar el expediente, qué no, y si el trámite está en
 * condiciones de recibir un acto. NO escribe nada, NO emite números y NO
 * completa ningún dato ausente.
 */
import { datosVaciosConstruccion, type DatosActoConstruccion } from './datos-acto-construccion';
import { exigeModalidadConstruccion } from '../modalidad-construccion';

/** Lo mínimo que hace falta del expediente para el puente. Estructural. */
export interface ExpedienteParaConstruccion {
  id: string;
  estadoJuridico: string;
  subtipos?: string[];
  modalidadesConstruccion?: string[];
  esPrueba?: boolean;
  numeroExpediente?: { numero: string; serieId: string } | null;
  numeroRadicadoEntrada?: string | null;
  radicadoId?: string | null;
  solicitanteNombre?: string;
  solicitanteDocumento?: string;
  predio?: { direccion?: string; barrioVereda?: string; matriculaInmobiliaria?: string; areaTexto?: string };
  completitud?: { faltantes?: unknown[] };
  fechaRadicacionDebidaForma?: string | null;
  actoFinal?: { fechaFirmeza?: string };
}

export interface ImpedimentoConstruccion {
  codigo: string;
  mensaje: string;
}

/**
 * LAS VALIDACIONES DEL FLUJO, ANTES DE GENERAR NADA. No comprueban que el
 * documento esté completo —de eso se ocupa el generador— sino que el TRÁMITE
 * esté en condiciones de recibir un acto.
 */
export function impedimentosParaGenerarConstruccion(exp: ExpedienteParaConstruccion): ImpedimentoConstruccion[] {
  const impedimentos: ImpedimentoConstruccion[] = [];
  const subtipos = exp.subtipos ?? [];

  /* LA FIGURA TIENE QUE SER CONSTRUCCIÓN. Emitir una resolución de construcción
     sobre otra figura produciría un acto que autoriza obras que nadie pidió. */
  if (!subtipos.includes('CONSTRUCCION')) {
    impedimentos.push({
      codigo: 'NO_ES_CONSTRUCCION',
      mensaje: 'Este generador es de licencia de construcción; el expediente no declara la figura CONSTRUCCION.',
    });
  }

  /* SIN MODALIDAD NO HAY LICENCIA DE CONSTRUCCIÓN QUE RESOLVER: de ella dependen
     los requisitos, la vigencia y la parte resolutiva. Un expediente creado
     antes del campo de modalidad no la trae —y eso NO es «obra nueva». */
  if (exigeModalidadConstruccion(subtipos) && (exp.modalidadesConstruccion ?? []).length === 0) {
    impedimentos.push({
      codigo: 'SIN_MODALIDAD',
      mensaje: 'No se capturó la modalidad de construcción; sin ella no se sabe qué autoriza el acto ni qué requisitos aplican.',
    });
  }

  /* EL ACTO SE DICTA SOBRE UN TRÁMITE VIVO Y EN SU MOMENTO. */
  if (exp.estadoJuridico !== 'EN_VIABILIDAD') {
    impedimentos.push({
      codigo: 'ESTADO_NO_PERMITE_RESOLVER',
      mensaje: `El expediente está en «${exp.estadoJuridico}»: la resolución se dicta desde «EN_VIABILIDAD».`,
    });
  }

  /* SIN ANCLA NO HAY TRÁMITE QUE RESOLVER. */
  if (!exp.fechaRadicacionDebidaForma) {
    impedimentos.push({
      codigo: 'SIN_RADICACION_EN_DEBIDA_FORMA',
      mensaje: 'No consta la radicación en legal y debida forma: no hay solicitud en firme que resolver.',
    });
  }

  /* DOCUMENTACIÓN INCOMPLETA. */
  const faltantes = exp.completitud?.faltantes;
  if (faltantes === undefined) {
    impedimentos.push({ codigo: 'COMPLETITUD_SIN_EVALUAR', mensaje: 'La documentación nunca se evaluó en servidor. «Sin evaluar» no es «completa».' });
  } else if (faltantes.length > 0) {
    impedimentos.push({ codigo: 'DOCUMENTACION_INCOMPLETA', mensaje: `Faltan ${faltantes.length} requisito(s) por aportar.` });
  }

  /* EL NÚMERO DEL EXPEDIENTE TIENE QUE SER LEGAL. */
  if (exp.esPrueba === true) {
    impedimentos.push({ codigo: 'EXPEDIENTE_DE_PRUEBA', mensaje: 'El expediente está marcado como de prueba: no puede producir un acto administrativo.' });
  }
  const serie = exp.numeroExpediente?.serieId;
  if (!exp.numeroExpediente?.numero || serie === 'demo' || serie === 'e2e-stage') {
    impedimentos.push({ codigo: 'SIN_NUMERO_LEGAL', mensaje: 'El expediente no tiene número legal emitido; el acto no puede identificarlo.' });
  }

  /* EL NÚMERO DE ENTRADA, que es el que el ciudadano tiene en la mano. */
  if (!exp.numeroRadicadoEntrada && !exp.radicadoId) {
    impedimentos.push({ codigo: 'SIN_RADICADO_DE_ENTRADA', mensaje: 'No consta el radicado de ventanilla: el acto no puede referirse a la solicitud que resuelve.' });
  }

  return impedimentos;
}

export interface CampoSinOrigen {
  campo: string;
  dondeDeberiaCapturarse: string;
  /** `NUEVO` = no existe ningún campo; `MODELO` = existe pero el modelo no alcanza (p. ej. un solo solicitante). */
  clase: 'NUEVO' | 'MODELO';
}

/**
 * LO QUE HOY NO EXISTE EN NINGÚN CAMPO DEL SISTEMA para poder generar la
 * resolución de construcción. Es la lista de trabajo del intake, y por eso
 * viaja como dato y no como comentario. Es la respuesta directa a «qué campos
 * del expediente todavía no existen».
 */
export const CAMPOS_SIN_ORIGEN_CONSTRUCCION: readonly CampoSinOrigen[] = [
  { campo: 'Área a construir / intervenir', dondeDeberiaCapturarse: 'Datos técnicos de la obra (pantalla nueva) — hoy no existe', clase: 'NUEVO' },
  { campo: 'Número de pisos', dondeDeberiaCapturarse: 'Datos técnicos de la obra — hoy no existe', clase: 'NUEVO' },
  { campo: 'Uso / destino de la edificación', dondeDeberiaCapturarse: 'Datos técnicos de la obra — hoy no existe', clase: 'NUEVO' },
  { campo: 'Valor de la obra', dondeDeberiaCapturarse: 'Datos técnicos de la obra — base de expensas; hoy no existe', clase: 'NUEVO' },
  { campo: 'Sistema estructural', dondeDeberiaCapturarse: 'Datos técnicos de la obra — hoy no existe', clase: 'NUEVO' },
  { campo: 'Profesional responsable (nombre, clase, matrícula)', dondeDeberiaCapturarse: 'Hechos del caso — hoy no existe', clase: 'NUEVO' },
  { campo: 'Escritura pública (número, fecha, notaría, círculo)', dondeDeberiaCapturarse: 'Hechos del caso — hoy no existe', clase: 'NUEVO' },
  { campo: 'Nombre del predio', dondeDeberiaCapturarse: 'Datos del predio (hoy `DatosPredio` no lo tiene)', clase: 'NUEVO' },
  { campo: 'Cédula catastral', dondeDeberiaCapturarse: 'Datos del predio — hoy no existe', clase: 'NUEVO' },
  { campo: 'Referencia de pago de expensas', dondeDeberiaCapturarse: 'Hechos del caso — viene de Tesorería; hoy no existe', clase: 'NUEVO' },
  { campo: 'Titulares adicionales', dondeDeberiaCapturarse: 'Intake — hoy el expediente guarda UN solicitante y el acto admite varios', clase: 'MODELO' },
  { campo: 'Firmantes (secretario y notificador)', dondeDeberiaCapturarse: 'Configuración de la dependencia, no del expediente', clase: 'MODELO' },
];

/**
 * Vuelca en el contrato del acto lo que el expediente SÍ puede dar hoy. Lo que
 * no tiene queda en `null`/vacío — nunca relleno con algo parecido.
 */
export function datosDesdeExpedienteConstruccion(exp: ExpedienteParaConstruccion): DatosActoConstruccion {
  const datos = datosVaciosConstruccion();
  datos.modalidades = exp.modalidadesConstruccion ?? [];
  datos.direccion = exp.predio?.direccion ?? null;
  datos.barrioVereda = exp.predio?.barrioVereda ?? null;
  datos.matriculaInmobiliaria = exp.predio?.matriculaInmobiliaria ?? null;
  datos.areaPredioTexto = exp.predio?.areaTexto ?? null;
  datos.fechas.firmeza = exp.actoFinal?.fechaFirmeza ?? null;
  if (exp.solicitanteNombre && exp.solicitanteDocumento) {
    datos.titulares = [{ nombre: exp.solicitanteNombre, documento: exp.solicitanteDocumento }];
  }
  return datos;
}
