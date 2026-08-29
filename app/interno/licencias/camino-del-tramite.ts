/**
 * app/interno/licencias/camino-del-tramite.ts
 *
 * Los cuatro pasos que la funcionaria ve a la derecha del expediente. PURO y
 * de PRESENTACIÓN: traduce el estado jurídico —que no se toca— a «en qué punto
 * del camino va esto».
 *
 * ── NO ES UNA MÁQUINA DE ESTADOS PARALELA ────────────────────────────────
 *
 * Los once estados jurídicos y sus transiciones siguen viviendo en
 * `lib/motor-expedientes/estados-licencia.ts`, con su fundamento normativo.
 * Esto es un RESUMEN para el mostrador: cuatro hitos que una persona reconoce.
 * Si los dos dijeran cosas distintas, manda el motor — aquí solo se agrupa.
 *
 * Por eso el mapa es un `Record` COMPLETO sobre los once: un estado nuevo sin
 * paso asignado no compila, en vez de caer en un `default` que lo pintaría en
 * el paso equivocado.
 */
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';

export type SituacionPaso = 'CUMPLIDO' | 'ACTUAL' | 'PENDIENTE';

export interface PasoCamino {
  numero: 1 | 2 | 3 | 4;
  titulo: string;
  /**
   * Qué significa, en una línea, SEGÚN LA SITUACIÓN DEL PASO.
   *
   * No es una cadena fija, y el motivo es un defecto real que se vio en
   * pantalla: el paso 2 llevaba «el plazo aún no corre» escrito a secas, así
   * que un expediente ya radicado lo mostraba ✓ CUMPLIDO y a la vez afirmaba
   * que el plazo no corría — mientras la cabecera de la misma pantalla decía
   * que vencía el 27/10. Dos afirmaciones contrarias sobre el mismo hecho, a
   * diez centímetros una de otra.
   *
   * Una frase en presente solo es cierta mientras el paso es el ACTUAL. Al
   * quedar atrás hay que hablar en pasado, o callar.
   */
  subtexto: (situacion: SituacionPaso) => string;
}

export const PASOS: readonly PasoCamino[] = [
  {
    numero: 1,
    titulo: 'Solicitud recibida',
    subtexto: () => 'acuse enviado al ciudadano',
  },
  {
    numero: 2,
    titulo: 'Completar documentos',
    /* «El plazo aún no corre» SOLO mientras se está aquí. Una vez radicado, el
       plazo sí corre y repetirlo sería contradecir la cabecera. */
    subtexto: (s) =>
      s === 'ACTUAL' ? 'el plazo aún no corre' : s === 'CUMPLIDO' ? 'documentación completa' : 'reunir los requisitos',
  },
  {
    numero: 3,
    titulo: 'Radicar en debida forma',
    subtexto: (s) => (s === 'CUMPLIDO' ? 'el plazo empezó a correr' : 'emite el número y arranca el plazo'),
  },
  {
    numero: 4,
    titulo: 'Revisión y decisión',
    subtexto: () => 'la Secretaría estudia y resuelve',
  },
];

/**
 * En qué paso está el expediente.
 *
 * `PRESENTADA` es el 2 y no el 1 a propósito: la solicitud YA se recibió —ese
 * hito está cumplido— y lo que falta es completarla. Ponerla en el 1 haría
 * creer que no se ha hecho nada.
 */
const PASO_POR_ESTADO: Readonly<Record<EstadoJuridicoLicencia, 1 | 2 | 3 | 4>> = {
  PRESENTADA: 2,
  RADICADA_EN_DEBIDA_FORMA: 4,
  EN_REVISION: 4,
  CON_ACTA_DE_OBSERVACIONES: 4,
  EN_VIABILIDAD: 4,
  CONCEDIDA: 4,
  NEGADA: 4,
  DESISTIDA: 4,
  NOTIFICADA: 4,
  EN_FIRME: 4,
  /* Un expediente migrado del libro histórico no recorrió este camino: no se
     le inventa un punto. El 4 es el más honesto —ya no está en trámite— y la
     pantalla lo acompaña de su chip de estado, que dice lo que de verdad es. */
  HISTORICO_SIN_RESOLVER: 4,
};

export function situacionDePaso(
  paso: PasoCamino,
  estado: EstadoJuridicoLicencia,
): SituacionPaso {
  const actual = PASO_POR_ESTADO[estado];
  if (paso.numero < actual) return 'CUMPLIDO';
  if (paso.numero === actual) return 'ACTUAL';
  return 'PENDIENTE';
}
