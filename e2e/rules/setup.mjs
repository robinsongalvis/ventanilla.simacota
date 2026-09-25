/**
 * e2e/rules/setup.mjs
 *
 * Arnés de la matriz de pruebas de reglas de Firestore (ADR-0007). Corre
 * EXCLUSIVAMENTE contra el emulador de Firestore vía @firebase/rules-unit-testing —
 * no es la suite Vitest/jsdom de `__tests__/` (esa no tiene emulador disponible y
 * no debe mezclarse con estos archivos; ver vitest.config.mts, que excluye `e2e/**`).
 *
 * Runner: node:test nativo (no Vitest, no Playwright) — "propio runner" exigido
 * por ADR-0007 para no acoplar la matriz de seguridad a la config de jsdom.
 *
 * Requiere FIRESTORE_EMULATOR_HOST, que inyecta `firebase emulators:exec`
 * (ver script npm `test:rules` y el job CI `laboratorio-emulador`). Local: esta
 * máquina tiene Java 8 sin Docker, el emulador no arranca — deuda aceptada en
 * ADR-0002 y ADR-0007 (CI es la compuerta autoritativa).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = path.resolve(__dirname, '..', '..');

export const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'demo-ventanilla-lab';

export const TENANT_A = 'simacota';
export const TENANT_B = 'otro-municipio';

/**
 * Perfiles de users/{uid} sembrados para la matriz. userRole()/userTenant() en
 * firestore.rules leen SIEMPRE de este documento (no de custom claims del token),
 * así que cada actor de la matriz necesita su doc aquí para que las reglas basadas
 * en rol/tenant se puedan evaluar.
 */
export const PERFILES = {
  'admin-a':           { rol: 'ADMIN',            tenantId: TENANT_A },
  'recepcionista-a':   { rol: 'RECEPCIONISTA',    tenantId: TENANT_A },
  'control-interno-a': { rol: 'CONTROL_INTERNO',  tenantId: TENANT_A },
  'funcionario-a':     { rol: 'FUNCIONARIO',      tenantId: TENANT_A },
  'funcionario-b':     { rol: 'FUNCIONARIO',      tenantId: TENANT_B },
  'jefe-a':            { rol: 'JEFE_DEPENDENCIA', tenantId: TENANT_A },
  'jefe-b':            { rol: 'JEFE_DEPENDENCIA', tenantId: TENANT_B },
  // 'sin-perfil' se deja sin sembrar A PROPÓSITO: es un actor autenticado sin
  // documento en users/, para cubrir hasUserProfile() == false.
};

export async function crearEntorno() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      '⛔ e2e/rules solo corre contra el emulador de Firestore ' +
        '(FIRESTORE_EMULATOR_HOST ausente). Ejecutar vía `npm run test:rules` ' +
        'dentro de `firebase emulators:exec` — ver package.json y ' +
        '.github/workflows/ci.yml (job laboratorio-emulador). Local: esta máquina ' +
        'no puede levantar el emulador (Java 8, sin Docker) — ver ADR-0002/ADR-0007.'
    );
  }
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(path.join(RAIZ_REPO, 'firestore.rules'), 'utf8') },
  });
}

/** Un RulesTestContext por actor de la matriz, más anónimo (sin sesión). */
export function crearContextos(testEnv) {
  const contextos = {
    anonimo: testEnv.unauthenticatedContext(),
    'sin-perfil': testEnv.authenticatedContext('sin-perfil'),
  };
  for (const uid of Object.keys(PERFILES)) {
    contextos[uid] = testEnv.authenticatedContext(uid);
  }
  return contextos;
}

/**
 * Siembra los datos fijos de la matriz con las reglas desactivadas (bypass de
 * administrador del propio harness, equivalente al Admin SDK). Un documento por
 * tenant (A y B) en cada colección con aislamiento; un documento de muestra en
 * las colecciones de solo-rol sin aislamiento por tenant.
 *
 * NOTA — 'radicados' (legacy): fuera del alcance de la matriz Ola 1 (ADR-0007 /
 * PLAN_OLA1.md §P-B): sus escrituras ya están cerradas (`allow create/update: if
 * false`), lo que reduce el riesgo residual; no se siembra aquí.
 */
export async function sembrarDatos(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await Promise.all(
      Object.entries(PERFILES).map(([uid, perfil]) => setDoc(doc(db, 'users', uid), perfil))
    );

    // ── ventanilla_radicados (+ trazabilidad) ─────────────────────────────
    await setDoc(doc(db, 'ventanilla_radicados/rad-a-1'), {
      radicadoId: 'rad-a-1',
      clasificacion: { oficinaDestino: TENANT_A },
    });
    await setDoc(doc(db, 'ventanilla_radicados/rad-b-1'), {
      radicadoId: 'rad-b-1',
      clasificacion: { oficinaDestino: TENANT_B },
    });
    await setDoc(doc(db, 'ventanilla_radicados/rad-a-1/trazabilidad/evt-1'), { evento: 'radicado' });
    await setDoc(doc(db, 'ventanilla_radicados/rad-b-1/trazabilidad/evt-1'), { evento: 'radicado' });

    // ── ventanilla_salidas ─────────────────────────────────────────────────
    await setDoc(doc(db, 'ventanilla_salidas/sal-a-1'), { salidaId: 'sal-a-1', dependenciaOrigen: TENANT_A });
    await setDoc(doc(db, 'ventanilla_salidas/sal-b-1'), { salidaId: 'sal-b-1', dependenciaOrigen: TENANT_B });

    /* ── expedientes ────────────────────────────────────────────────────
       Sembrado para poder DEMOSTRAR que está cerrado a todo cliente. Sin un
       documento real, un `getDoc` que falla no distingue «la regla lo prohíbe»
       de «no hay nada ahí» — y la prueba estaría verde por ausencia, que es la
       familia de defecto que este repositorio lleva semanas corrigiendo. */
    await setDoc(doc(db, 'expedientes/exp-a-1'), {
      id: 'exp-a-1',
      tenantId: TENANT_A,
      estadoJuridico: 'PRESENTADA',
      esPrueba: true,
    });
    await setDoc(doc(db, 'expedientes/exp-a-1/actuaciones/act-1'), { tipo: 'apertura-expediente' });

    // ── control_interno_* ──────────────────────────────────────────────────
    await setDoc(doc(db, 'control_interno_hallazgos/h-a-1'), { tenantId: TENANT_A });
    await setDoc(doc(db, 'control_interno_hallazgos/h-b-1'), { tenantId: TENANT_B });
    await setDoc(doc(db, 'control_interno_planes_mejora/p-a-1'), { tenantId: TENANT_A });
    await setDoc(doc(db, 'control_interno_planes_mejora/p-b-1'), { tenantId: TENANT_B });
    await setDoc(doc(db, 'control_interno_alertas/al-1'), { titulo: 'muestra' });
    await setDoc(doc(db, 'control_interno_eventos/ev-1'), { titulo: 'muestra' });

    // ── Colecciones de solo-rol, sin aislamiento por tenant ────────────────
    await setDoc(doc(db, 'ai_logs/log-1'), { modelo: 'muestra' });
    await setDoc(doc(db, 'ai_feedback/fb-1'), { util: true });
    await setDoc(doc(db, 'ai_auditoria/au-1'), { evento: 'muestra' });
    await setDoc(doc(db, 'admin_auditoria/adm-1'), { evento: 'muestra' });
    await setDoc(doc(db, 'simi_auditoria/simi-1'), { evento: 'muestra' });
    await setDoc(doc(db, 'counters/2026'), { valor: 1 });
    await setDoc(doc(db, 'ventanilla_planillas/pl-1'), { estado: 'abierta' });
  });
}
