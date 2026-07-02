import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* ══════════════════════════════════════════════════════════════
   Sprint 1.5 · PR 3 — la ruta legacy /interno/recepcion debe
   redirigir al dashboard y no dejar rastro del formulario roto.

   Estos tests son de tipo "smoke sobre el source": leen el archivo
   como texto y validan que el patrón esperado esté presente y que
   el legacy haya sido removido. No arrancan Next.js.
══════════════════════════════════════════════════════════════ */

const LEGACY_PATH = join(__dirname, '..', 'app', 'interno', 'recepcion', 'page.tsx');
const contenido = readFileSync(LEGACY_PATH, 'utf8');

describe('Sprint 1.5 — redirect legacy /interno/recepcion', () => {
  it('la página legacy solo hace redirect a /interno/dashboard', () => {
    expect(contenido).toMatch(/redirect\(['"]\/interno\/dashboard['"]\)/);
    expect(contenido).toMatch(/from ['"]next\/navigation['"]/);
  });

  it('no queda código del formulario legacy roto', () => {
    // Mensaje del handleSubmit legacy que ya no debe existir.
    expect(contenido).not.toContain('Este formulario legacy fue reemplazado');
    // El componente redirect es Server Component; no debe declararse cliente.
    expect(contenido).not.toContain("'use client'");
    // No queda lógica de upload ni validación de archivos.
    expect(contenido).not.toContain('procesarArchivos');
    expect(contenido).not.toContain('handleSubmit');
  });
});
