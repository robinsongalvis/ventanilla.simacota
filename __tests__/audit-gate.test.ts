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

import { describe, it, expect } from 'vitest';
import {
  evaluarAuditGate,
  entradaCubreAdvisory,
  entradaVencida,
  validarEntrada,
  resolverHoy,
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

  it('fail-closed: metadata reporta high pero no hay advisory extraíble → bloquea', () => {
    const raro = {
      vulnerabilities: {
        pkg: { name: 'pkg', severity: 'high', via: ['otra-cosa'], effects: [], range: '*', nodes: [], fixAvailable: false },
      },
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } },
    };
    const r = evaluarAuditGate(raro, { exceptions: [] }, HOY);
    expect(r.ok).toBe(false);
    expect(r.failClosed.length).toBeGreaterThan(0);
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

  it('resolverHoy: usa AUDIT_GATE_TODAY si es válida; lanza si es inválida', () => {
    expect(resolverHoy({ AUDIT_GATE_TODAY: '2026-01-02' })).toBe('2026-01-02');
    expect(() => resolverHoy({ AUDIT_GATE_TODAY: 'ayer' })).toThrow();
    const sinEnv = resolverHoy({});
    expect(esFechaISO(sinEnv)).toBe(true);
  });

  it('extraerAdvisoriesAltas: dedup por id y filtra por severidad', () => {
    const audit = auditConAdvisory({ ghsa: 'GHSA-aaaa-bbbb-cccc' });
    const { advisories } = extraerAdvisoriesAltas(audit);
    expect(advisories).toHaveLength(1);
    expect(advisories[0].severidad).toBe('high');
  });
});
