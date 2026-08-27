import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { inventarioDesdeReglas } from '@/scripts/backups/inventario-desde-reglas.mjs';

/**
 * EL VERIFICADOR DEL ENSAYO DE RESTAURACIÓN COMPROBABA TRES COLECCIONES DE
 * VEINTE, Y `users` NO ESTABA ENTRE ELLAS.
 *
 * Sin `users`, `requireActiveInternalUser()` rechaza a todo el mundo: la
 * plataforma restaurada no se puede ni abrir. Y el ensayo firmaba
 * «✔ RESTAURACIÓN VÁLIDA». Un respaldo que compra confianza falsa es peor que
 * no tener ensayo.
 *
 * El inventario se deriva ahora de `firestore.rules`, que es el único que el
 * sistema se ve OBLIGADO a mantener al día: una colección sin regla no se puede
 * leer. Estas pruebas custodian esa derivación.
 */
const REGLAS = readFileSync('firestore.rules', 'utf8');
const VERIFICADOR = readFileSync('scripts/backups/verificar-restauracion.mjs', 'utf8');

describe('el inventario sale de las reglas, no de una lista a mano', () => {
  it('encuentra las colecciones raíz que las reglas declaran', () => {
    const { raiz } = inventarioDesdeReglas();
    for (const esperada of ['users', 'ventanilla_radicados', 'counters', 'expedientes', 'ventanilla_salidas']) {
      expect(raiz, `falta ${esperada}`).toContain(esperada);
    }
    expect(raiz.length).toBeGreaterThan(15);
  });

  /* La que motivó todo: si `users` volviera a caerse del inventario, la
     plataforma restaurada sería inservible y el ensayo no lo diría. */
  it('`users` está, y el verificador exige que traiga datos', () => {
    expect(inventarioDesdeReglas().raiz).toContain('users');
    expect(VERIFICADOR).toMatch(/users:\s*'Sin usuarios nadie puede autenticarse/);
  });

  it('no confunde la sintaxis con el dominio', () => {
    const { raiz } = inventarioDesdeReglas();
    expect(raiz).not.toContain('databases');
    expect(raiz).not.toContain('documents');
    expect(raiz.some((c) => c.includes('{'))).toBe(false);
  });

  it('cada colección de las reglas aparece en el inventario', () => {
    const enReglas = [...REGLAS.matchAll(/^\s{4}match\s+\/([a-zA-Z_]+)\/\{/gm)].map((m) => m[1]);
    const { raiz } = inventarioDesdeReglas();
    for (const c of new Set(enReglas)) {
      expect(raiz, `las reglas declaran '${c}' y el inventario no lo trae`).toContain(c);
    }
  });
});

describe('las subcolecciones también se cuentan', () => {
  it('encuentra las anidadas, incluida la de segundo nivel', () => {
    const rutas = inventarioDesdeReglas().subcolecciones.map((s) => s.ruta);
    expect(rutas).toContain('ventanilla_radicados/trazabilidad');
    expect(rutas).toContain('expedientes/actuaciones');
    expect(rutas).toContain('expedientes/documentos');
    expect(rutas).toContain('expedientes/documentos/versiones');
  });

  it('cada subcolección sabe cuál es su padre', () => {
    const versiones = inventarioDesdeReglas().subcolecciones.find((s) => s.nombre === 'versiones');
    expect(versiones?.padre).toBe('documentos');
  });

  /* `.count()` sobre la raíz no ve las subcolecciones: los expedientes podían
     restaurarse enteros y sus actuaciones perderse, con los conteos en verde. */
  it('el verificador las cuenta con collectionGroup', () => {
    expect(VERIFICADOR).toMatch(/collectionGroup\(sub\.nombre\)/);
  });
});

describe('ninguna colección queda sin decidir', () => {
  it('el verificador clasifica TODAS las del inventario', () => {
    const { raiz } = inventarioDesdeReglas();
    const conDatos = [...VERIFICADOR.matchAll(/^  ([a-z_]+): '/gm)].map((m) => m[1]);
    const sinClasificar = raiz.filter((c) => !conDatos.includes(c));
    expect(
      sinClasificar,
      `Sin clasificar: ${sinClasificar.join(', ')}. Deben declararse como «traen datos» o «pueden estar vacías», con su razón.`,
    ).toEqual([]);
  });

  it('y si apareciera una nueva, el propio ensayo lo diría', () => {
    expect(VERIFICADOR).toMatch(/sin clasificar en el alcance del verificador/);
  });
});
