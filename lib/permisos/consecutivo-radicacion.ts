import type { RolInterno } from '@/lib/hooks/useAuth';

/**
 * Relevo del software anterior — punto único de verdad sobre quién puede ver y
 * mover el consecutivo de radicación.
 *
 * ADMIN y RECEPCIONISTA (ventanilla), nadie más. No es una decisión de jerarquía
 * sino de quién tiene el dato: el último número emitido por el sistema anterior
 * está en el libro físico de ventanilla, y quien lo mira es la funcionaria que
 * radica. Obligarla a pedir el cambio a un administrador el día del corte, con
 * ciudadanos esperando en el mostrador, es garantizar que el relevo termine
 * anotado a mano en una hoja — que es exactamente lo que este sistema reemplaza.
 *
 * El riesgo de abrirlo está acotado por diseño, no por confianza:
 *  · el contador solo AVANZA (`validarAjusteConsecutivo`) — jamás reemite un
 *    número que ya esté en manos de un ciudadano;
 *  · exige motivo escrito y queda en `admin_auditoria` con nombre y fecha;
 *  · decide el servidor: la pantalla solo ayuda a ver el número antes de fijarlo.
 *
 * Los demás roles quedan fuera a propósito: FUNCIONARIO y JEFE_DEPENDENCIA no
 * radican en ventanilla, y CONTROL_INTERNO audita — no opera.
 *
 * Alineación: este predicado gobierna a la vez la ruta
 * `/api/interno/consecutivo-radicacion` (GET y POST) y la visibilidad del campo
 * editable en la Radicación Rápida. Una sola función para que la pantalla no
 * pueda ofrecer lo que el servidor rechaza, ni al contrario.
 */
export function puedeMoverConsecutivoRadicacion(rol: RolInterno | string): boolean {
  return rol === 'ADMIN' || rol === 'RECEPCIONISTA';
}
