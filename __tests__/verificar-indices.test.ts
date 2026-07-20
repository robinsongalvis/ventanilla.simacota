import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  encontrarBloques,
  extraerCampos,
  existeIndiceCompuesto,
  construirIndicePorColeccion,
  analizarArchivo,
  REGISTRO_EXCEPCIONES,
} from '@/scripts/laboratorio/verificar-indices.mjs';

/* A3 — gate estático de índices Firestore (lección del incidente del
   Reparto: where()+orderBy() sin índice compuesto declarado rompió una
   pantalla en producción con FAILED_PRECONDITION). Prueba el ANALIZADOR
   puro (sin tocar el filesystem real ni firestore.indexes.json). */

function indices(entradas: Array<{ collectionGroup: string; fields: Array<{ fieldPath: string; order?: string }> }>) {
  return construirIndicePorColeccion({ indexes: entradas });
}

describe('existeIndiceCompuesto', () => {
  it('true si un índice empieza por campoWhere y contiene campoOrderBy', () => {
    const idx = indices([{ collectionGroup: 'x', fields: [{ fieldPath: 'a' }, { fieldPath: 'b' }] }]);
    expect(existeIndiceCompuesto(idx, 'x', 'a', 'b')).toBe(true);
  });

  it('false si la colección no tiene ningún índice declarado', () => {
    expect(existeIndiceCompuesto(indices([]), 'x', 'a', 'b')).toBe(false);
  });

  it('false si el índice no EMPIEZA por campoWhere (aunque lo contenga en otra posición)', () => {
    const idx = indices([{ collectionGroup: 'x', fields: [{ fieldPath: 'z' }, { fieldPath: 'a' }, { fieldPath: 'b' }] }]);
    expect(existeIndiceCompuesto(idx, 'x', 'a', 'b')).toBe(false);
  });

  it('false si el índice empieza por campoWhere pero NO contiene campoOrderBy', () => {
    const idx = indices([{ collectionGroup: 'x', fields: [{ fieldPath: 'a' }, { fieldPath: 'c' }] }]);
    expect(existeIndiceCompuesto(idx, 'x', 'a', 'b')).toBe(false);
  });

  it('true si hay VARIOS índices para la colección y uno de ellos cumple', () => {
    const idx = indices([
      { collectionGroup: 'x', fields: [{ fieldPath: 'z' }, { fieldPath: 'w' }] },
      { collectionGroup: 'x', fields: [{ fieldPath: 'a' }, { fieldPath: 'b' }] },
    ]);
    expect(existeIndiceCompuesto(idx, 'x', 'a', 'b')).toBe(true);
  });
});

describe('extraerCampos', () => {
  it('extrae campos literales de .where(...)', () => {
    const r = extraerCampos(`.where('campoA', '==', 1).where('campoB', '==', 2)`, /\.where\(\s*['"]([^'"]+)['"]/g, /\.where\(\s*(?!['"])/g);
    expect(r.literales).toEqual(['campoA', 'campoB']);
    expect(r.hayDinamico).toBe(false);
  });

  it('detecta un campo dinámico (variable en vez de literal)', () => {
    const r = extraerCampos(`.where(campoVariable, '==', 1)`, /\.where\(\s*['"]([^'"]+)['"]/g, /\.where\(\s*(?!['"])/g);
    expect(r.literales).toEqual([]);
    expect(r.hayDinamico).toBe(true);
  });
});

describe('encontrarBloques — where+orderBy en la misma sentencia', () => {
  it('captura colección literal, where y orderBy de una cadena en una sola sentencia', () => {
    const contenido = `
      const q = db.collection('ventanilla_radicados')
        .where('control.origen', '==', 'FISICO_ESCANER')
        .orderBy('control.fechaRadicado', 'desc')
        .limit(500);
    `;
    const bloques = encontrarBloques(contenido);
    expect(bloques).toHaveLength(1);
    expect(bloques[0]!.coleccion).toBe('ventanilla_radicados');
    expect(bloques[0]!.texto).toContain('.where(');
    expect(bloques[0]!.texto).toContain('.orderBy(');
  });

  it('con colección dinámica, marca coleccion=null y guarda el nombre de la variable', () => {
    const contenido = `const q = db.collection(coleccion).where('a', '==', 1).orderBy('b');`;
    const bloques = encontrarBloques(contenido);
    expect(bloques[0]!.coleccion).toBeNull();
    expect(bloques[0]!.coleccionDinamica).toBe('coleccion');
  });

  it('dos anclas de .collection() no se mezclan: cada bloque para en la siguiente ancla', () => {
    const contenido = `
      const a = db.collection('col_a')
        .where('x', '==', 1)
        .orderBy('y', 'desc');

      const b = db.collection('col_b')
        .where('m', '==', 1)
        .orderBy('n', 'desc');
    `;
    const bloques = encontrarBloques(contenido);
    expect(bloques).toHaveLength(2);
    expect(bloques[0]!.texto).not.toContain('col_b');
    expect(bloques[1]!.texto).not.toContain('col_a');
  });
});

describe('analizarArchivo — where+orderBy de campo distinto', () => {
  const contenidoBase = `
    const q = db.collection('coleccion_x')
      .where('campoA', '==', 1)
      .orderBy('campoB', 'desc');
  `;

  it('sin índice compuesto declarado → VIOLACIÓN', () => {
    const r = analizarArchivo(contenidoBase, 'archivo.ts', indices([]), []);
    expect(r.violaciones).toHaveLength(1);
    expect(r.violaciones[0]).toContain('campoA');
    expect(r.violaciones[0]).toContain('campoB');
    expect(r.violaciones[0]).toContain("colección 'coleccion_x'");
    expect(r.advertencias).toHaveLength(0);
    expect(r.deudaDeclarada).toHaveLength(0);
  });

  it('con índice compuesto declarado (empieza por A, contiene B) → OK, sin hallazgos', () => {
    const idx = indices([{ collectionGroup: 'coleccion_x', fields: [{ fieldPath: 'campoA' }, { fieldPath: 'campoB' }] }]);
    const r = analizarArchivo(contenidoBase, 'archivo.ts', idx, []);
    expect(r.violaciones).toHaveLength(0);
    expect(r.advertencias).toHaveLength(0);
    expect(r.deudaDeclarada).toHaveLength(0);
  });

  it('mismo campo en where y orderBy → no requiere compuesto, sin hallazgos', () => {
    const contenido = `
      const q = db.collection('coleccion_x')
        .where('campoA', '>=', 1)
        .orderBy('campoA', 'desc');
    `;
    const r = analizarArchivo(contenido, 'archivo.ts', indices([]), []);
    expect(r.violaciones).toHaveLength(0);
    expect(r.advertencias).toHaveLength(0);
  });

  it('solo where sin orderBy (o solo orderBy sin where) → no aplica, sin hallazgos', () => {
    const soloWhere = `db.collection('coleccion_x').where('campoA', '==', 1).limit(10);`;
    const soloOrderBy = `db.collection('coleccion_x').orderBy('campoB', 'desc').limit(10);`;
    expect(analizarArchivo(soloWhere, 'archivo.ts', indices([]), []).violaciones).toHaveLength(0);
    expect(analizarArchivo(soloOrderBy, 'archivo.ts', indices([]), []).violaciones).toHaveLength(0);
  });

  it('colección dinámica → ADVERTENCIA, nunca violación', () => {
    const contenido = `
      const q = db.collection(coleccionVariable)
        .where('campoA', '==', 1)
        .orderBy('campoB', 'desc');
    `;
    const r = analizarArchivo(contenido, 'archivo.ts', indices([]), []);
    expect(r.violaciones).toHaveLength(0);
    expect(r.advertencias).toHaveLength(1);
    expect(r.advertencias[0]).toContain('COLECCIÓN DINÁMICA');
    expect(r.advertencias[0]).toContain('archivo.ts');
  });

  it('campo de where dinámico → ADVERTENCIA, nunca violación', () => {
    const contenido = `
      const q = db.collection('coleccion_x')
        .where(campoVariable, '==', 1)
        .orderBy('campoB', 'desc');
    `;
    const r = analizarArchivo(contenido, 'archivo.ts', indices([]), []);
    expect(r.violaciones).toHaveLength(0);
    expect(r.advertencias).toHaveLength(1);
    expect(r.advertencias[0]).toContain('CAMPO DINÁMICO');
  });

  it('campo de orderBy dinámico → ADVERTENCIA, nunca violación', () => {
    const contenido = `
      const q = db.collection('coleccion_x')
        .where('campoA', '==', 1)
        .orderBy(campoVariable, 'desc');
    `;
    const r = analizarArchivo(contenido, 'archivo.ts', indices([]), []);
    expect(r.violaciones).toHaveLength(0);
    expect(r.advertencias).toHaveLength(1);
    expect(r.advertencias[0]).toContain('CAMPO DINÁMICO');
  });

  it('con excepción registrada (archivo+colección+campos exactos) → DEUDA DECLARADA, no bloquea', () => {
    const registro = [{
      archivo: 'archivo.ts', coleccion: 'coleccion_x',
      campoWhere: 'campoA', campoOrderBy: 'campoB',
      motivo: 'preexistente - revisar en Bloque 3 (fixture de prueba)',
    }];
    const r = analizarArchivo(contenidoBase, 'archivo.ts', indices([]), registro);
    expect(r.violaciones).toHaveLength(0);
    expect(r.deudaDeclarada).toHaveLength(1);
    expect(r.deudaDeclarada[0]).toContain('DEUDA DECLARADA');
    expect(r.exclusionesUsadas.size).toBe(1);
  });

  it('la excepción NO es un bypass de archivo completo: un campo distinto en el mismo archivo sigue bloqueando', () => {
    const contenido = `
      const q = db.collection('coleccion_x')
        .where('campoDistinto', '==', 1)
        .orderBy('campoB', 'desc');
    `;
    const registro = [{
      archivo: 'archivo.ts', coleccion: 'coleccion_x',
      campoWhere: 'campoA', campoOrderBy: 'campoB', // no coincide con 'campoDistinto'
      motivo: 'excepción para otro campo',
    }];
    const r = analizarArchivo(contenido, 'archivo.ts', indices([]), registro);
    expect(r.violaciones).toHaveLength(1);
    expect(r.deudaDeclarada).toHaveLength(0);
  });

  it('reasignación varias líneas después del .orderBy() base (patrón real de busqueda-avanzada) — sin índice: violación', () => {
    const contenido = `
      let queryBase = db
        .collection('ventanilla_radicados')
        .orderBy('control.fechaRadicado', 'desc');

      if (usuario.rol === 'FUNCIONARIO') {
        queryBase = queryBase.where('clasificacion.oficinaDestino', '==', usuario.tenantId);
      }
    `;
    const r = analizarArchivo(contenido, 'archivo.ts', indices([]), []);
    expect(r.violaciones).toHaveLength(1);
    expect(r.violaciones[0]).toContain('clasificacion.oficinaDestino');
    expect(r.violaciones[0]).toContain('control.fechaRadicado');
  });

  it('el mismo patrón, con el índice compuesto real declarado — sin hallazgos (caso RESUELTO)', () => {
    const contenido = `
      let queryBase = db
        .collection('ventanilla_radicados')
        .orderBy('control.fechaRadicado', 'desc');

      if (usuario.rol === 'FUNCIONARIO') {
        queryBase = queryBase.where('clasificacion.oficinaDestino', '==', usuario.tenantId);
      }
    `;
    const idx = indices([{
      collectionGroup: 'ventanilla_radicados',
      fields: [{ fieldPath: 'clasificacion.oficinaDestino' }, { fieldPath: 'control.fechaRadicado' }],
    }]);
    const r = analizarArchivo(contenido, 'archivo.ts', idx, []);
    expect(r.violaciones).toHaveLength(0);
  });
});

describe('cableado del gate — package.json y CI', () => {
  it('package.json declara el script verificar:indices', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['verificar:indices']).toBe('node scripts/laboratorio/verificar-indices.mjs');
  });

  it('ci.yml corre el gate en el job validate, después del presupuesto de rendimiento', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toContain('id: indices');
    expect(ci).toContain('run: npm run verificar:indices');

    const posPresupuesto = ci.indexOf('id: presupuesto');
    const posIndices = ci.indexOf('id: indices');
    expect(posPresupuesto).toBeGreaterThan(-1);
    expect(posIndices).toBeGreaterThan(posPresupuesto);
  });

  it('el paso corre con if: !cancelled(), igual que los demás controles del job', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    const bloque = ci.slice(ci.indexOf('id: indices') - 60, ci.indexOf('id: indices') + 120);
    expect(bloque).toContain("if: ${{ !cancelled() }}");
  });
});

describe('gate ejecutado contra el repo actual — evidencia de que corre limpio (Principio 13)', () => {
  it('el REGISTRO_EXCEPCIONES no está vacío (hay deuda preexistente declarada, no oculta)', () => {
    expect(REGISTRO_EXCEPCIONES.length).toBeGreaterThan(0);
  });

  it('toda excepción exige archivo, colección y ambos campos (no hay bypass a nivel de archivo)', () => {
    for (const ex of REGISTRO_EXCEPCIONES) {
      expect(ex.archivo).toBeTruthy();
      expect(ex.coleccion).toBeTruthy();
      expect(ex.campoWhere).toBeTruthy();
      expect(ex.campoOrderBy).toBeTruthy();
      expect(ex.motivo).toContain('preexistente');
    }
  });
});
