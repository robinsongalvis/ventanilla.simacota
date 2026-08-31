/**
 * lib/motor-expedientes/semaforo-termino.ts
 *
 * EL CRITERIO DEL VIGÍA, EN UN SOLO SITIO. Puro: sin Firestore, sin correo,
 * sin reloj propio.
 *
 * ── POR QUÉ SE MOVIÓ AQUÍ ─────────────────────────────────────────────────
 *
 * Vivía dentro de `app/api/cron/vencimientos-licencias/route.ts`. Cuando la
 * pantalla del expediente necesitó pintar el mismo semáforo, había dos
 * caminos: copiar los umbrales —y arriesgarse a que la pantalla dijera «en
 * término» mientras el correo decía «crítico»— o compartir la función.
 *
 * Importar la ruta desde un componente no era opción: arrastraría
 * `firebase-admin` y el envío de correo al navegador. Así que el criterio sube
 * aquí y la ruta lo importa.
 *
 * ES UN MOVIMIENTO, NO UN CAMBIO. Mismos escalones, misma clasificación, mismo
 * orden de decisión. Las pruebas que ya existían del cron son el testigo: si
 * pasan igual, el traslado no alteró nada.
 *
 * La entrada se declara ESTRUCTURALMENTE en vez de importar
 * `ExpedienteLicenciaDoc` desde `lib/server`: así ninguna cadena de imports de
 * servidor puede colarse en el paquete del navegador por accidente.
 */
import { diasHabilesTranscurridos, diasRestantesHabiles } from '@/lib/tiempos-radicado';
import {
  terminoResolucionSigueCorriendo,
  type EstadoJuridicoLicencia,
} from './estados-licencia';

/**
 * Umbrales de alerta, en días hábiles restantes. Escalonados a propósito: un
 * único aviso a dos días no da margen para reunir un concepto técnico.
 */
/**
 * El plazo de decisión: 45 días hábiles (D.1077/2015 art. 2.2.6.1.2.3.1).
 *
 * Vivía en `lib/server/expedientes-licencias.ts`, que la pantalla no puede
 * importar sin arrastrar `firebase-admin` al navegador. Sube aquí, junto al
 * resto del criterio del término, y el servidor lo reexporta.
 */
export const PLAZO_DECISION_LICENCIA_DIAS_HABILES = 45;

export const ESCALONES = [
  { hasta: 0, nivel: 'VENCIDO' as const },
  { hasta: 5, nivel: 'CRITICO' as const },
  { hasta: 15, nivel: 'AVISO' as const },
];

/**
 * El estado en que el reloj está detenido. Se nombra EXPLÍCITO y no se deduce
 * de `terminoResolucionSigueCorriendo`: esa función responde «¿ya se
 * resolvió?» (CONCEDIDA, NEGADA, DESISTIDA…), no «¿está suspendido?». Al
 * escribir esto la primera vez se confundieron, y CON_ACTA_DE_OBSERVACIONES
 * habría caído en CORRIENDO — el colapso de situaciones que este vigía existe
 * para evitar.
 *
 * ── SON DOS CAUSAS, NO UNA (ADR-0038 §9.2) ───────────────────────────────
 *
 * Esto era un VALOR ÚNICO, y por eso `EN_VIABILIDAD` se clasificaba CORRIENDO:
 * durante los días en que el ciudadano reúne los documentos de pago, la pantalla
 * y el cron contaban tiempo contra la Secretaría que la norma NO cuenta. Es la
 * misma familia que el rojo con 41 días por delante, pero al revés — el sistema
 * apurando a quien la ley no apura.
 *
 * Un CONJUNTO y no un `if` encadenado: que una tercera causa mañana sea un dato
 * y no una rama.
 */
export const ESTADOS_QUE_SUSPENDEN_EL_TERMINO: ReadonlyMap<EstadoJuridicoLicencia, string> = new Map([
  [
    'CON_ACTA_DE_OBSERVACIONES',
    'D.1077/2015 art. 2.2.6.1.2.2.4 — «Durante este plazo se suspenderá el término para la expedición de la licencia».',
  ],
  [
    'EN_VIABILIDAD',
    'D.1077/2015 art. 2.2.6.1.2.3.1 par. 1 — «Durante este término se entenderá suspendido el trámite para la expedición de la licencia».',
  ],
]);

/** ¿Este estado suspende el término? Y si sí, con qué fundamento. */
export function suspendeElTermino(estado: EstadoJuridicoLicencia): string | null {
  return ESTADOS_QUE_SUSPENDEN_EL_TERMINO.get(estado) ?? null;
}

export type SituacionTermino = 'CORRIENDO' | 'SUSPENDIDO' | 'SIN_ANCLAR' | 'RESUELTO';
export type NivelTermino = 'VENCIDO' | 'CRITICO' | 'AVISO';

/* ── CÓMO SE LLAMA Y DE QUÉ COLOR ES CADA NIVEL ─────────────────────────
   Vivían dentro de la plantilla del correo. Los sube aquí el mismo motivo que
   subió el criterio: la pantalla pintaba CRÍTICO y AVISO EXACTAMENTE IGUAL
   —mismo ámbar, mismo texto— mientras el correo los distinguía. Un escalón que
   clasifica pero no se ve es un escalón que no existe para quien mira.

   Las palabras y los hexadecimales son los del correo, carácter por carácter:
   esto es un traslado, no un rediseño. `__tests__/vigia-termino-avisa.test.ts`
   es el testigo.

   ESPERA_EXCESIVA NO está aquí, y es deliberado: no es un nivel del término
   —es la categoría de los expedientes cuyo término NO HA EMPEZADO—. Vive donde
   se vigila la espera, no donde se clasifica el plazo. */

/** Cómo se llama cada nivel de cara a una persona. */
export const ETIQUETA_NIVEL_TERMINO: Record<NivelTermino, string> = {
  VENCIDO: 'Término vencido',
  CRITICO: 'Vence en 5 días hábiles o menos',
  AVISO: 'Vence en 15 días hábiles o menos',
};

/** Un solo juego de colores para el correo y para la pantalla. */
export const COLOR_NIVEL_TERMINO: Record<NivelTermino, string> = {
  VENCIDO: '#B42318',
  CRITICO: '#B54708',
  AVISO: '#5A4A16',
};

export interface FilaVigia {
  expedienteId: string;
  numeroExpediente: string | null;
  situacion: SituacionTermino;
  /** Solo en CORRIENDO. */
  diasHabilesRestantes?: number;
  nivel?: NivelTermino;
  /** Solo en SUSPENDIDO: el artículo que detiene el reloj, para poder citarlo. */
  fundamentoSuspension?: string;
  /** Solo en SIN_ANCLAR. */
  diasHabilesEnEspera?: number;
}

/** Lo mínimo que hace falta para clasificar. Declarado aquí, no importado. */
export interface ExpedienteParaSemaforo {
  id: string;
  estadoJuridico: EstadoJuridicoLicencia;
  creadoEn: string;
  numeroExpediente?: { numero: string } | null;
  fechaAlertaConservadora?: string | null;
}

/**
 * Clasifica un expediente frente al reloj. La MISMA función que consulta el
 * cron y que pinta la pantalla: si un día divergieran, el correo diría una cosa
 * y el expediente otra sobre el mismo plazo.
 */
export function clasificarFrenteAlTermino(
  exp: ExpedienteParaSemaforo,
  ahora: Date,
): FilaVigia {
  const base = {
    expedienteId: exp.id,
    numeroExpediente: exp.numeroExpediente?.numero ?? null,
  };

  // SIN_ANCLAR primero: la ausencia de fecha es el discriminante más fuerte y
  // no depende de interpretar el estado jurídico.
  if (!exp.fechaAlertaConservadora) {
    return { ...base, situacion: 'SIN_ANCLAR', diasHabilesEnEspera: diasHabilesTranscurridos(exp.creadoEn, ahora) };
  }

  // RESUELTO: la Administración ya decidió; el plazo dejó de correr. Medirlo
  // contra «hoy» convertiría el paso del tiempo en una mora que no existe.
  // OJO al añadir estados: decide con un ARRAY, no con un Record, así que el
  // compilador NO avisa (ADR-0033 §5).
  if (!terminoResolucionSigueCorriendo(exp.estadoJuridico)) {
    return { ...base, situacion: 'RESUELTO' };
  }

  // SUSPENDIDO: la norma detiene el reloj. Dos causas hoy — ver el mapa.
  const fundamentoSuspension = suspendeElTermino(exp.estadoJuridico);
  if (fundamentoSuspension) {
    return { ...base, situacion: 'SUSPENDIDO', fundamentoSuspension };
  }

  const diasHabilesRestantes = diasRestantesHabiles(exp.fechaAlertaConservadora, ahora);
  const escalon = ESCALONES.find((e) => diasHabilesRestantes <= e.hasta);
  return {
    ...base,
    situacion: 'CORRIENDO',
    diasHabilesRestantes,
    ...(escalon ? { nivel: escalon.nivel } : {}),
  };
}
