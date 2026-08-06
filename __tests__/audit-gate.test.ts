/* ══════════════════════════════════════════════════════════════
   GATE DE AUDITORÍA GOBERNADO (ADR-0028) — pruebas de los 4 invariantes de
   seguridad.

   Prueba la función pura `evaluarAuditGate(auditJson, allowlist, hoy)` con JSON
   de `npm audit --json` MOCKEADO (nunca toca la red ni el filesystem) y con
   `hoy` fijo. Cubre los 5 escenarios exigidos:
     (a) advisory high nueva NO allowlistada → falla.
     (b) misma advisory allowlistada y VIGENTE → pasa.
     (c) entrada de allowlist VENCIDA → falla.
     (d) árbol sin advisories → pasa.
     (e) advisory high sobre un paquete con OTRA advisory allowlistada → falla
         (cobertura por advisory-id EXACTO, no por paquete).
   Más hardening: entrada mal formada, caducidad > 90 días, fail-closed.
══════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluarAuditGate,
  entradaCubreAdvisory,
  entradaVencida,
  validarEntrada,
  validarFormaReporte,
  resolverHoy,
  enContextoDeTest,
  esFechaISO,
  diasEntre,
  extraerAdvisoriesAltas,
} from '@/scripts/ci/audit-gate.mjs';

const HOY = '2026-08-05';

/** Construye una salida mínima de `npm audit --json` (formato v2) con una
 *  advisory por su GHSA-id, paquete y severidad. */
function auditConAdvisory({
  ghsa,
  paquete = 'transitiva-x',
  severidad = 'high',
  source = 1000001,
  titulo = 'Vulnerabilidad de ejemplo',
}: {
  ghsa: string;
  paquete?: string;
  severidad?: 'high' | 'critical' | 'moderate' | 'low';
  source?: number;
  titulo?: string;
}) {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      [paquete]: {
        name: paquete,
        severity: severidad,
        isDirect: false,
        via: [
          {
            source,
            name: paquete,
            title: titulo,
            url: `https://github.com/advisories/${ghsa}`,
            severity: severidad,
            range: '<1.2.3',
          },
        ],
        effects: [],
        range: '<1.2.3',
        nodes: [`node_modules/${paquete}`],
        fixAvailable: false,
      },
    },
    metadata: {
      vulnerabilities: {
        info: 0,
        low: severidad === 'low' ? 1 : 0,
        moderate: severidad === 'moderate' ? 1 : 0,
        high: severidad === 'high' ? 1 : 0,
        critical: severidad === 'critical' ? 1 : 0,
        total: 1,
      },
    },
  };
}

const AUDIT_LIMPIO = {
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
  },
};

/** Entrada de allowlist bien formada y vigente para `ghsa`. */
function entradaVigente(ghsa: string, paquete = 'transitiva-x') {
  return {
    advisory: ghsa,
    paquete,
    justificacion: 'Sin fix upstream para la versión fijada; bump mayor rompe API.',
    alcanzabilidad: 'No alcanzable: la ruta vulnerable no se ejercita desde el código del proyecto.',
    fechaAlta: '2026-08-01',
    caducidad: '2026-10-01', // 61 días desde el alta (< 90), vigente respecto a HOY
    responsable: 'seguridad — Test',
  };
}

describe('evaluarAuditGate — 4 invariantes de seguridad (ADR-0028)', () => {
  it('(a) advisory high NUEVA no allowlistada → FALLA (exit 1)', () => {
    const audit = auditConAdvisory({ ghsa: 'GHSA-aaaa-bbbb-cccc' });
    const r = evaluarAuditGate(audit, { exceptions: [] }, HOY);
    expect(r.ok).toBe(false);
    expect(r.exitCode).toBe(1);
    expect(r.bloqueantes).toHaveLength(1);
    expect(r.bloqueantes[0].ids).toContain('GHSA-AAAA-BBBB-CCCC');
  });

  it('(b) misma advisory allowlistada y VIGENTE → PASA (exit 0)', () => {
    const audit = auditConAdvisory({ ghsa: 'GHSA-aaaa-bbbb-cccc' });
    const allowlist = { exceptions: [entradaVigente('GHSA-aaaa-bbbb-cccc')] };
    const r = evaluarAuditGate(audit, allowlist, HOY);
    expect(r.ok).toBe(true);
    expect(r.exitCode).toBe(0);
    expect(r.bloqueantes).toHaveLength(0);
    expect(r.cubiertas).toHaveLength(1);
  });

  it('(c) entrada de allowlist VENCIDA → FALLA (exit 1), aun con árbol limpio', () => {
    const vencida = { ...entradaVigente('GHSA-dddd-eeee-ffff'), fechaAlta: '2026-05-01', caducidad: '2026-07-01' };
    const r = evaluarAuditGate(AUDIT_LIMPIO, { exceptions: [vencida] }, HOY);
    expect(r.ok).toBe(false);
    expect(r.exitCode).toBe(1);
    expect(r.entradasVencidas).toHaveLength(1);
  });

  it('(d) árbol sin advisories + allowlist vacía → PASA (exit 0)', () => {
    const r = evaluarAuditGate(AUDIT_LIMPIO, { exceptions: [] }, HOY);
    expect(r.ok).toBe(true);
    expect(r.exitCode).toBe(0);
    expect(r.bloqueantes).toHaveLength(0);
    expect(r.cubiertas).toHaveLength(0);
  });

  it('(e) advisory high sobre un paquete con OTRA advisory allowlistada → FALLA (cobertura por id exacto)', () => {
    // El árbol trae GHSA-NEW; la allowlist cubre GHSA-OLD sobre el MISMO paquete.
    const audit = auditConAdvisory({ ghsa: 'GHSA-nnnn-nnnn-nnnn', paquete: 'libx', source: 2000002 });
    const allowlist = { exceptions: [entradaVigente('GHSA-oooo-oooo-oooo', 'libx')] };
    const r = evaluarAuditGate(audit, allowlist, HOY);
    expect(r.ok).toBe(false);
    expect(r.exitCode).toBe(1);
    expect(r.bloqueantes).toHaveLength(1);
    expect(r.bloqueantes[0].ids).toContain('GHSA-NNNN-NNNN-NNNN');
    expect(r.cubiertas).toHaveLength(0);
  });
});

describe('evaluarAuditGate — hardening del requisito 3 (esquema y caducidad)', () => {
  it('critical no allowlistada también bloquea', () => {
    const audit = auditConAdvisory({ ghsa: 'GHSA-cccc-cccc-cccc', severidad: 'critical' });
    const r = evaluarAuditGate(audit, { exceptions: [] }, HOY);
    expect(r.exitCode).toBe(1);
    expect(r.bloqueantes[0].severidad).toBe('critical');
  });

  it('advisory moderate NO bloquea (el gate es high/critical)', () => {
    const audit = auditConAdvisory({ ghsa: 'GHSA-mmmm-mmmm-mmmm', severidad: 'moderate' });
    const r = evaluarAuditGate(audit, { exceptions: [] }, HOY);
    expect(r.exitCode).toBe(0);
    expect(r.bloqueantes).toHaveLength(0);
  });

  it('entrada MAL FORMADA (falta responsable/justificación) → FALLA aunque cubriría el id', () => {
    const audit = auditConAdvisory({ ghsa: 'GHSA-aaaa-bbbb-cccc' });
    const rota = { advisory: 'GHSA-aaaa-bbbb-cccc', paquete: 'transitiva-x', fechaAlta: '2026-08-01', caducidad: '2026-10-01' };
    const r = evaluarAuditGate(audit, { exceptions: [rota] }, HOY);
    expect(r.ok).toBe(false);
    expect(r.entradasInvalidas).toHaveLength(1);
    // La advisory no quedó cubierta por una entrada inválida → sigue bloqueando.
    expect(r.bloqueantes).toHaveLength(1);
  });

  it('caducidad a más de 90 días del alta → entrada inválida → FALLA', () => {
    const audit = auditConAdvisory({ ghsa: 'GHSA-aaaa-bbbb-cccc' });
    const larga = { ...entradaVigente('GHSA-aaaa-bbbb-cccc'), fechaAlta: '2026-08-01', caducidad: '2026-12-01' }; // 122 días
    const r = evaluarAuditGate(audit, { exceptions: [larga] }, HOY);
    expect(r.ok).toBe(false);
    expect(r.entradasInvalidas).toHaveLength(1);
  });

  it('fail-closed (extracción total): metadata reporta high pero no hay advisory extraíble → bloquea', () => {
    // Forma de reporte VÁLIDA (auditReportVersion + metadata), pero el único nodo
    // high tiene `via` como referencia string a un nodo inexistente: 0 advisories
    // extraídas con metadata.high=1 → Guard A de extracción.
    const raro = {
      auditReportVersion: 2,
      vulnerabilities: {
        pkg: { name: 'pkg', severity: 'high', via: ['otra-cosa'], effects: [], range: '*', nodes: [], fixAvailable: false },
      },
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } },
    };
    const r = evaluarAuditGate(raro, { exceptions: [] }, HOY);
    expect(r.ok).toBe(false);
    expect(r.exitCode).toBe(1);
    expect(r.formaInvalida).toHaveLength(0); // la forma es válida; lo que falla es la extracción
    expect(r.failClosed.length).toBeGreaterThan(0);
  });
});

describe('FAIL-CLOSED de FORMA — el JSON de error de npm NO es "árbol limpio" (bloqueante corregido)', () => {
  // npm devuelve JSON PARSEABLE pero de ERROR cuando el registro está caído, no
  // hay lockfile, etc. Antes se confundía con árbol limpio (EXIT 0). Debe BLOQUEAR.
  const CASOS_ERROR: Array<[string, unknown]> = [
    ['{"error":{"code":"ENOLOCK"}}', { error: { code: 'ENOLOCK', summary: 'This command requires an existing lockfile.' } }],
    ['{"message":"...failed...","error":{}}', { message: 'npm audit failed', error: {} }],
    ['{} vacío', {}],
    ['metadata ausente', { auditReportVersion: 2, vulnerabilities: {} }],
    ['metadata.vulnerabilities ausente', { auditReportVersion: 2, vulnerabilities: {}, metadata: {} }],
    ['metadata.vulnerabilities.high no numérico', { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { high: '0', critical: 0, total: 0 } } }],
    ['auditReportVersion ausente', { vulnerabilities: {}, metadata: { vulnerabilities: { high: 0, critical: 0, total: 0 } } }],
    ['no es objeto (null)', null],
    ['no es objeto (array)', []],
  ];

  for (const [nombre, json] of CASOS_ERROR) {
    it(`${nombre} → FALLA-CERRADO (ok=false, exit 1, formaInvalida no vacía)`, () => {
      const r = evaluarAuditGate(json, { exceptions: [] }, HOY);
      expect(r.ok).toBe(false);
      expect(r.exitCode).toBe(1);
      expect(r.formaInvalida.length).toBeGreaterThan(0);
      // NUNCA imprime "Árbol limpio" ante un JSON de error.
      expect(r.resumen).not.toContain('Árbol limpio');
      expect(r.resumen).toContain('FAIL-CLOSED');
    });
  }

  it('validarFormaReporte: un reporte v2 completo y sano NO da motivos', () => {
    const sano = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } };
    expect(validarFormaReporte(sano)).toHaveLength(0);
  });

  it('validarFormaReporte: {"error":{...}} y {"message":...} devuelven motivos', () => {
    expect(validarFormaReporte({ error: { code: 'ENOLOCK' } }).length).toBeGreaterThan(0);
    expect(validarFormaReporte({ message: 'failed' }).length).toBeGreaterThan(0);
  });
});

describe('FAIL-CLOSED de EXTRACCIÓN PARCIAL (Guards B y C)', () => {
  it('Guard C: metadata reporta MÁS high/critical que nodos en el árbol → bloquea', () => {
    // metadata dice high=3, pero solo hay 1 nodo high en `vulnerabilities`:
    // el árbol está incompleto (extracción parcial) → fail-closed.
    const json = {
      auditReportVersion: 2,
      vulnerabilities: {
        libx: {
          name: 'libx', severity: 'high',
          via: [{ source: 1, name: 'libx', title: 't', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: 'high', range: '*' }],
          effects: [], range: '*', nodes: [], fixAvailable: false,
        },
      },
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 3, critical: 0, total: 3 } },
    };
    const { advisories, nodosAltosSinId } = extraerAdvisoriesAltas(json);
    expect(advisories.length).toBe(1); // extrajo algo (no era 0: Guard A no aplica)
    expect(nodosAltosSinId.length).toBeGreaterThan(0); // Guard C sí
    const r = evaluarAuditGate(json, { exceptions: [] }, HOY);
    // Además queda 1 bloqueante (la advisory extraída no está allowlistada).
    expect(r.ok).toBe(false);
    expect(r.exitCode).toBe(1);
    expect(r.failClosed.length).toBeGreaterThan(0);
  });

  it('Guard B: nodo high con via-OBJETO ilegible (severidad ausente) → bloquea aunque metadata cuadre', () => {
    // El nodo es high y trae un via-OBJETO, pero sin severidad reconocible: no se
    // extrae advisory de él. metadata.high=1 y hay 1 nodo high (Guard C no aplica),
    // pero la advisory se perdió → Guard B.
    const json = {
      auditReportVersion: 2,
      vulnerabilities: {
        libz: {
          name: 'libz', severity: 'high',
          via: [{ source: 9, name: 'libz', title: 'algo', url: 'https://example/GHSA-zzzz-zzzz-zzzz' /* SIN severity */ }],
          effects: [], range: '*', nodes: [], fixAvailable: false,
        },
      },
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } },
    };
    const { advisories, nodosAltosSinId } = extraerAdvisoriesAltas(json);
    expect(advisories.length).toBe(0);
    expect(nodosAltosSinId.some((m) => m.includes("'libz'"))).toBe(true); // Guard B nombró el nodo
    const r = evaluarAuditGate(json, { exceptions: [] }, HOY);
    expect(r.ok).toBe(false);
    expect(r.exitCode).toBe(1);
  });
});

describe('funciones puras auxiliares', () => {
  it('entradaCubreAdvisory: match por id exacto, case-insensitive', () => {
    const advisory = { ids: ['GHSA-AAAA-BBBB-CCCC', '1000001'], paquete: 'x', severidad: 'high', titulo: '', url: '' };
    expect(entradaCubreAdvisory({ advisory: 'ghsa-aaaa-bbbb-cccc' }, advisory)).toBe(true);
    expect(entradaCubreAdvisory({ advisory: '1000001' }, advisory)).toBe(true);
    expect(entradaCubreAdvisory({ advisory: 'GHSA-zzzz-zzzz-zzzz' }, advisory)).toBe(false);
    expect(entradaCubreAdvisory({ advisory: '' }, advisory)).toBe(false);
  });

  it('entradaVencida: caducidad < hoy es vencida; == hoy sigue vigente', () => {
    expect(entradaVencida({ caducidad: '2026-08-04' }, HOY)).toBe(true);
    expect(entradaVencida({ caducidad: '2026-08-05' }, HOY)).toBe(false);
    expect(entradaVencida({ caducidad: '2026-08-06' }, HOY)).toBe(false);
  });

  it('validarEntrada: entrada completa y coherente no da errores', () => {
    expect(validarEntrada(entradaVigente('GHSA-aaaa-bbbb-cccc'))).toHaveLength(0);
  });

  it('esFechaISO / diasEntre', () => {
    expect(esFechaISO('2026-08-05')).toBe(true);
    expect(esFechaISO('2026-13-01')).toBe(false);
    expect(esFechaISO('05-08-2026')).toBe(false);
    expect(diasEntre('2026-08-01', '2026-10-01')).toBe(61);
  });

  it('resolverHoy: en contexto de test honra AUDIT_GATE_TODAY válida; lanza si es inválida', () => {
    // El override SOLO se honra en contexto de test (VITEST/NODE_ENV==='test').
    expect(resolverHoy({ VITEST: 'true', AUDIT_GATE_TODAY: '2026-01-02' })).toBe('2026-01-02');
    expect(resolverHoy({ NODE_ENV: 'test', AUDIT_GATE_TODAY: '2026-01-02' })).toBe('2026-01-02');
    expect(() => resolverHoy({ VITEST: 'true', AUDIT_GATE_TODAY: 'ayer' })).toThrow();
    const sinEnv = resolverHoy({ VITEST: 'true' });
    expect(esFechaISO(sinEnv)).toBe(true);
  });

  it('resolverHoy: FUERA de contexto de test IGNORA AUDIT_GATE_TODAY (sin time-travel)', () => {
    // Sin VITEST ni NODE_ENV==='test': el override se ignora y se usa el reloj
    // del sistema, aunque AUDIT_GATE_TODAY traiga una fecha (válida o no).
    const hoyReal = new Date().toISOString().slice(0, 10);
    expect(resolverHoy({ AUDIT_GATE_TODAY: '2000-01-01' })).toBe(hoyReal);
    expect(resolverHoy({ NODE_ENV: 'production', AUDIT_GATE_TODAY: '2999-12-31' })).toBe(hoyReal);
    // Ni siquiera una fecha MAL formada lanza fuera de test: se ignora sin más.
    expect(() => resolverHoy({ AUDIT_GATE_TODAY: 'ayer' })).not.toThrow();
    expect(resolverHoy({ AUDIT_GATE_TODAY: 'ayer' })).toBe(hoyReal);
  });

  it('enContextoDeTest: solo VITEST no vacío o NODE_ENV==="test"', () => {
    expect(enContextoDeTest({ VITEST: 'true' })).toBe(true);
    expect(enContextoDeTest({ NODE_ENV: 'test' })).toBe(true);
    expect(enContextoDeTest({ VITEST: '' })).toBe(false);
    expect(enContextoDeTest({ NODE_ENV: 'production' })).toBe(false);
    expect(enContextoDeTest({})).toBe(false);
  });

  it('extraerAdvisoriesAltas: dedup por id y filtra por severidad', () => {
    const audit = auditConAdvisory({ ghsa: 'GHSA-aaaa-bbbb-cccc' });
    const { advisories } = extraerAdvisoriesAltas(audit);
    expect(advisories).toHaveLength(1);
    expect(advisories[0].severidad).toBe('high');
  });
});

/* ══════════════════════════════════════════════════════════════
   VERIFICACIÓN A NIVEL DE PROCESO — corre el WRAPPER real
   (`node scripts/ci/audit-gate.mjs`) con `npm audit --json` MOCKEADO por un
   shim en el PATH. Confirma EXIT CODES reales (no solo campos del núcleo):
   ejercita spawnSync('npm',…) + JSON.parse + validarFormaReporte + process.exit.

   Es la prueba dura del bloqueante: ante un JSON de ERROR de npm el proceso
   entero DEBE salir con código 1 (fail-closed), no 0.
══════════════════════════════════════════════════════════════ */
describe('PROCESO — el wrapper real (spawn) falla-cerrado ante JSON de error (EXIT 1 verificado)', () => {
  const GATE = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts/ci/audit-gate.mjs');
  let binDir = '';
  let workBase = '';

  const AUDIT_LIMPIO_PROC = {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
  };

  beforeAll(() => {
    binDir = mkdtempSync(join(tmpdir(), 'audit-gate-bin-'));
    workBase = mkdtempSync(join(tmpdir(), 'audit-gate-work-'));
    // Shim POSIX de `npm`: vuelca el JSON de FAKE_NPM_STDOUT_FILE a stdout y sale
    // con FAKE_NPM_EXIT. El gate ignora el exit code de npm y parsea stdout, así
    // que reproduce fielmente "npm salió ≠0 pero imprimió JSON".
    const shimPath = join(binDir, 'npm');
    writeFileSync(shimPath, '#!/bin/sh\ncat "$FAKE_NPM_STDOUT_FILE"\nexit "${FAKE_NPM_EXIT:-0}"\n');
    chmodSync(shimPath, 0o755);
  });

  afterAll(() => {
    if (binDir) rmSync(binDir, { recursive: true, force: true });
    if (workBase) rmSync(workBase, { recursive: true, force: true });
  });

  /** Corre el gate REAL en un subproceso con `npm audit --json` mockeado. */
  function correrGate(
    auditJson: unknown,
    opts: { npmExit?: number; allowlist?: unknown; env?: Record<string, string | undefined> } = {},
  ): { status: number | null; stdout: string; stderr: string } {
    const work = mkdtempSync(join(workBase, 'run-'));
    const jsonFile = join(work, 'audit.json');
    writeFileSync(jsonFile, JSON.stringify(auditJson));
    if (opts.allowlist !== undefined) {
      writeFileSync(join(work, 'audit-allowlist.json'), JSON.stringify(opts.allowlist));
    }
    // El hijo corre como CI por defecto: se PODA el contexto de test (VITEST /
    // NODE_ENV=test) para que AUDIT_GATE_TODAY se ignore salvo que el caso lo
    // reponga explícitamente vía opts.env.
    const env: Record<string, string | undefined> = { ...process.env };
    delete env.VITEST;
    delete env.VITEST_WORKER_ID;
    delete env.VITEST_POOL_ID;
    env.NODE_ENV = 'production';
    env.PATH = `${binDir}:${process.env.PATH ?? ''}`;
    env.FAKE_NPM_STDOUT_FILE = jsonFile;
    env.FAKE_NPM_EXIT = String(opts.npmExit ?? 0);
    if (opts.env) Object.assign(env, opts.env);

    const res = spawnSync(process.execPath, [GATE], { cwd: work, env: env as NodeJS.ProcessEnv, encoding: 'utf8' });
    return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
  }

  it('árbol limpio → EXIT 0', () => {
    const r = correrGate(AUDIT_LIMPIO_PROC, { npmExit: 0 });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Árbol limpio');
  });

  it('advisory high nueva (sin allowlist) → EXIT 1', () => {
    const audit = auditConAdvisory({ ghsa: 'GHSA-aaaa-bbbb-cccc' });
    const r = correrGate(audit, { npmExit: 1 });
    expect(r.status).toBe(1);
  });

  it('JSON error-shaped {"error":{"code":"ENOLOCK"}} → EXIT 1 (fail-closed, NO "Árbol limpio")', () => {
    const r = correrGate({ error: { code: 'ENOLOCK', summary: 'requires an existing lockfile' } }, { npmExit: 1 });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).not.toContain('Árbol limpio');
    expect(r.stdout + r.stderr).toContain('FAIL-CLOSED');
  });

  it('JSON message-failed {"message":"...failed...","error":{}} → EXIT 1', () => {
    const r = correrGate({ message: 'npm audit failed (EAI_AGAIN)', error: {} }, { npmExit: 1 });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).not.toContain('Árbol limpio');
  });

  it('{} vacío → EXIT 1', () => {
    const r = correrGate({}, { npmExit: 0 });
    expect(r.status).toBe(1);
  });

  it('metadata ausente → EXIT 1', () => {
    const r = correrGate({ auditReportVersion: 2, vulnerabilities: {} }, { npmExit: 0 });
    expect(r.status).toBe(1);
  });

  it('AUDIT_GATE_TODAY se IGNORA en el proceso (como CI): entrada vencida bajo reloj real → EXIT 1', () => {
    // La entrada caducó en 2020 (vencida bajo el reloj real). Inyectamos
    // AUDIT_GATE_TODAY=2000-01-01 que la "reviviría" — pero el proceso NO está en
    // contexto de test, así que debe IGNORARLO y seguir usando el reloj real.
    const entrada = {
      advisory: 'GHSA-oldx-oldx-oldx',
      paquete: 'vieja',
      justificacion: 'sin fix (histórica)',
      alcanzabilidad: 'no alcanzable',
      fechaAlta: '2020-01-01',
      caducidad: '2020-03-01',
      responsable: 'seguridad',
    };
    const r = correrGate(AUDIT_LIMPIO_PROC, {
      npmExit: 0,
      allowlist: { exceptions: [entrada] },
      env: { AUDIT_GATE_TODAY: '2000-01-01' },
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('VENCIDA');
  });
});
