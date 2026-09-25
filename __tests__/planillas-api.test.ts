import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

/* ══════════════════════════════════════════════════════════════
   Planilla de reparto — blindaje estático de reglas y rutas
   (mismo patrón del test H-10): ancla en el texto las decisiones
   de seguridad para que un refactor no las afloje sin ruido.
══════════════════════════════════════════════════════════════ */

const firestoreRules = readFileSync('firestore.rules', 'utf8');
const storageRules = readFileSync('storage.rules', 'utf8');
const generarRoute = readFileSync('app/api/planillas/generar/route.ts', 'utf8');
const entregasRoute = readFileSync('app/api/planillas/entregas/route.ts', 'utf8');
const anularRoute = readFileSync('app/api/planillas/anular/route.ts', 'utf8');
const listarRoute = readFileSync('app/api/planillas/route.ts', 'utf8');

function bloqueEntre(texto: string, inicio: string, fin: string): string {
  const desde = texto.indexOf(inicio);
  const hasta = texto.indexOf(fin, desde + inicio.length);
  expect(desde).toBeGreaterThanOrEqual(0);
  expect(hasta).toBeGreaterThan(desde);
  return texto.slice(desde, hasta);
}

describe('reglas Firestore de ventanilla_planillas', () => {
  const bloque = bloqueEntre(
    firestoreRules,
    'match /ventanilla_planillas/{planillaId}',
    '}',
  );

  it('leen solo quienes operan o auditan el reparto', () => {
    expect(bloque).toContain('isAdmin() || isRecepcionista() || isControlInterno()');
    expect(bloque).not.toContain('isFuncionario()');
    expect(bloque).not.toContain('isInternalUser()');
  });

  it('toda escritura cliente está bloqueada', () => {
    expect(bloque).toContain('allow create, update, delete: if false;');
  });
});

describe('reglas Storage del escaneo firmado', () => {
  it('la ruta planillas/ queda cerrada a clientes', () => {
    const bloque = bloqueEntre(
      storageRules,
      'match /planillas/{planillaId}/{archivo}',
      '}',
    );
    expect(bloque).toContain('allow read, write: if false;');
  });
});

describe('gates de rol en las rutas', () => {
  it('generar, entregas y anular son solo de Recepción/Admin', () => {
    for (const source of [generarRoute, entregasRoute, anularRoute]) {
      expect(source).toContain("usuario.rol !== 'ADMIN' && usuario.rol !== 'RECEPCIONISTA'");
      expect(source).toContain('requireActiveInternalUser');
      expect(source).toContain('status: 403');
    }
  });

  it('la lectura incluye a Control Interno pero no a Funcionario/Jefe', () => {
    expect(listarRoute).toContain("['ADMIN', 'RECEPCIONISTA', 'CONTROL_INTERNO']");
    expect(listarRoute).not.toContain('FUNCIONARIO');
    expect(listarRoute).not.toContain('JEFE_DEPENDENCIA');
  });
});

describe('evidencia de la entrega', () => {
  it('cada fila entregada escribe entregaFisica y evento de trazabilidad', () => {
    expect(entregasRoute).toContain('entregaFisica');
    expect(entregasRoute).toContain("accion: 'ENTREGA_FISICA_REGISTRADA'");
    expect(entregasRoute).toContain('trazabilidad');
  });

  it('el escaneo entra únicamente por el helper Admin endurecido', () => {
    expect(entregasRoute).toContain('uploadEscaneoPlanillaAdmin');
    const helper = readFileSync('lib/server/planillas-security.ts', 'utf8');
    expect(helper).toContain('verificarMagicBytes');
    expect(helper).toContain("'application/pdf'");
  });

  it('el consecutivo nace transaccional con contador anual propio', () => {
    expect(generarRoute).toContain('counters/planillas-');
    expect(generarRoute).toContain('runTransaction');
  });
});
