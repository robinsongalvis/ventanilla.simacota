/**
 * scripts/laboratorio/informe-despliegue.mjs
 *
 * ORQUESTADOR + INFORME DE DESPLIEGUE — compuerta de gobernanza técnica (ADR-0013, 2D).
 *
 * NO es "un control más": AGREGA el resultado de los controles ya existentes en un
 * INFORME ÚNICO con semáforo por categoría (funcional, normativo, seguridad,
 * rendimiento, observabilidad) + un VEREDICTO GLOBAL trazable. Ningún cambio llega
 * a producción sin evidencia objetiva de que la plataforma mantiene sus garantías.
 *
 * MECANISMO (idiomático GitHub Actions, anticipado por ADR-0013 §Decisión.2):
 *   Corre en un job final `informe-despliegue` con `if: ${{ !cancelled() }}`, que
 *   `needs` a los jobs de control. Cada job de control EXPORTA el `outcome` de sus
 *   pasos como job-output; este script los LEE por variable de entorno
 *   (`OUTCOME_*`) y los mapea a categorías. Así el informe se produce COMPLETO
 *   incluso cuando un control falló (los pasos corren con `if: ${{ !cancelled() }}`),
 *   sin debilitar la compuerta: un control en rojo pone el job del informe en rojo
 *   y —con branch protection— bloquea el merge.
 *
 * NO AGREGA controles nuevos ni toca reglas, shape de datos ni los controles
 * existentes: solo consume sus resultados.
 *
 * CATEGORÍAS (ADR-0013 §Decisión.2):
 *   funcional      → lint · tsc · suite unitaria/integración · build · E2E de stage
 *   normativo      → controles ejecutables (viven dentro de la suite unitaria)
 *   seguridad      → matriz de aislamiento por tenant (rules-unit-testing) · npm audit
 *   rendimiento    → presupuesto de rendimiento (R11, ADR-0011)
 *   observabilidad → señal presente (suite de observabilidad + configs Sentry)
 *
 * SEMÁFORO por categoría = peor fuente (🔴 rojo > 🟡 amber > 🟢 verde).
 *   Una fuente sin dato NO se pinta verde (ADR-0013): cuenta como amber.
 *
 * E2E DE STAGE como INPUT REGISTRADO (ADR-0013 §Decisión, viñeta E2E):
 *   No corre en CI. El coordinador registra su última corrida en
 *   `docs/auditorias/e2e-ultimo.json` ({ sha, fecha, resultado }). El informe:
 *     - resultado 'rojo'                         → 🔴
 *     - 'verde' y sha == SHA candidato           → 🟢
 *     - 'verde' pero sha != candidato / ausente  → 🟡 (no hay corrida reciente)
 *   Nunca inventa un verde si no hay dato contra el SHA candidato.
 *
 * VEREDICTO GLOBAL:
 *   🔴 ROJO   = bloqueado (alguna categoría en rojo)     → exit 1 (bloquea merge)
 *   🟡 AMBER  = desplegable solo con aceptación explícita → exit 0 (no bloquea merge;
 *               el disparo de deploy es humano — ver AGENTS.md / regla operativa)
 *   🟢 VERDE  = desplegable                               → exit 0
 *
 * SALIDA (trazable): imprime el semáforo; escribe `informe-despliegue.json` y
 *   `informe-despliegue.md` en INFORME_DIR (por defecto el cwd; en CI se suben como
 *   artefacto); y, si existe `GITHUB_STEP_SUMMARY`, anexa el informe al resumen de
 *   la corrida.
 *
 * Uso:
 *   # CI: los OUTCOME_* llegan por env desde los job-outputs.
 *   node scripts/laboratorio/informe-despliegue.mjs
 *
 *   # Local: ejecuta de verdad los controles deterministas que SÍ corren aquí
 *   # (lint, tsc, presupuesto, npm audit) y captura su exit real; los que dependen
 *   # de CI (suite completa, emulador con Java) quedan como 🟡 "se evalúa en CI".
 *   node scripts/laboratorio/informe-despliegue.mjs --local
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(process.cwd());
const MODO_LOCAL = process.argv.includes('--local');
const INFORME_DIR = resolve(process.env.INFORME_DIR || RAIZ);
const RUTA_E2E = resolve(process.env.E2E_INPUT || join(RAIZ, 'docs/auditorias/e2e-ultimo.json'));
const CONFIGS_SENTRY = ['sentry.client.config.ts', 'sentry.edge.config.ts', 'sentry.server.config.ts'];

const VERDE = 'verde';
const AMBER = 'amber';
const ROJO = 'rojo';
const PESO = { [VERDE]: 0, [AMBER]: 1, [ROJO]: 2 };
const EMOJI = { [VERDE]: '🟢', [AMBER]: '🟡', [ROJO]: '🔴' };

/** Normaliza un `outcome` de GitHub Actions a nuestro semáforo. */
function desdeOutcome(valor) {
  if (valor === 'success') return VERDE;
  if (valor === 'failure') return ROJO;
  // skipped | cancelled | vacío → no hay señal utilizable.
  return AMBER;
}

/** Ejecuta un control local y devuelve su semáforo por exit code (0 → verde). */
function ejecutarLocal(comando) {
  const r = spawnSync(comando, { cwd: RAIZ, shell: true, encoding: 'utf8' });
  return r.status === 0 ? VERDE : ROJO;
}

/**
 * Fuente de una categoría. `env` = nombre de la var con el outcome de CI.
 * `comandoLocal` = cómo obtener su resultado real en --local (si aplica).
 * `evidencia` = puntero trazable a QUÉ lo respalda.
 */
function resolverFuente(fuente) {
  // 1) Fuente estructural (presencia de artefactos, p. ej. configs Sentry).
  if (fuente.tipo === 'estructural') {
    const faltan = fuente.archivos.filter((a) => !existsSync(join(RAIZ, a)));
    return {
      ...fuente,
      estado: faltan.length ? ROJO : VERDE,
      detalle: faltan.length ? `faltan: ${faltan.join(', ')}` : `presentes: ${fuente.archivos.length}`,
    };
  }

  // 2) Fuente E2E de stage (input registrado).
  if (fuente.tipo === 'e2e') return resolverE2E(fuente);

  // 3) Fuente de control: outcome por env (CI) o ejecución real (--local).
  const outcomeEnv = process.env[fuente.env];
  if (outcomeEnv) {
    return { ...fuente, estado: desdeOutcome(outcomeEnv), detalle: `outcome CI: ${outcomeEnv}` };
  }
  if (MODO_LOCAL && fuente.comandoLocal) {
    const estado = ejecutarLocal(fuente.comandoLocal);
    return { ...fuente, estado, detalle: `ejecución local: ${fuente.comandoLocal} → ${estado}` };
  }
  return { ...fuente, estado: AMBER, detalle: 'sin señal (se evalúa en CI)' };
}

function resolverE2E(fuente) {
  if (!existsSync(RUTA_E2E)) {
    return { ...fuente, estado: AMBER, detalle: `sin registro de E2E (${relativa(RUTA_E2E)} ausente)` };
  }
  let reg;
  try {
    reg = JSON.parse(readFileSync(RUTA_E2E, 'utf8'));
  } catch (e) {
    return { ...fuente, estado: ROJO, detalle: `registro E2E ilegible: ${e.message}` };
  }
  const shaCandidato = shaActual();
  if (reg.resultado === 'rojo') {
    return { ...fuente, estado: ROJO, detalle: `E2E en rojo (sha ${corto(reg.sha)}, ${reg.fecha})` };
  }
  if (reg.resultado === 'verde' && reg.sha && shaCandidato && reg.sha === shaCandidato) {
    return { ...fuente, estado: VERDE, detalle: `E2E verde contra el SHA candidato (${reg.fecha})` };
  }
  if (reg.resultado === 'verde') {
    return {
      ...fuente,
      estado: AMBER,
      detalle: `E2E verde pero contra ${corto(reg.sha)}, no el candidato ${corto(shaCandidato)} — sin corrida reciente`,
    };
  }
  return { ...fuente, estado: AMBER, detalle: `resultado E2E desconocido: ${JSON.stringify(reg.resultado)}` };
}

/** Categorías del informe (ADR-0013 §Decisión.2). */
const CATEGORIAS = [
  {
    id: 'funcional',
    titulo: 'Funcional',
    fuentes: [
      { clave: 'lint', desc: 'ESLint', env: 'OUTCOME_LINT', comandoLocal: 'npm run lint', evidencia: 'job validate · paso Lint' },
      { clave: 'tsc', desc: 'TypeScript (tsc --noEmit)', env: 'OUTCOME_TSC', comandoLocal: 'npx tsc --noEmit', evidencia: 'job validate · paso TypeScript' },
      { clave: 'test', desc: 'Suite unitaria/integración (vitest)', env: 'OUTCOME_TEST', comandoLocal: null, evidencia: 'job validate · paso Test Suite (__tests__/*.test.ts[x])' },
      { clave: 'build', desc: 'Production build (next build)', env: 'OUTCOME_BUILD', comandoLocal: null, evidencia: 'job validate · paso Build' },
      { tipo: 'e2e', clave: 'e2e', desc: 'E2E Playwright de stage (15 flujos)', evidencia: relativaEstatica('docs/auditorias/e2e-ultimo.json') },
    ],
  },
  {
    id: 'normativo',
    titulo: 'Normativo',
    fuentes: [
      {
        clave: 'test',
        desc: 'Controles normativos ejecutables (dentro de la suite)',
        env: 'OUTCOME_TEST',
        comandoLocal: null,
        evidencia: '__tests__/{normograma-nucleo,pqrsd-validacion,pqrsd-verbal,prorroga-validacion,consulta-publica-*,serie-documental,numero-radicado}.test.ts',
      },
    ],
  },
  {
    id: 'seguridad',
    titulo: 'Seguridad',
    fuentes: [
      { clave: 'matriz', desc: 'Matriz de aislamiento por tenant (rules-unit-testing, ADR-0007)', env: 'OUTCOME_MATRIZ', comandoLocal: null, evidencia: 'job laboratorio-emulador · e2e/rules/matriz-aislamiento-tenant.test.mjs' },
      { clave: 'audit', desc: 'npm audit (--audit-level=high)', env: 'OUTCOME_AUDIT', comandoLocal: 'npm audit --audit-level=high', evidencia: 'job validate · paso Security Scan' },
    ],
  },
  {
    id: 'rendimiento',
    titulo: 'Rendimiento',
    fuentes: [
      { clave: 'presupuesto', desc: 'Presupuesto de rendimiento R11 (ADR-0011)', env: 'OUTCOME_PRESUPUESTO', comandoLocal: 'npm run presupuesto:rendimiento', evidencia: 'job validate · paso Presupuesto · scripts/laboratorio/presupuesto-rendimiento.mjs' },
    ],
  },
  {
    id: 'observabilidad',
    titulo: 'Observabilidad',
    fuentes: [
      { clave: 'test', desc: 'Suite de observabilidad (dentro de la suite)', env: 'OUTCOME_TEST', comandoLocal: null, evidencia: '__tests__/{observabilidad-lectura,sanitizar-observabilidad,eventos-negocio}.test.ts' },
      { tipo: 'estructural', clave: 'sentry', desc: 'Configuración de observabilidad presente (Sentry)', archivos: CONFIGS_SENTRY, evidencia: CONFIGS_SENTRY.join(', ') },
    ],
  },
];

// ───────────────────────── helpers de presentación ─────────────────────────

let _sha = null;
function shaActual() {
  if (_sha !== null) return _sha;
  if (process.env.GITHUB_SHA) return (_sha = process.env.GITHUB_SHA);
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: RAIZ, encoding: 'utf8' });
  return (_sha = r.status === 0 ? r.stdout.trim() : '');
}
function corto(sha) {
  return sha ? String(sha).slice(0, 7) : '(desconocido)';
}
function relativa(ruta) {
  return ruta.startsWith(RAIZ) ? ruta.slice(RAIZ.length + 1) : ruta;
}
function relativaEstatica(r) {
  return r;
}
function peorDe(estados) {
  return estados.reduce((peor, e) => (PESO[e] > PESO[peor] ? e : peor), VERDE);
}

// ─────────────────────────────── agregación ───────────────────────────────

const categoriasEval = CATEGORIAS.map((cat) => {
  const fuentes = cat.fuentes.map(resolverFuente);
  const estado = peorDe(fuentes.map((f) => f.estado));
  return { id: cat.id, titulo: cat.titulo, estado, fuentes };
});

const veredicto = peorDe(categoriasEval.map((c) => c.estado));
const sha = shaActual();
const fecha = new Date().toISOString();
const ejecucion = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : (MODO_LOCAL ? 'ejecución local (--local)' : 'ejecución local');

const informe = {
  adr: 'ADR-0013',
  frente: '2D',
  sha,
  shaCorto: corto(sha),
  fecha,
  ejecucion,
  veredicto,
  desplegable: veredicto === VERDE,
  requiereAceptacion: veredicto === AMBER,
  bloqueado: veredicto === ROJO,
  categorias: categoriasEval,
};

// ─────────────────────────────── artefactos ───────────────────────────────

const VEREDICTO_TEXTO = {
  [VERDE]: 'VERDE — desplegable',
  [AMBER]: 'AMBER — desplegable solo con aceptación explícita del propietario',
  [ROJO]: 'ROJO — bloqueado',
};

function markdown() {
  const l = [];
  l.push('# Informe de despliegue — Compuerta de gobernanza (ADR-0013, 2D)');
  l.push('');
  l.push(`- **Veredicto global:** ${EMOJI[veredicto]} **${VEREDICTO_TEXTO[veredicto]}**`);
  l.push(`- **SHA candidato:** \`${corto(sha)}\``);
  l.push(`- **Fecha:** ${fecha}`);
  l.push(`- **Corrida:** ${ejecucion}`);
  l.push('');
  l.push('| Categoría | Semáforo | Detalle por fuente |');
  l.push('|---|:---:|---|');
  for (const c of categoriasEval) {
    const det = c.fuentes
      .map((f) => `${EMOJI[f.estado]} ${f.desc} — ${f.detalle}`)
      .join('<br>');
    l.push(`| **${c.titulo}** | ${EMOJI[c.estado]} | ${det} |`);
  }
  l.push('');
  l.push('### Evidencia por fuente');
  for (const c of categoriasEval) {
    l.push(`- **${c.titulo}** ${EMOJI[c.estado]}`);
    for (const f of c.fuentes) l.push(`  - ${EMOJI[f.estado]} ${f.desc} · evidencia: \`${f.evidencia}\``);
  }
  l.push('');
  if (veredicto === AMBER) {
    l.push('> **AMBER:** hay categorías sin señal fresca (típicamente el E2E de stage no corrió contra este SHA). ');
    l.push('> El despliegue exige aceptación explícita del propietario registrada. La compuerta NO bloquea el merge.');
  } else if (veredicto === ROJO) {
    l.push('> **ROJO:** al menos un control está en rojo. La compuerta bloquea el despliegue; con branch protection, bloquea el merge.');
  } else {
    l.push('> **VERDE:** todos los controles en verde y E2E fresco contra el SHA candidato. Desplegable (el disparo sigue siendo humano — regla operativa vigente).');
  }
  l.push('');
  return l.join('\n');
}

mkdirSync(INFORME_DIR, { recursive: true });
const rutaJson = join(INFORME_DIR, 'informe-despliegue.json');
const rutaMd = join(INFORME_DIR, 'informe-despliegue.md');
const md = markdown();
writeFileSync(rutaJson, JSON.stringify(informe, null, 2) + '\n');
writeFileSync(rutaMd, md + '\n');

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
}

// ─────────────────────────────── consola ───────────────────────────────

console.log('\n════════════ INFORME DE DESPLIEGUE — Compuerta de gobernanza (ADR-0013, 2D) ════════════');
console.log(`SHA candidato: ${corto(sha)} · ${fecha}`);
console.log(`Corrida: ${ejecucion}\n`);
for (const c of categoriasEval) {
  console.log(`  ${EMOJI[c.estado]} ${c.titulo.toUpperCase()}`);
  for (const f of c.fuentes) console.log(`      ${EMOJI[f.estado]} ${f.desc} — ${f.detalle}`);
}
console.log(`\n  ${EMOJI[veredicto]} VEREDICTO GLOBAL: ${VEREDICTO_TEXTO[veredicto]}`);
console.log(`\n  Artefactos: ${relativa(rutaJson)} · ${relativa(rutaMd)}`);

if (veredicto === ROJO) {
  console.log('\n⛔ Compuerta ROJA: despliegue bloqueado. (Con branch protection, el merge queda bloqueado.)');
  process.exit(1);
}
if (veredicto === AMBER) {
  console.log('\n⚠ Compuerta AMBER: desplegable solo con aceptación explícita del propietario. El merge NO se bloquea.');
  process.exit(0);
}
console.log('\n✔ Compuerta VERDE: la plataforma mantiene sus garantías. Desplegable (disparo humano).');
process.exit(0);
