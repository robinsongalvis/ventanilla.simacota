import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { EstadoTramiteLicencia } from '@/app/interno/dashboard/components/pqrs/EstadoTramiteLicencia';
import { CabeceraTermino } from '@/app/interno/licencias/components/CabeceraTermino';
import { proyectarParaVentanilla } from '@/lib/server/proyeccion-ventanilla';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';
import { diasRestantesHabiles, sumarDiasHabiles } from '@/lib/tiempos-radicado';

/* ══════════════════════════════════════════════════════════════
   EL MOSTRADOR Y PLANEACIÓN LEEN EL MISMO RELOJ.

   Lo pidió el propietario el 9-sep-2026: «la idea es que concuerde uno con el
   otro independientemente». Independientemente quiere decir esto — que no
   dependa de que alguien se acuerde de tocar las dos pantallas.

   EL DEFECTO QUE ESTO CUSTODIA, en concreto: el ciudadano pregunta abajo en
   ventanilla y la funcionaria le dice «le quedan 38 días»; sube a Planeación y
   allí la pantalla dice 39. O peor: el expediente tiene acta de observaciones
   —el reloj está SUSPENDIDO por norma— y el mostrador le sigue anunciando un
   vencimiento que no corre.

   ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────

   Esto MIRA: que de UN SOLO expediente las dos pantallas saquen el mismo número
   de días y la misma situación del término; y que el bloque de ventanilla esté
   ALCANZABLE desde la ruta —no colgado de un componente que nadie pinta, que es
   exactamente como estuvo entre el 26-ago y el 9-sep-2026—.

   Esto NO MIRA: las PALABRAS de cada pantalla, que son distintas a propósito
   (Planeación le dice a su técnico qué hacer; el mostrador le lee hechos al
   ciudadano), ni la maquetación, ni los permisos —eso lo custodia la matriz de
   aislamiento por tenant—.
══════════════════════════════════════════════════════════════ */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const AHORA = new Date();
const enDiasHabiles = (n: number) => sumarDiasHabiles(AHORA.toISOString(), n).toISOString();
/* HACIA ATRÁS NO SIRVE `sumarDiasHabiles`: recorta la `n` negativa a cero
   (`Math.max(0, …)`) y devuelve HOY. La primera versión de la prueba del
   vencido pedía «hace 3 días» y montaba un expediente que vencía hoy. Para el
   pasado se cuentan días calendario y el número hábil lo dice la misma función
   que usa producción. */
function haceDiasCalendario(n: number): string {
  const d = new Date(AHORA);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function expedienteDe(
  estadoJuridico: EstadoJuridicoLicencia,
  { vence, desde }: { vence: string | null; desde: string | null },
): ExpedienteLicenciaDoc {
  return {
    id: 'exp-1',
    tenantId: 'SEC_PLANEACION',
    tramiteId: 'licencia-construccion-obra-nueva',
    estadoJuridico,
    numeroExpediente: { numero: '68745-0-26-0002', serieId: 'expedientes', año: 2026 },
    fechaRadicacionDebidaForma: desde,
    fechaAlertaConservadora: vence,
    completitud: { faltantes: [] },
  } as unknown as ExpedienteLicenciaDoc;
}

/** Monta el mostrador con la MISMA proyección que devolvería el servidor. */
async function pintarMostrador(exp: ExpedienteLicenciaDoc) {
  const proyeccion = proyectarParaVentanilla(exp);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ tieneExpediente: true, proyeccion }) })),
  );
  const { container } = render(<EstadoTramiteLicencia radicadoId="1-110-202609-00000002" />);
  await screen.findByText('Estado del trámite de licencia');
  return container;
}

/** Monta la tarjeta de Planeación con los MISMOS campos del expediente. */
function pintarPlaneacion(exp: ExpedienteLicenciaDoc) {
  const { container } = render(
    <CabeceraTermino
      expedienteId={exp.id}
      estadoJuridico={exp.estadoJuridico}
      desdeIso={exp.fechaRadicacionDebidaForma ?? undefined}
      venceIso={exp.fechaAlertaConservadora as string}
    />,
  );
  return container;
}

const texto = (c: HTMLElement) => (c.textContent ?? '').replace(/\s+/g, ' ');

/** El número grande del anillo de Planeación. */
const diasDePlaneacion = (c: HTMLElement) => c.querySelector('svg text')?.textContent?.trim() ?? '';
/** El número que el mostrador le lee al ciudadano. */
const diasDelMostrador = (c: HTMLElement) => texto(c).match(/Quedan (\d+) días? hábil/)?.[1] ?? '';

describe('el mismo expediente, el mismo número de días', () => {
  /* Tres puntos del plazo, no uno: un solo caso puede coincidir por casualidad
     —por ejemplo si las dos pantallas devolvieran siempre 45—. */
  for (const restantes of [39, 12, 3]) {
    it(`a ${restantes} días hábiles del vencimiento, las dos dicen ${restantes}`, async () => {
      const exp = expedienteDe('EN_REVISION', {
        vence: enDiasHabiles(restantes),
        desde: enDiasHabiles(-6),
      });

      const mostrador = await pintarMostrador(exp);
      const planeacion = pintarPlaneacion(exp);

      expect(diasDePlaneacion(planeacion)).toBe(String(restantes));
      expect(
        diasDelMostrador(mostrador),
        'el mostrador y Planeación dan plazos distintos del MISMO expediente',
      ).toBe(String(restantes));
    });
  }

  it('el «día N de 45» también coincide, palabra por palabra', async () => {
    const exp = expedienteDe('EN_REVISION', { vence: enDiasHabiles(39), desde: enDiasHabiles(-6) });

    const mostrador = await pintarMostrador(exp);
    const planeacion = pintarPlaneacion(exp);

    expect(texto(planeacion)).toContain('día 6 de 45');
    expect(texto(mostrador)).toContain('día 6 de 45');
  });
});

describe('la SITUACIÓN del reloj tampoco puede divergir', () => {
  it('con acta de observaciones el mostrador NO anuncia un vencimiento suspendido', async () => {
    /* El defecto más caro de esta familia: la norma suspende el término
       (D.1077/2015 art. 2.2.6.1.2.2.4) y Planeación lo pintaba detenido, pero
       el mostrador seguía leyendo «vence el …» porque solo miraba la fecha. */
    const exp = expedienteDe('CON_ACTA_DE_OBSERVACIONES', {
      vence: enDiasHabiles(20),
      desde: enDiasHabiles(-6),
    });

    const mostrador = await pintarMostrador(exp);
    const planeacion = pintarPlaneacion(exp);

    expect(texto(planeacion)).toContain('El término no está corriendo');
    expect(texto(mostrador)).toContain('Reloj detenido');
    expect(
      texto(mostrador),
      'el mostrador anuncia un vencimiento mientras el término está suspendido',
    ).not.toMatch(/Vence el/);
    expect(diasDelMostrador(mostrador), 'el mostrador cuenta días de un reloj parado').toBe('');
  });

  it('ya decidida, ninguna de las dos cuenta días', async () => {
    const exp = expedienteDe('CONCEDIDA', { vence: enDiasHabiles(20), desde: enDiasHabiles(-6) });

    const mostrador = await pintarMostrador(exp);
    const planeacion = pintarPlaneacion(exp);

    /* Planeación no pinta tarjeta; el mostrador lo dice con palabras en vez de
       callarse — ADR-0034 §4: un silencio obliga a la funcionaria a interpretar. */
    expect(texto(planeacion)).toBe('');
    expect(texto(mostrador)).toContain('el término dejó de correr');
    expect(diasDelMostrador(mostrador)).toBe('');
  });

  it('sin ancla, el mostrador dice la frase del ADR y no inventa cuenta atrás', async () => {
    const exp = expedienteDe('PRESENTADA', { vence: null, desde: null });

    const mostrador = await pintarMostrador(exp);

    expect(texto(mostrador)).toContain('El plazo aún no ha empezado a correr.');
    expect(diasDelMostrador(mostrador)).toBe('');
  });

  it('vencido, las dos cuentan los MISMOS días de retraso', async () => {
    const vence = haceDiasCalendario(10);
    const exp = expedienteDe('EN_REVISION', { vence, desde: haceDiasCalendario(90) });
    const retraso = Math.abs(diasRestantesHabiles(vence, AHORA));

    const mostrador = await pintarMostrador(exp);
    const planeacion = pintarPlaneacion(exp);

    /* Planeación lo pinta con signo en el anillo («−7»); el mostrador con
       palabras. El número tiene que ser el mismo. */
    expect(diasDePlaneacion(planeacion).replace(/^[−-]/, '')).toBe(String(retraso));
    expect(texto(mostrador)).toContain(`venció hace ${retraso} días hábiles`);
  });

  it('y el mostrador dice el hecho, pero NO la conclusión jurídica', async () => {
    /* El silencio administrativo positivo es el riesgo que Planeación tiene que
       leer. Dicho desde el mostrador sería una conclusión jurídica en boca de
       quien no la toma (ADR-0034 §3). */
    const exp = expedienteDe('EN_REVISION', {
      vence: haceDiasCalendario(10),
      desde: haceDiasCalendario(90),
    });

    const mostrador = await pintarMostrador(exp);
    const planeacion = pintarPlaneacion(exp);

    expect(texto(planeacion)).toContain('silencio administrativo positivo');
    expect(texto(mostrador), 'el mostrador emite una conclusión jurídica que no le toca')
      .not.toMatch(/silencio administrativo/i);
  });
});

describe('el bloque está ALCANZABLE desde la ruta, no solo escrito', () => {
  /* POR QUÉ ESTO NO ES UN grep DE CORTESÍA. Entre el 26-ago y el 9-sep-2026 la
     proyección del ADR-0034 existió entera —ruta de servidor, aislamiento por
     tenant, componente y prueba de render en verde— y NADIE llegó a verla: el
     bloque colgaba de `PanelGestionRadicado`, el panel de detalle anterior, que
     el Sprint Panel claro dejó sin un solo llamador.

     Una prueba de render no lo habría cazado: la que existía RENDERIZABA el
     panel muerto y pasaba. Lo que hay que custodiar no es que el componente
     pinte, sino que sea ALCANZABLE — y eso es una propiedad del grafo de
     imports, así que se calcula, no se busca por texto. */

  const RAIZ = process.cwd();
  const EXTS = ['.tsx', '.ts', '/index.tsx', '/index.ts'];

  function resolver(desde: string, especificador: string): string | null {
    let base: string;
    if (especificador.startsWith('@/')) base = especificador.slice(2);
    else if (especificador.startsWith('.')) base = path.normalize(path.join(path.dirname(desde), especificador));
    else return null; // node_modules: fuera del grafo del repo
    for (const ext of ['', ...EXTS]) {
      const candidato = base + ext;
      if (existsSync(path.join(RAIZ, candidato)) && candidato.match(/\.tsx?$/)) return candidato;
    }
    return null;
  }

  function cierreDeImports(entrada: string): Set<string> {
    const vistos = new Set<string>();
    const pendientes = [entrada];
    while (pendientes.length) {
      const actual = pendientes.pop()!;
      if (vistos.has(actual)) continue;
      vistos.add(actual);
      const fuente = readFileSync(path.join(RAIZ, actual), 'utf8');
      for (const m of fuente.matchAll(/from\s+'([^']+)'|import\('([^']+)'\)/g)) {
        const destino = resolver(actual, m[1] ?? m[2]);
        if (destino) pendientes.push(destino);
      }
    }
    return vistos;
  }

  const RUTA = 'app/interno/dashboard/page.tsx';
  const BLOQUE = 'app/interno/dashboard/components/pqrs/EstadoTramiteLicencia.tsx';

  it('la pantalla del Tablero alcanza el bloque del ADR-0034', () => {
    const alcanzables = cierreDeImports(RUTA);
    expect(
      alcanzables.has(BLOQUE),
      'el bloque del estado del trámite volvió a quedar fuera del alcance de la ruta — como cuando colgaba del panel muerto',
    ).toBe(true);
  });

  it('y alguien en ese alcance lo PINTA, no solo lo importa', () => {
    const alcanzables = cierreDeImports(RUTA);
    const lopinta = [...alcanzables].some((f) =>
      f !== BLOQUE && readFileSync(path.join(RAIZ, f), 'utf8').includes('<EstadoTramiteLicencia'),
    );
    expect(lopinta, 'el bloque se importa pero ya nadie lo renderiza').toBe(true);
  });
});
