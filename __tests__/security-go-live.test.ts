import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(`${root}/${path}`, 'utf8');
}

/**
 * Devuelve el CUERPO de un bloque `match` de firestore.rules, de su llave de
 * apertura a la que la cierra.
 *
 * Por qué existe (barrido de dobles verdes, 30-ago-2026): las dos pruebas de
 * abajo aseveraban `expect(rules).toContain('allow update: if false;')` sobre
 * el ARCHIVO ENTERO. Esa línea existe en varios bloques a la vez, así que la
 * aserción se satisfacía con la de OTRA colección. Se abrió el bloque de
 * `ventanilla_radicados` de par en par —`allow update: if isAdmin();`— y las
 * siete pruebas del archivo siguieron en verde.
 *
 * Contar llaves basta aunque los comodines de ruta lleven las suyas
 * (`{radicadoId}`): abren y cierran en la misma línea, así que la profundidad
 * cuadra. Se arranca en el FIN de la línea del encabezado, con profundidad 1,
 * justamente para no confundir el comodín del propio encabezado con el bloque.
 */
function bloqueMatch(reglas: string, encabezado: string): string {
  const inicio = reglas.indexOf(`${encabezado} {`);
  if (inicio === -1) throw new Error(`firestore.rules no declara «${encabezado}»`);

  let profundidad = 1;
  for (let i = reglas.indexOf('\n', inicio); i < reglas.length; i++) {
    if (reglas[i] === '{') profundidad++;
    else if (reglas[i] === '}' && --profundidad === 0) return reglas.slice(inicio, i + 1);
  }
  throw new Error(`El bloque «${encabezado}» no cierra en firestore.rules`);
}

describe('cierre seguridad go-live', () => {
  it('bloquea escrituras nuevas en la colección legacy radicados', () => {
    const legacy = bloqueMatch(read('firestore.rules'), 'match /radicados/{radicadoId}');

    expect(legacy).toContain('allow create: if false;');
    expect(legacy).toContain('allow update: if false;');
  });

  it('bloquea mutaciones críticas directas en ventanilla_radicados', () => {
    const rules = read('firestore.rules');
    const coleccion = bloqueMatch(rules, 'match /ventanilla_radicados/{radicadoId}');

    // DENTRO del bloque de la colección, no en cualquier parte del archivo.
    expect(coleccion).toContain('allow update: if false;');
    // Y que sea la ÚNICA cláusula de update del bloque: una segunda, más
    // permisiva, dejaría la primera intacta y esta prueba ciega.
    expect(coleccion.match(/allow update:/g)).toHaveLength(1);
    expect(coleccion).toContain('cumplioTermino');
  });

  it('impide TODA subida directa a Storage — el bucket es Admin-SDK-only (PT-3)', () => {
    // Antes esta guarda exigía `signedIn()` en la subida directa. El PT-3
    // (24-ago-2026) la volvió más fuerte: las puertas autenticadas eran
    // puertas muertas tras el cutover y se cerraron — ninguna cláusula
    // allow del bucket admite nada que no sea `if false`.
    const rules = read('storage.rules');
    expect(rules).toContain('match /radicados/{radicadoId}/{archivo}');
    const codigo = rules.split('\n').filter((l: string) => !l.trim().startsWith('//'));
    const allows = codigo.filter((l: string) => l.includes('allow '));
    expect(allows.length).toBeGreaterThan(0);
    for (const a of allows) expect(a).toContain('if false');
  });

  it('admite anexos Office (OOXML) por tipo exacto — validado en el SERVIDOR, no en reglas (PT-3)', () => {
    // La validación de tipos vivía en storage.rules porque el cliente subía
    // directo. Con el bucket Admin-SDK-only, el único validador es el del
    // servidor (magic-bytes), que verifica CONTENIDO real, no el content
    // type declarable por el cliente — estrictamente más fuerte.
    const magic = read('lib/seguridad/magic-bytes.ts');
    expect(magic).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(magic).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(magic).toContain('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    expect(magic).not.toContain("application/*");
  });

  // ALCANCE (ADR-0033 §4.6-bis): esta prueba solo comprueba que la ruta
  // NOMBRA la revocación y su etiqueta de auditoría. NO comprueba que se
  // ejecute — eso lo hace, ejecutando el handler,
  // `seguridad-go-live-comportamiento.test.ts`.
  //
  // El nombre anterior era «revoca tokens al desactivar usuarios internos», y
  // prometía justo lo que no miraba: se borró la revocación entera de la rama
  // de desactivación y esta prueba siguió pasando, porque la cadena sobrevive
  // en un comentario y en la rama de archivado.
  it('la ruta de usuarios nombra la revocación y su etiqueta de auditoría', () => {
    const route = read('app/api/admin/usuarios/[uid]/route.ts');

    expect(route).toContain('revokeRefreshTokens');
    expect(route).toContain('USUARIO_DESACTIVADO');
  });

  it('valida usuario activo en proxy y sesión interna', () => {
    expect(read('proxy.ts')).toContain('activo !== false');
    expect(read('app/api/auth/session/route.ts')).toContain('activo === false');
    expect(read('lib/server/internal-auth.ts')).toContain('Usuario inactivo o archivado.');
  });

  it('el dashboard usa APIs server-side para acciones críticas', () => {
    const dashboard = read('app/interno/dashboard/page.tsx');

    expect(dashboard).toContain('/api/radicados/${encodeURIComponent(radicado.radicadoId)}/asignar');
    expect(dashboard).toContain('/api/radicados/${encodeURIComponent(radicado.radicadoId)}/devolver');
    expect(dashboard).toContain('/api/radicados/${encodeURIComponent(radicado.radicadoId)}/prorroga');
    expect(dashboard).toContain('/api/radicados/${encodeURIComponent(radicado.radicadoId)}/resolver');
    expect(dashboard).not.toContain('ejecutarResolucion(');
    expect(dashboard).not.toContain('despacharNotificaciones(');
  });
});
