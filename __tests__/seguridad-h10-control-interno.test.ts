import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const rules = readFileSync('firestore.rules', 'utf8');
const hallazgosRoute = readFileSync('app/api/interno/control/hallazgos/route.ts', 'utf8');
const planesRoute = readFileSync('app/api/interno/control/planes-mejora/route.ts', 'utf8');
const planDetalleRoute = readFileSync('app/api/interno/control/planes-mejora/[id]/route.ts', 'utf8');

function bloqueEntre(inicio: string, fin: string): string {
  const desde = rules.indexOf(inicio);
  const hasta = rules.indexOf(fin, desde + inicio.length);
  expect(desde).toBeGreaterThanOrEqual(0);
  expect(hasta).toBeGreaterThan(desde);
  return rules.slice(desde, hasta);
}

describe('H-10 — aislamiento de hallazgos y planes por dependencia', () => {
  const hallazgos = bloqueEntre(
    'match /control_interno_hallazgos/{hallazgoId}',
    'match /control_interno_planes_mejora/{planId}',
  );
  const planes = bloqueEntre(
    'match /control_interno_planes_mejora/{planId}',
    'match /control_interno_alertas/{alertaId}',
  );

  it('ADMIN y CONTROL_INTERNO conservan lectura global', () => {
    expect(hallazgos).toContain('isAdmin() || isControlInterno()');
    expect(planes).toContain('isAdmin() || isControlInterno()');
  });

  it('JEFE_DEPENDENCIA solo lee hallazgos de su tenant', () => {
    expect(hallazgos).toContain(
      'isJefeDependencia() && resource.data.tenantId == userTenant()',
    );
    expect(hallazgos).not.toContain('isControlInterno() || isJefeDependencia();');
  });

  it('JEFE_DEPENDENCIA solo lee planes de su tenant', () => {
    expect(planes).toContain('(isJefeDependencia() || isFuncionario())');
    expect(planes).toContain('&& resource.data.tenantId == userTenant()');
    expect(planes).not.toContain('isControlInterno() || isJefeDependencia()');
  });

  it('FUNCIONARIO conserva únicamente lectura de planes de su tenant', () => {
    expect(hallazgos).not.toContain('isFuncionario()');
    expect(planes).toContain('(isJefeDependencia() || isFuncionario())');
  });

  it('roles desconocidos y usuarios sin perfil no obtienen una regla permisiva', () => {
    expect(hallazgos).not.toContain('isInternalUser()');
    expect(planes).not.toContain('isInternalUser()');
    expect(rules).toContain('return hasUserProfile() ? userProfile().tenantId : null;');
  });

  it('las escrituras cliente continúan bloqueadas', () => {
    expect(hallazgos).toContain('allow create, update, delete: if false;');
    expect(planes).toContain('allow create, update, delete: if false;');
  });

  it('las APIs de listado fuerzan el tenant del Jefe', () => {
    for (const source of [hallazgosRoute, planesRoute]) {
      expect(source).toContain("auth.data.acceso === 'JEFE_DEPENDENCIA'");
      expect(source).toContain('? auth.data.user.tenantId');
    }
  });

  it('la API de detalle bloquea planes de otra dependencia', () => {
    expect(planDetalleRoute).toContain(
      "auth.data.acceso === 'JEFE_DEPENDENCIA' && plan.tenantId !== auth.data.user.tenantId",
    );
    expect(planDetalleRoute).toContain("{ error: 'Sin permiso sobre este plan.' }");
  });
});
