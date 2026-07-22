/**
 * Test de regresión — SEV-1 producción caída (main=1957817, 21-22 jul 2026).
 *
 * Causa raíz confirmada:
 *   firebase-admin 13.10.0 → jwks-rsa ^3.1.0 → jose ^4.15.4 (dual CJS/ESM,
 *     exports declara condición "require")
 *   firebase-admin 14.2.0 → jwks-rsa ^4.0.1 → jose ^6.1.3 (SOLO ESM,
 *     exports NO declara condición "require" — únicamente "types"/"default")
 *
 * `jwks-rsa/src/utils.js` hace `const jose = require('jose');` a nivel de
 * módulo (línea 1). En cualquier runtime de Node.js que no tenga habilitado
 * por defecto `require(esm)` (la característica se desenmarcó en Node
 * 22.12+ y se retroportó a 20.19+/18.20+, pero NO estaba activa en el
 * runtime de Vercel que sirvió producción — reproducido localmente con
 * Node 20.18.0, ver bitácora del incidente), esa línea revienta con
 * `ERR_REQUIRE_ESM` en el momento en que se importa `firebase-admin/auth`
 * — ANTES de validar ninguna credencial. El crash ocurre en el arranque
 * del proceso (eager import), no solo al invocar una ruta específica.
 *
 * Esta prueba fuerza deterministamente esa condición usando el flag
 * `--no-experimental-require-module` (documentado en `node --help` desde
 * Node 20.17+), sin depender de qué versión de Node ejecute la máquina
 * de CI/desarrollador ni de descargar un runtime alterno. Así se detecta
 * el bug independientemente de si el entorno local "por casualidad" tiene
 * un Node reciente que lo enmascara (como ocurrió: Node 24 local NO
 * reproducía el fallo, lo que retrasó la detección).
 *
 * Evidencia de que este test es el gate correcto:
 *  - Con el HEAD actual (firebase-admin 14.2.0 / jose 6.2.3): FALLA con
 *    ERR_REQUIRE_ESM (reproducido manualmente antes de escribir este test).
 *  - Con firebase-admin 13.10.0 / jose 4.15.9 (versión previa a la PR #130):
 *    PASA — jose 4.x expone condición "require" en package.json#exports.
 *
 * No requiere red, secretos, build de Next.js ni Firestore — corre en
 * milisegundos contra node_modules ya instalado.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

/**
 * Puntos de entrada de `firebase-admin` que el código de producción importa
 * a nivel de módulo (ver `lib/firebase-admin.ts`). Si en el futuro se agrega
 * un import nuevo de `firebase-admin/*`, debe añadirse aquí — este test no
 * escanea el árbol de imports automáticamente (fuera del alcance de QA:
 * ver hallazgo sobre un gate estático más general en el informe del SEV-1).
 */
const ENTRADAS_FIREBASE_ADMIN_EN_USO = [
  'firebase-admin/app',
  'firebase-admin/auth',
  'firebase-admin/firestore',
  'firebase-admin/storage',
] as const;

describe('regresión SEV-1 — firebase-admin no debe depender de un jose ESM-only sin condición require', () => {
  it.each(ENTRADAS_FIREBASE_ADMIN_EN_USO)(
    'require(%s) no debe lanzar ERR_REQUIRE_ESM en un runtime sin require(esm) habilitado',
    (entrada) => {
      const script = `try { require(${JSON.stringify(entrada)}); process.exit(0); } catch (e) { console.error(e.code + ': ' + e.message); process.exit(1); }`;

      let stderr = '';
      let exitCode = 0;
      try {
        execFileSync(
          process.execPath,
          ['--no-experimental-require-module', '-e', script],
          { cwd: process.cwd(), encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
        );
      } catch (err) {
        const e = err as { status?: number; stderr?: string };
        exitCode = e.status ?? 1;
        stderr = e.stderr ?? '';
      }

      if (exitCode !== 0) {
        throw new Error(
          `require('${entrada}') falló en un runtime Node sin require(esm) habilitado ` +
            `(simulado con --no-experimental-require-module). Esto reproduce el SEV-1 de ` +
            `producción del 21-22 jul 2026: firebase-admin arrastra jwks-rsa -> jose, y si ` +
            `jose no expone condición "require" en su package.json#exports, cualquier ` +
            `runtime de Vercel que no tenga desenmarcado require(esm) revienta con ` +
            `ERR_REQUIRE_ESM al importar ${entrada}, tumbando toda ruta dinámica ` +
            `(dashboard, consulta pública, radicación).\n\nSalida real:\n${stderr}`,
        );
      }

      expect(exitCode).toBe(0);
    },
  );
});
