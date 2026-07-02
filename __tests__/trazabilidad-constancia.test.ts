import { describe, expect, it } from 'vitest';
import type { AccionAuditoria } from '@/src/types/radicado';
import type { TipoNotificacion } from '@/lib/trazabilidad/notificacion';

/* ══════════════════════════════════════════════════════════════
   Sprint Ventanilla Operativa 2 — trazabilidad.

   Tests de tipo puro (compile-time): garantizan que los valores
   nuevos existen en los enums. Si mañana alguien los elimina, el
   compilador falla aquí.
══════════════════════════════════════════════════════════════ */

describe('Sprint Op 2 — enums de trazabilidad', () => {
  /* 1 */
  it('AccionAuditoria incluye CONSTANCIA_ENVIADA_CORREO', () => {
    const accion: AccionAuditoria = 'CONSTANCIA_ENVIADA_CORREO';
    expect(accion).toBe('CONSTANCIA_ENVIADA_CORREO');
  });

  /* 2 */
  it('TipoNotificacion incluye CONSTANCIA', () => {
    const tipo: TipoNotificacion = 'CONSTANCIA';
    expect(tipo).toBe('CONSTANCIA');
  });
});
