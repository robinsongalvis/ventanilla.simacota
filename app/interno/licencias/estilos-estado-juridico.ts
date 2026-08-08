import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import type { EstiloChipEstado } from './estilos-chip-estado';

/**
 * Trío de color por ESTADO JURÍDICO (los 9 hitos de `estados-licencia.ts`,
 * DF-5/ADR-0029) — mapa de PRESENTACIÓN, hermano de `ESTILOS_CHIP_ESTADO`
 * (`estilos-chip-estado.ts`, que pinta el semáforo `EstadoLicenciaUI` de
 * los fixtures). NINGÚN estado nuevo se inventa aquí: los 9 valores de
 * `EstadoJuridicoLicencia` son el dominio cerrado, esto solo decide cómo
 * se VE cada uno.
 *
 * Reutiliza los mismos tríos ya definidos en `estilos-chip-estado.ts`
 * donde el significado coincide (mismo principio de "reutilización de
 * tokens" declarado ahí), en vez de inventar una paleta nueva:
 *  - `EN_REVISION` / `EN_VIABILIDAD` → el mismo verde institucional que
 *    `EN_TERMINO` (trabajo activo, en curso).
 *  - `CON_ACTA_DE_OBSERVACIONES` → el mismo ámbar que `POR_VENCER`
 *    (advertencia: requiere respuesta del solicitante).
 *  - `DESISTIDA` → el mismo gris neutro que `TERMINADO`.
 *  - `RADICADA_EN_DEBIDA_FORMA` / `NOTIFICADA` → el mismo azul info que
 *    `HISTORICO`.
 *
 * DECISIÓN DELIBERADA (no obvia): `NOTIFICADA` y `EN_FIRME` NO se pintan
 * en verde/esmeralda aunque sigan a una decisión. El mapa de transiciones
 * (`estados-licencia.ts`) muestra que `{CONCEDIDA, NEGADA, DESISTIDA} →
 * NOTIFICADA → EN_FIRME` — el mismo camino sirve para un acto FAVORABLE y
 * uno DESFAVORABLE. Colorear "notificada"/"en firme" de verde fingiría que
 * el expediente terminó bien cuando pudo haber sido negado; se usan tonos
 * neutros (azul informativo / gris) para no prejuzgar el contenido del
 * acto — la única información de valor (concedida vs. negada) ya se vio
 * en el chip anterior de la trazabilidad.
 */
export const ESTILOS_ESTADO_JURIDICO: Record<EstadoJuridicoLicencia, EstiloChipEstado> = {
  RADICADA_EN_DEBIDA_FORMA: {
    dot: '#2563EB',
    texto: '#1E4FA0',
    fondo: '#E9F0FC',
    label: 'Radicada en debida forma',
  },
  EN_REVISION: {
    dot: '#14532D',
    texto: '#14532D',
    fondo: '#EEF4EE',
    label: 'En revisión',
  },
  CON_ACTA_DE_OBSERVACIONES: {
    dot: '#D97706',
    texto: '#7A4F0A',
    fondo: '#FAEEDA',
    label: 'Con acta de observaciones',
  },
  EN_VIABILIDAD: {
    dot: '#14532D',
    texto: '#14532D',
    fondo: '#EEF4EE',
    label: 'En viabilidad',
  },
  CONCEDIDA: {
    dot: '#16A34A',
    texto: '#116932',
    fondo: '#E7F6EC',
    label: 'Concedida',
  },
  NEGADA: {
    dot: '#DC2626',
    texto: '#911111',
    fondo: '#FCEBEB',
    label: 'Negada',
  },
  DESISTIDA: {
    dot: '#475569',
    texto: '#3A4551',
    fondo: '#EEF2F5',
    label: 'Desistida',
  },
  NOTIFICADA: {
    dot: '#2563EB',
    texto: '#1E4FA0',
    fondo: '#E9F0FC',
    label: 'Notificada',
  },
  EN_FIRME: {
    dot: '#334155',
    texto: '#1E293B',
    fondo: '#EEF1F4',
    label: 'En firme',
  },
};
