import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * LA PANTALLA NO PUEDE DECIR DOS COSAS OPUESTAS SOBRE EL MISMO PLAZO.
 *
 * El propietario lo fotografió el 29-ago-2026: arriba, «PLAZO LEGAL — Aún no ha
 * empezado a correr»; treinta píxeles más abajo, «Vence el 27/10/2026 · corre
 * desde el 24/08/2026 · día 4 de 45». Sobre el mismo expediente, a la vez.
 *
 * LA CAUSA ERA UNA SOLA Y YA CONOCIDA: la cabecera preguntaba por
 * `expediente.fechaRadicacionDebidaForma`, campo OPCIONAL que solo escribe el
 * acto de radicar (#248), mientras el resto de la pantalla resuelve el ancla
 * con la actuación de respaldo. Es el MISMO defecto que dejó invisible la
 * tarjeta, sobreviviendo en un segundo sitio — que es el modo habitual en que
 * estos fallos se esconden: se arregla el que se ve y queda el gemelo.
 *
 * Y aquí no es un detalle estético. La frase «Aún no ha empezado a correr» es
 * literal del ADR-0034 y está puesta para que la funcionaria SE LA LEA AL
 * CIUDADANO tal cual. Afirmarla sobre un expediente cuyo plazo lleva cuatro
 * días corriendo es decirle al ciudadano algo que no es cierto.
 *
 * ── ALCANCE (ADR-0033 §4.6-bis) ──────────────────────────────────────────
 * QUÉ MIRA: que la cabecera, la tarjeta del término y el camino del trámite
 * reciban el ancla de la MISMA expresión, y que nadie vuelva a leer el campo
 * persistido a pelo en esta pantalla.
 * QUÉ NO MIRA: si el ancla resuelta es la jurídicamente correcta —eso lo
 * decide el servidor (`evaluarRadicacionEnDebidaForma`)— ni el resto de
 * pantallas del módulo.
 */

const RUTA = 'app/interno/licencias/[expedienteId]/DetalleLicenciaClient.tsx';

/** La prosa de este repositorio NOMBRA lo que documenta: grepear el archivo
 *  entero confundiría la explicación con el código. */
function soloCodigo(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const DETALLE = soloCodigo(readFileSync(RUTA, 'utf8'));

describe('una sola resolución del ancla para toda la pantalla', () => {
  it('existe y prefiere el campo persistido, con la actuación de respaldo', () => {
    expect(DETALLE).toMatch(
      /const anclaDelTermino\s*=\s*expediente\?\.fechaRadicacionDebidaForma\s*\?\?\s*fechaRadicacion/,
    );
  });

  it('la cabecera la usa —no el campo persistido a pelo—', () => {
    expect(DETALLE).toMatch(/desdeCuandoCorreElPlazo=\{anclaDelTermino/);
  });

  it('la tarjeta del término la usa', () => {
    expect(DETALLE).toMatch(/desdeIso=\{anclaDelTermino\}/);
  });

  it('NADIE más lee el campo persistido suelto en esta pantalla', () => {
    /* El defecto reaparece en cuanto alguien vuelva a escribir
       `expediente.fechaRadicacionDebidaForma` en un sitio nuevo: es opcional, y
       en todo expediente anterior al acto de radicar viene vacío. La única
       lectura admitida es la que alimenta `anclaDelTermino`. */
    const lecturas = DETALLE.match(/expediente\??\.fechaRadicacionDebidaForma/g) ?? [];
    expect(lecturas, `el campo persistido se lee ${lecturas.length} veces; solo vale la de anclaDelTermino`)
      .toHaveLength(1);
  });
});
