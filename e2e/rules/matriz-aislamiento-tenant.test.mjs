/**
 * e2e/rules/matriz-aislamiento-tenant.test.mjs
 *
 * Matriz tenant × rol × colección × operación (ADR-0007). Verifica por
 * COMPORTAMIENTO —contra el emulador de Firestore, no por sintaxis/dry-run— el
 * invariante de aislamiento por tenantId de `firestore.rules`: ningún tenant lee
 * ni escribe datos de otro tenant, y las mutaciones críticas quedan cerradas al
 * cliente (server-side vía Admin SDK).
 *
 * Runner: node:test nativo. Ejecutar con `npm run test:rules` DENTRO de
 * `firebase emulators:exec` (ver package.json y el job CI `laboratorio-emulador`
 * en .github/workflows/ci.yml). No corre en la suite Vitest/jsdom de `__tests__/`.
 *
 * ── POLÍTICA DE NO-REGRESIÓN DE COBERTURA (ADR-0007) ──────────────────────────
 * Toda colección o regla nueva en `firestore.rules` agrega su fila a `MATRIZ`
 * antes de mergear (positivo: el dueño del tenant/rol accede; negativo: el
 * acceso cruzado se rechaza). Si la regla nueva no tiene aislamiento por tenant,
 * documentarlo explícitamente en el caso (ver ejemplo del grupo
 * "ai_logs/ai_feedback/ai_auditoria", que son de solo-rol).
 * ───────────────────────────────────────────────────────────────────────────
 */
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore';
import { crearEntorno, crearContextos, sembrarDatos, TENANT_A, TENANT_B } from './setup.mjs';

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;
let ctx;

before(async () => {
  testEnv = await crearEntorno();
  await sembrarDatos(testEnv);
  ctx = crearContextos(testEnv);
});

after(async () => {
  await testEnv?.cleanup();
});

function dbDe(actor) {
  assert.ok(ctx[actor], `Actor "${actor}" no está definido en crearContextos() — revisar setup.mjs`);
  return ctx[actor].firestore();
}

/**
 * @typedef {{
 *   grupo: string,
 *   caso: string,
 *   actor: string,
 *   esperado: 'permitido' | 'denegado',
 *   ejecutar: (db: import('firebase/firestore').Firestore) => Promise<unknown>,
 * }} CasoMatriz
 * @type {CasoMatriz[]}
 */
const MATRIZ = [
  // ══ users/{uid} ═══════════════════════════════════════════════════════════
  {
    grupo: 'users', caso: 'get propio perfil', actor: 'funcionario-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'users/funcionario-a')),
  },
  {
    grupo: 'users', caso: 'ADMIN lee perfil de cualquier usuario', actor: 'admin-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'users/funcionario-b')),
  },
  {
    grupo: 'users', caso: 'FUNCIONARIO no lee perfil ajeno', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'users/funcionario-b')),
  },
  {
    grupo: 'users', caso: 'RECEPCIONISTA lista usuarios (selector de responsable)', actor: 'recepcionista-a', esperado: 'permitido',
    ejecutar: (db) => getDocs(collection(db, 'users')),
  },
  {
    grupo: 'users', caso: 'FUNCIONARIO no lista usuarios', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => getDocs(collection(db, 'users')),
  },
  {
    grupo: 'users', caso: 'ADMIN crea usuario con rol y tenantId válidos', actor: 'admin-a', esperado: 'permitido',
    ejecutar: (db) => setDoc(doc(db, 'users/nuevo-1'), { rol: 'FUNCIONARIO', tenantId: TENANT_A }),
  },
  {
    grupo: 'users', caso: 'RECEPCIONISTA no puede crear usuarios', actor: 'recepcionista-a', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'users/nuevo-2'), { rol: 'FUNCIONARIO', tenantId: TENANT_A }),
  },
  {
    grupo: 'users', caso: 'ADMIN no puede crear usuario con rol inválido', actor: 'admin-a', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'users/nuevo-3'), { rol: 'SUPERUSER', tenantId: TENANT_A }),
  },
  {
    grupo: 'users', caso: 'delete siempre denegado (incluso ADMIN)', actor: 'admin-a', esperado: 'denegado',
    ejecutar: (db) => deleteDoc(doc(db, 'users/funcionario-a')),
  },

  // ══ ventanilla_radicados — CORE del invariante de aislamiento ═══════════════
  {
    grupo: 'ventanilla_radicados', caso: 'FUNCIONARIO lee radicado de su propio tenant', actor: 'funcionario-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_radicados/rad-a-1')),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'FUNCIONARIO NO lee radicado de otro tenant', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_radicados/rad-b-1')),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'JEFE_DEPENDENCIA NO lee radicado de otro tenant', actor: 'jefe-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_radicados/rad-b-1')),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'RECEPCIONISTA lee radicado de cualquier tenant (cross-tenant esperado)', actor: 'recepcionista-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_radicados/rad-b-1')),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'CONTROL_INTERNO lee radicado de cualquier tenant', actor: 'control-interno-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_radicados/rad-b-1')),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'ADMIN lee radicado de cualquier tenant', actor: 'admin-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_radicados/rad-b-1')),
  },
  {
    // Documenta la ADVERTENCIA del propio firestore.rules (líneas 219-224): una
    // query 'list' sin filtro de tenant falla completa aunque algunos docs
    // cumplan la regla, porque Firestore no puede probar la regla para TODOS
    // los resultados posibles.
    grupo: 'ventanilla_radicados', caso: 'FUNCIONARIO: list SIN filtro de tenant es rechazado (query insegura)', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => getDocs(collection(db, 'ventanilla_radicados')),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'FUNCIONARIO: list CON filtro where(oficinaDestino==propio tenant) permitido', actor: 'funcionario-a', esperado: 'permitido',
    ejecutar: (db) => getDocs(query(collection(db, 'ventanilla_radicados'), where('clasificacion.oficinaDestino', '==', TENANT_A))),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'RECEPCIONISTA: list SIN filtro permitido (rol cross-tenant)', actor: 'recepcionista-a', esperado: 'permitido',
    ejecutar: (db) => getDocs(collection(db, 'ventanilla_radicados')),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'ADMIN crea radicado con radicadoId coincidente', actor: 'admin-a', esperado: 'permitido',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_radicados/rad-nuevo-1'), { radicadoId: 'rad-nuevo-1', clasificacion: { oficinaDestino: TENANT_A } }),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'RECEPCIONISTA crea radicado con radicadoId coincidente', actor: 'recepcionista-a', esperado: 'permitido',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_radicados/rad-nuevo-2'), { radicadoId: 'rad-nuevo-2', clasificacion: { oficinaDestino: TENANT_A } }),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'FUNCIONARIO no puede crear radicados', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_radicados/rad-nuevo-3'), { radicadoId: 'rad-nuevo-3', clasificacion: { oficinaDestino: TENANT_A } }),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'ADMIN no puede crear con radicadoId no coincidente con el path', actor: 'admin-a', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_radicados/rad-nuevo-4'), { radicadoId: 'otro-id', clasificacion: { oficinaDestino: TENANT_A } }),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'update siempre denegado en cliente (mutación server-side)', actor: 'admin-a', esperado: 'denegado',
    ejecutar: (db) => updateDoc(doc(db, 'ventanilla_radicados/rad-a-1'), { estadoActual: 'RESUELTO' }),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'delete siempre denegado', actor: 'admin-a', esperado: 'denegado',
    ejecutar: (db) => deleteDoc(doc(db, 'ventanilla_radicados/rad-a-1')),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'usuario autenticado SIN perfil (users/{uid} inexistente) no lee nada', actor: 'sin-perfil', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_radicados/rad-a-1')),
  },
  {
    grupo: 'ventanilla_radicados', caso: 'anónimo (sin sesión) no lee nada', actor: 'anonimo', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_radicados/rad-a-1')),
  },

  // ══ ventanilla_radicados/{id}/trazabilidad ═══════════════════════════════
  {
    grupo: 'trazabilidad', caso: 'FUNCIONARIO lee trazabilidad de su propio tenant', actor: 'funcionario-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_radicados/rad-a-1/trazabilidad/evt-1')),
  },
  {
    grupo: 'trazabilidad', caso: 'FUNCIONARIO NO lee trazabilidad de otro tenant', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_radicados/rad-b-1/trazabilidad/evt-1')),
  },
  {
    grupo: 'trazabilidad', caso: 'JEFE_DEPENDENCIA lee trazabilidad de su propio tenant', actor: 'jefe-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_radicados/rad-a-1/trazabilidad/evt-1')),
  },
  {
    grupo: 'trazabilidad', caso: 'CONTROL_INTERNO lee trazabilidad de cualquier tenant', actor: 'control-interno-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_radicados/rad-b-1/trazabilidad/evt-1')),
  },
  {
    grupo: 'trazabilidad', caso: 'FUNCIONARIO de su propio tenant puede crear entrada de trazabilidad', actor: 'funcionario-a', esperado: 'permitido',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_radicados/rad-a-1/trazabilidad/evt-nuevo-1'), { evento: 'nota' }),
  },
  {
    grupo: 'trazabilidad', caso: 'JEFE_DEPENDENCIA (solo lectura) NO puede crear trazabilidad', actor: 'jefe-a', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_radicados/rad-a-1/trazabilidad/evt-nuevo-2'), { evento: 'nota' }),
  },
  {
    // Invariante de aislamiento por tenant en la ESCRITURA de trazabilidad
    // (R8 cerrado — ADR-0008). `canWriteTrazabilidad(radicadoId, database)`
    // (firestore.rules) ahora refleja el patrón `get()` del `allow read` de la
    // misma subcolección: un Funcionario solo escribe trazabilidad sobre
    // radicados cuyo `oficinaDestino` coincide con su propio tenant. Un
    // Funcionario de OTRO tenant (funcionario-b sobre rad-a-1, de TENANT_A)
    // debe ser RECHAZADO. Control de regresión: si la regla vuelve a permitir
    // la escritura cruzada, este caso falla en CI.
    grupo: 'trazabilidad', caso: 'FUNCIONARIO de OTRO tenant NO puede crear trazabilidad cross-tenant (R8 — aislamiento por tenant en la escritura)', actor: 'funcionario-b', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_radicados/rad-a-1/trazabilidad/evt-cross-tenant'), { evento: 'nota-cruzada' }),
  },
  {
    // Ancla de la asimetría del fix R8 (ADR-0008): Admin conserva alcance
    // cross-tenant de ventanilla única también en la ESCRITURA de trazabilidad,
    // igual que en su `allow read`. admin-a (TENANT_A) escribe sobre rad-b-1
    // (oficinaDestino TENANT_B). Si un refactor restringe a Admin por tenant por
    // error, este caso lo detecta.
    grupo: 'trazabilidad', caso: 'ADMIN crea trazabilidad cross-tenant (ventanilla única, alcance conservado)', actor: 'admin-a', esperado: 'permitido',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_radicados/rad-b-1/trazabilidad/evt-admin-cross'), { evento: 'nota-admin' }),
  },
  {
    // CONTROL_INTERNO es SOLO LECTURA: no está en canWriteTrazabilidad(). Si
    // alguien lo agregara, rompería el invariante de segregación de funciones.
    grupo: 'trazabilidad', caso: 'CONTROL_INTERNO (solo lectura) NO puede crear trazabilidad', actor: 'control-interno-a', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_radicados/rad-a-1/trazabilidad/evt-ci'), { evento: 'nota-ci' }),
  },
  {
    // Usuario autenticado sin documento en users/ (hasUserProfile() == false):
    // ningún rol resuelve, la escritura debe quedar cerrada.
    grupo: 'trazabilidad', caso: 'usuario SIN perfil no puede crear trazabilidad', actor: 'sin-perfil', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_radicados/rad-a-1/trazabilidad/evt-sin-perfil'), { evento: 'nota' }),
  },
  {
    grupo: 'trazabilidad', caso: 'update de trazabilidad siempre denegado', actor: 'admin-a', esperado: 'denegado',
    ejecutar: (db) => updateDoc(doc(db, 'ventanilla_radicados/rad-a-1/trazabilidad/evt-1'), { evento: 'editado' }),
  },

  // ══ ventanilla_salidas — aislamiento por dependenciaOrigen ═══════════════
  {
    grupo: 'ventanilla_salidas', caso: 'FUNCIONARIO lee salida de su propia dependencia', actor: 'funcionario-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_salidas/sal-a-1')),
  },
  {
    grupo: 'ventanilla_salidas', caso: 'FUNCIONARIO NO lee salida de otra dependencia', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_salidas/sal-b-1')),
  },
  {
    grupo: 'ventanilla_salidas', caso: 'JEFE_DEPENDENCIA NO lee salida de otra dependencia', actor: 'jefe-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_salidas/sal-b-1')),
  },
  {
    grupo: 'ventanilla_salidas', caso: 'RECEPCIONISTA lee cualquier salida (libro completo)', actor: 'recepcionista-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_salidas/sal-b-1')),
  },
  {
    grupo: 'ventanilla_salidas', caso: 'FUNCIONARIO: list SIN filtro de dependencia rechazado', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => getDocs(collection(db, 'ventanilla_salidas')),
  },
  {
    grupo: 'ventanilla_salidas', caso: 'FUNCIONARIO: list CON filtro where(dependenciaOrigen==propia) permitido', actor: 'funcionario-a', esperado: 'permitido',
    ejecutar: (db) => getDocs(query(collection(db, 'ventanilla_salidas'), where('dependenciaOrigen', '==', TENANT_A))),
  },
  {
    grupo: 'ventanilla_salidas', caso: 'RECEPCIONISTA crea salida con salidaId coincidente', actor: 'recepcionista-a', esperado: 'permitido',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_salidas/sal-nueva-1'), { salidaId: 'sal-nueva-1', dependenciaOrigen: TENANT_A }),
  },
  {
    grupo: 'ventanilla_salidas', caso: 'FUNCIONARIO no puede registrar salidas', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_salidas/sal-nueva-2'), { salidaId: 'sal-nueva-2', dependenciaOrigen: TENANT_A }),
  },
  {
    grupo: 'ventanilla_salidas', caso: 'update del libro de salidas siempre denegado (inmutable)', actor: 'admin-a', esperado: 'denegado',
    ejecutar: (db) => updateDoc(doc(db, 'ventanilla_salidas/sal-a-1'), { dependenciaOrigen: TENANT_B }),
  },

  // ══ control_interno_hallazgos — aislamiento por tenantId ═════════════════
  {
    grupo: 'control_interno_hallazgos', caso: 'JEFE_DEPENDENCIA lee hallazgo de su propio tenant', actor: 'jefe-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'control_interno_hallazgos/h-a-1')),
  },
  {
    grupo: 'control_interno_hallazgos', caso: 'JEFE_DEPENDENCIA NO lee hallazgo de otro tenant', actor: 'jefe-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'control_interno_hallazgos/h-b-1')),
  },
  {
    grupo: 'control_interno_hallazgos', caso: 'FUNCIONARIO no tiene acceso (solo JEFE/ADMIN/CONTROL_INTERNO)', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'control_interno_hallazgos/h-a-1')),
  },
  {
    grupo: 'control_interno_hallazgos', caso: 'CONTROL_INTERNO lee hallazgo de cualquier tenant', actor: 'control-interno-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'control_interno_hallazgos/h-b-1')),
  },
  {
    // Caso explícitamente señalado por el comentario ADVERTENCIA en
    // firestore.rules (líneas 219-224) como riesgo si el cliente algún día
    // consulta esta colección como JEFE_DEPENDENCIA sin filtrar.
    grupo: 'control_interno_hallazgos', caso: 'JEFE_DEPENDENCIA: list SIN filtro de tenant rechazado', actor: 'jefe-a', esperado: 'denegado',
    ejecutar: (db) => getDocs(collection(db, 'control_interno_hallazgos')),
  },
  {
    grupo: 'control_interno_hallazgos', caso: 'JEFE_DEPENDENCIA: list CON filtro where(tenantId==propio) permitido', actor: 'jefe-a', esperado: 'permitido',
    ejecutar: (db) => getDocs(query(collection(db, 'control_interno_hallazgos'), where('tenantId', '==', TENANT_A))),
  },
  {
    grupo: 'control_interno_hallazgos', caso: 'create siempre denegado (server-side)', actor: 'admin-a', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'control_interno_hallazgos/h-nuevo-1'), { tenantId: TENANT_A }),
  },

  // ══ control_interno_planes_mejora — incluye FUNCIONARIO además de JEFE ═══
  {
    grupo: 'control_interno_planes_mejora', caso: 'FUNCIONARIO lee plan de su propio tenant', actor: 'funcionario-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'control_interno_planes_mejora/p-a-1')),
  },
  {
    grupo: 'control_interno_planes_mejora', caso: 'FUNCIONARIO NO lee plan de otro tenant', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'control_interno_planes_mejora/p-b-1')),
  },
  {
    grupo: 'control_interno_planes_mejora', caso: 'JEFE_DEPENDENCIA lee plan de su propio tenant', actor: 'jefe-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'control_interno_planes_mejora/p-a-1')),
  },

  // ══ control_interno_alertas / control_interno_eventos — solo ADMIN/CI ════
  {
    grupo: 'control_interno_alertas', caso: 'CONTROL_INTERNO lee alertas', actor: 'control-interno-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'control_interno_alertas/al-1')),
  },
  {
    grupo: 'control_interno_alertas', caso: 'JEFE_DEPENDENCIA NO lee alertas (no tiene rol habilitado aquí)', actor: 'jefe-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'control_interno_alertas/al-1')),
  },
  {
    grupo: 'control_interno_eventos', caso: 'FUNCIONARIO NO lee eventos de control interno', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'control_interno_eventos/ev-1')),
  },

  // ══ ai_logs / ai_feedback / ai_auditoria — solo-rol, sin tenant ══════════
  {
    grupo: 'ai_logs', caso: 'ADMIN lee ai_logs', actor: 'admin-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'ai_logs/log-1')),
  },
  {
    grupo: 'ai_logs', caso: 'FUNCIONARIO NO lee ai_logs (solo ADMIN, no isInternalUser)', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'ai_logs/log-1')),
  },
  {
    grupo: 'ai_logs', caso: 'write siempre denegado, incluso ADMIN', actor: 'admin-a', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'ai_logs/log-nuevo'), { modelo: 'x' }),
  },
  {
    grupo: 'ai_feedback', caso: 'JEFE_DEPENDENCIA lee ai_feedback (isInternalUser)', actor: 'jefe-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'ai_feedback/fb-1')),
  },
  {
    grupo: 'ai_auditoria', caso: 'anónimo NO lee ai_auditoria', actor: 'anonimo', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'ai_auditoria/au-1')),
  },

  // ══ admin_auditoria / simi_auditoria — solo ADMIN, append-only ═══════════
  {
    grupo: 'admin_auditoria', caso: 'RECEPCIONISTA NO lee admin_auditoria (solo ADMIN)', actor: 'recepcionista-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'admin_auditoria/adm-1')),
  },
  {
    grupo: 'simi_auditoria', caso: 'ADMIN lee simi_auditoria', actor: 'admin-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'simi_auditoria/simi-1')),
  },

  // ══ counters — consecutivo transaccional ═════════════════════════════════
  {
    grupo: 'counters', caso: 'ADMIN lee counters', actor: 'admin-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'counters/2026')),
  },
  {
    grupo: 'counters', caso: 'FUNCIONARIO no puede escribir counters', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'counters/2026'), { valor: 2 }),
  },
  {
    grupo: 'counters', caso: 'RECEPCIONISTA puede escribir counters', actor: 'recepcionista-a', esperado: 'permitido',
    ejecutar: (db) => setDoc(doc(db, 'counters/2026'), { valor: 2 }),
  },

  // ══ ventanilla_planillas ══════════════════════════════════════════════════
  {
    grupo: 'ventanilla_planillas', caso: 'CONTROL_INTERNO lee planillas', actor: 'control-interno-a', esperado: 'permitido',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_planillas/pl-1')),
  },
  {
    grupo: 'ventanilla_planillas', caso: 'FUNCIONARIO NO lee planillas', actor: 'funcionario-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'ventanilla_planillas/pl-1')),
  },
  {
    grupo: 'ventanilla_planillas', caso: 'create siempre denegado, incluso ADMIN (transaccional server-side)', actor: 'admin-a', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'ventanilla_planillas/pl-nueva'), { estado: 'abierta' }),
  },

  // ══ catch-all — colección no declarada ════════════════════════════════════
  {
    grupo: 'catch-all', caso: 'ADMIN no lee una colección no declarada en las reglas', actor: 'admin-a', esperado: 'denegado',
    ejecutar: (db) => getDoc(doc(db, 'coleccion_inexistente/doc-1')),
  },
  {
    grupo: 'catch-all', caso: 'ADMIN no escribe una colección no declarada en las reglas', actor: 'admin-a', esperado: 'denegado',
    ejecutar: (db) => setDoc(doc(db, 'coleccion_inexistente/doc-2'), { x: 1 }),
  },
];

describe('Matriz de aislamiento por tenant — firestore.rules (ADR-0007)', () => {
  for (const c of MATRIZ) {
    it(`[${c.grupo}] ${c.caso}`, async () => {
      const db = dbDe(c.actor);
      const promesa = c.ejecutar(db);
      if (c.esperado === 'permitido') {
        await assertSucceeds(promesa);
      } else {
        await assertFails(promesa);
      }
    });
  }
});
