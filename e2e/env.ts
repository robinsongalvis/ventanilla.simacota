import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Lee `.env.stage` sin depender de que el proceso que ejecuta Playwright
 * haya cargado el entorno de stage (a diferencia de `next dev`, que sí lo
 * hace vía `npm run dev:stage`). Los tests SOLO necesitan la contraseña
 * de laboratorio — nunca se escribe en el código ni se imprime en logs.
 *
 * Réplica minimalista del parseo de `scripts/laboratorio/dev-stage.mjs`
 * (sin `source` de shell, porque hay valores JSON con comillas).
 */
function leerVariableEnvStage(nombre: string): string {
  const ruta = resolve(process.cwd(), '.env.stage');
  let contenido: string;
  try {
    contenido = readFileSync(ruta, 'utf8');
  } catch {
    throw new Error(
      `No se pudo leer .env.stage en ${ruta}. El auditor funcional requiere las ` +
      'credenciales de laboratorio de stage (ver docs/laboratorio/FASE2_BITACORA.md).',
    );
  }

  for (const linea of contenido.split('\n')) {
    if (!linea || linea.startsWith('#') || !linea.includes('=')) continue;
    const i = linea.indexOf('=');
    const clave = linea.slice(0, i).trim();
    if (clave === nombre) return linea.slice(i + 1).trim();
  }

  throw new Error(`.env.stage no define ${nombre}. Requerido por el auditor funcional (e2e/).`);
}

export const LAB_PASSWORD = leerVariableEnvStage('LAB_PASSWORD');

export const PROYECTO_PROD = 'ventanilla-unica-f31b1';

/**
 * Guarda anti-producción, réplica de la de `dev-stage.mjs` (ADR-0002 §2):
 * el auditor funcional se niega a correr si `.env.stage` apunta a prod.
 * No evita que el servidor bajo prueba esté mal configurado, pero deja
 * constancia explícita antes de radicar nada sintético.
 */
export function verificarNoEsProduccion(): void {
  const proyecto = leerVariableEnvStage('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (proyecto === PROYECTO_PROD) {
    throw new Error(
      `GUARDA: .env.stage apunta a producción (${PROYECTO_PROD}). Auditor funcional abortado.`,
    );
  }
}

/**
 * Credencial de servidor de STAGE, para el marcado `isTest` vía Admin SDK
 * (mismo patrón de lectura que `scripts/laboratorio/seed-funcionarios-stage.mjs`).
 * Nunca se usa para nada más que marcar datos sintéticos como tales.
 */
export function leerServiceAccountStage(): { projectId: string; credencial: Record<string, unknown> } {
  verificarNoEsProduccion();
  const credencial = JSON.parse(leerVariableEnvStage('FIREBASE_SERVICE_ACCOUNT')) as Record<string, unknown>;
  const projectId = String(credencial.project_id ?? '');
  if (projectId === PROYECTO_PROD || !projectId) {
    throw new Error('GUARDA: FIREBASE_SERVICE_ACCOUNT de .env.stage no corresponde a un proyecto de stage válido.');
  }
  return { projectId, credencial };
}

export const USUARIOS_LAB = {
  recepcionista: 'recepcionista.lab@simacota.gov.co',
  funcionario:   'funcionario.lab@simacota.gov.co',
  jefe:          'jefe.lab@simacota.gov.co',
  admin:         'admin.lab@simacota.gov.co',
} as const;
