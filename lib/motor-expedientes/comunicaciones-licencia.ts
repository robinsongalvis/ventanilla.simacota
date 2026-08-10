/**
 * Constantes de PRESENTACIÓN de comunicaciones de licencias — compartidas
 * entre servidor y cliente.
 *
 * Extraído de `lib/server/expedientes-licencias.ts` (Bloque "Términos y
 * vigencias protectores", 10-ago-2026) para saldar una deuda declarada por
 * dev-backend: `app/interno/licencias/presentacion-actuaciones.ts`
 * mantenía el literal `'Aviso de acta'` DUPLICADO en vez de importar la
 * constante — pero `lib/server/*` es, por CONVENCIÓN ya establecida en este
 * módulo (`RegistrarActuacionModal.tsx`, `DetalleLicenciaClient.tsx`, …:
 * todo lo que ese directorio expone al cliente se importa con `import
 * type`, NUNCA como valor), la señal de "server-only" — aunque este
 * archivo en concreto no importa hoy ningún SDK de servidor, acoplar un
 * componente cliente a un import de VALOR desde `lib/server/` rompería esa
 * convención y dejaría el bundle del cliente expuesto a que una futura
 * dependencia real de servidor en `expedientes-licencias.ts` (Admin SDK,
 * etc.) lo arrastre sin aviso. Este módulo, en cambio, es PURO por
 * construcción (una sola constante de texto, sin I/O, sin dependencias) —
 * el lugar seguro para que servidor y cliente compartan el mismo valor.
 *
 * `lib/server/expedientes-licencias.ts` re-exporta esta constante para no
 * romper a sus consumidores actuales (rutas `app/api/...`).
 */

/**
 * Prefijo que identifica una comunicación como "aviso del acta de
 * observaciones" — fuente de verdad ÚNICA para esa clasificación, tanto en
 * el servidor (`esComunicacionDelActa`, `lib/server/expedientes-licencias.ts`)
 * como en la presentación del timeline (`tituloComunicacionEnviada`,
 * `app/interno/licencias/presentacion-actuaciones.ts`). Mismo texto exacto
 * que arma `construirActuacionComunicacionEnviada` para el aviso del acta.
 */
export const PREFIJO_AVISO_ACTA_COMUNICACION = 'Aviso de acta';
