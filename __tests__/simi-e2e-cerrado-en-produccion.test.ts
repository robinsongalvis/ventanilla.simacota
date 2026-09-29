/**
 * §6 del checklist de arranque — el banco de pruebas E2E de SIMI no debe estar
 * disponible en producción.
 *
 * POR QUÉ NO BASTA EL GUARD DE ROL: el endpoint ya exige sesión con rol
 * ADMIN/SUPER_ADMIN/DESARROLLADOR, así que un extraño no entra. Pero no escribe
 * en un entorno de juguete: crea radicados, flujos de aprobación, firmas y PDFs
 * contra la base REAL, y dispara envíos al ciudadano. Lo que se protege aquí no
 * es el acceso, es que un administrador legítimo no pueda sembrar datos de
 * ensayo sobre el expediente de un ciudadano de verdad — ni borrarlos.
 *
 * SE CIERRA POR `VERCEL_ENV`, NO POR `NODE_ENV`: `NODE_ENV` vale 'production'
 * también en los despliegues de Preview, donde el banco SÍ debe seguir vivo —
 * es justo donde se ensaya. Cerrar por `NODE_ENV` dejaría al equipo sin la
 * herramienta en el único sitio donde tiene sentido usarla.
 *
 * Se asevera el CONTRATO en el código —que el cierre existe y que va ANTES de
 * cualquier otra cosa— sin ejecutar el handler: importarlo arrastra firebase-admin
 * y media aplicación. Mismo criterio que `interno-scroll-pagina.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RUTAS = {
  crear: 'app/api/simi/test/e2e/route.ts',
  borrar: 'app/api/simi/test/e2e/[testRunId]/route.ts',
} as const;

const fuente = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8');

describe('§6 — el banco de pruebas E2E está cerrado en producción', () => {
  for (const [nombre, ruta] of Object.entries(RUTAS)) {
    describe(`${nombre} (${ruta})`, () => {
      it('devuelve 404 cuando VERCEL_ENV es production', () => {
        const src = fuente(ruta);
        expect(src).toMatch(/process\.env\.VERCEL_ENV === 'production'/);
        // 404 y no 403: a un endpoint que no debe existir en producción no se
        // le confirma la existencia.
        expect(src).toMatch(/VERCEL_ENV === 'production'\)\s*\{[\s\S]{0,160}?status:\s*404/);
      });

      it('NO se cierra por NODE_ENV — eso mataría también Preview', () => {
        /* Si alguien «endurece» esto cambiando a NODE_ENV, el banco deja de
           funcionar en Preview, que es donde se ensaya. La intención es cerrar
           SOLO la producción real. */
        const src = fuente(ruta);
        expect(src).not.toMatch(/process\.env\.NODE_ENV === 'production'/);
      });

      it('el cierre va ANTES del guard de sesión — si no, produccion seguiría trabajando', () => {
        /* El orden es la mitad del arreglo: un gate colocado después del guard
           de sesión dejaría que la petición se procese, consulte y decida en
           producción antes de rechazarla. */
        const src = fuente(ruta);
        const posGate = src.indexOf("VERCEL_ENV === 'production'");
        const posSesion = src.search(/await verificar(Sesion|Admin)\(\)/);
        expect(posGate, 'no se encontró el cierre por entorno').toBeGreaterThan(-1);
        expect(posSesion, 'no se encontró el guard de sesión').toBeGreaterThan(-1);
        expect(posGate, 'el cierre debe ir antes del guard de sesión').toBeLessThan(posSesion);
      });
    });
  }
});
