import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * EL ACTO TIENE QUE SER ALCANZABLE DESDE EL MOSTRADOR.
 *
 * La auditoría de #234 encontró esto: `POST /api/licencias/expedientes/[id]/radicar`
 * existía —401 líneas, transaccional, idempotente, probado contra el emulador—
 * y NO TENÍA UN SOLO LLAMADOR EN LA INTERFAZ. Construido e inalcanzable.
 *
 * Una capacidad que ninguna pantalla invoca no es una capacidad: es código que
 * pasa las pruebas. Esta prueba impide que vuelva a quedarse huérfano.
 */

const RUTA_DETALLE = 'app/interno/licencias/[expedienteId]/DetalleLicenciaClient.tsx';
const RUTA_MODAL = 'app/interno/licencias/components/RadicarDebidaFormaModal.tsx';
const RUTA_API = 'app/api/licencias/expedientes/[id]/route.ts';

/** Sin comentarios: la prosa de este repositorio NOMBRA lo que documenta, y
 *  grepear el archivo entero confunde la explicación con el código. */
function soloCodigo(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const DETALLE = soloCodigo(readFileSync(RUTA_DETALLE, 'utf8'));
const MODAL = soloCodigo(readFileSync(RUTA_MODAL, 'utf8'));
const API = soloCodigo(readFileSync(RUTA_API, 'utf8'));

describe('la cadena completa, del botón al endpoint', () => {
  it('la ruta del detalle DEVUELVE la vista previa', () => {
    expect(API, 'sin `debidaForma` en la respuesta la pantalla no sabe si procede').toMatch(/debidaForma/);
  });

  it('el detalle la CONSUME —no basta con que el servidor la mande—', () => {
    /* Estuvo devuelta y sin consumir desde #248: el servidor decía si procedía
       y nadie lo leía. */
    expect(DETALLE).toMatch(/setDebidaForma\(/);
    expect(DETALLE).toMatch(/body\.debidaForma/);
  });

  it('el detalle monta el modal del acto', () => {
    /* El delimitador final NO es decorativo: sin él, `<RadicarDebidaFormaModalX`
       —o cualquier renombre que lo desconecte— seguiría satisfaciendo la
       comprobación. La primera versión de esta prueba tenía ese defecto y lo
       descubrí simulando la regresión: pasaba en verde con el modal desconectado. */
    expect(DETALLE).toMatch(/<RadicarDebidaFormaModal[\s/>]/);
  });

  it('y el modal LLAMA al endpoint real del acto', () => {
    expect(
      MODAL,
      'si el modal no llama a /radicar, el botón es decorativo',
    ).toMatch(/expedientes\/\$\{encodeURIComponent\(expedienteId\)\}\/radicar/);
    expect(MODAL).toMatch(/method:\s*'POST'/);
  });
});

describe('lo que la pantalla NO puede hacer', () => {
  it('no calcula el ancla por su cuenta', () => {
    /* El día desde el que corre el plazo lo decide el servidor. Que la pantalla
       lo calculara abriría dos verdades sobre la misma fecha. */
    expect(MODAL).not.toMatch(/sumarDiasHabiles|diasHabiles|new Date\(\)/);
  });

  it('manda `anclaEsperada`, que es el control optimista', () => {
    /* Si entre que la funcionaria mira y pulsa alguien tocó la evidencia, el
       acto se rechaza en vez de afirmar una fecha que ella no vio. */
    expect(MODAL).toMatch(/anclaEsperada:\s*previa\.anclaPropuesta/);
  });
});
