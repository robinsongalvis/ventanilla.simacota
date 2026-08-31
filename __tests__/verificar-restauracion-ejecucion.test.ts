import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inventarioDesdeReglas } from '@/scripts/backups/inventario-desde-reglas.mjs';

/**
 * EL VEREDICTO DEL ENSAYO DE RESTAURACIÓN, EJECUTADO — NO LEÍDO.
 *
 * `__tests__/inventario-restauracion.test.ts` comprueba que `users` sale de las
 * reglas y que la razón por la que debe traer datos sigue REDACTADA en
 * `scripts/backups/verificar-restauracion.mjs`. Eso es TEXTO: mientras la frase
 * siga escrita, el `if` que la usa puede desactivarse entero y aquella prueba
 * sigue verde. Y ese es exactamente el incidente que originó el guion: una base
 * restaurada SIN UN SOLO USUARIO firmada como «✔ RESTAURACIÓN VÁLIDA».
 *
 * Aquí se EJECUTA el guion de extremo a extremo con la frontera del Admin SDK
 * simulada, y se mira lo único que el ensayo publica de verdad: el VEREDICTO
 * impreso y el CÓDIGO DE SALIDA. `.github/workflows/drill-restauracion.yml`
 * corre ese paso con `set -euo pipefail` y `node … | tee`, así que el código del
 * guion sobrevive a la tubería y ES el rojo o el verde del ensayo.
 *
 * ALCANCE DECLARADO (ADR-0033 §4.6-bis):
 *
 *  · SÍ vigila las tres formas en que el guion puede declarar una pérdida, cada
 *    una ejecutada: una colección que DEBE traer datos y viene vacía; una
 *    subcolección vacía cuyo padre sí trae documentos; y una serie con contador
 *    en marcha y ningún documento del año. Y, en las tres, el código de salida.
 *  · NO vigila la GUARDA CONTRA PRODUCCIÓN ni la validación de argumentos: las
 *    dos llaman a `process.exit()`, que aquí abortaría el proceso de Vitest en
 *    lugar de fallar una prueba. Hoy NADIE las vigila automáticamente — se dice
 *    en vez de suponerlo.
 *  · NO vigila los DUPLICADOS de consecutivos: la base simulada no devuelve ids
 *    de documento, así que esa rama no se ejercita. La lógica pura sí está
 *    cubierta por `__tests__/detectar-fantasma.test.ts`; su cableado dentro de
 *    este guion, no.
 *  · NO vigila los HUECOS, porque por decisión explícita del guion no son fallo.
 *  · NO vigila la rama `sinClasificar`: para ejercitarla habría que falsear el
 *    inventario, y quien la haría saltar —una colección nueva sin clasificar—
 *    pone roja antes la prueba textual de `inventario-restauracion.test.ts`.
 *  · NO vigila la derivación del inventario desde las reglas: eso es
 *    `inventario-restauracion.test.ts`.
 */

/** Frontera del Admin SDK: ni credenciales, ni red, ni escrituras. Solo conteos. */
const { baseSimulada } = vi.hoisted(() => {
  const raiz = new Map<string, number>();
  const grupos = new Map<string, number>();
  const contadores = new Map<string, number>();
  const conteo = (n: number) => ({ get: async () => ({ data: () => ({ count: n }) }) });

  return {
    baseSimulada: {
      raiz,
      grupos,
      contadores,
      /** La base que el guion abrió de verdad (`--base`), para comprobar el cableado. */
      baseAbierta: undefined as string | undefined,
      collection(nombre: string) {
        return {
          count: () => conteo(raiz.get(nombre) ?? 0),
          /* Sección de consecutivos: sin ids no hay huecos ni duplicados —
             declarado arriba como fuera de alcance. */
          select: () => ({ get: async () => ({ docs: [] as { id: string }[] }) }),
        };
      },
      collectionGroup(nombre: string) {
        return { count: () => conteo(grupos.get(nombre) ?? 0) };
      },
      doc(ruta: string) {
        return { get: async () => ({ data: () => ({ ultimo: contadores.get(ruta) ?? 0 }) }) };
      },
    },
  };
});

vi.mock('firebase-admin/app', () => ({
  applicationDefault: () => ({}),
  getApps: () => [{ name: '[DEFAULT]' }],
  initializeApp: () => ({ name: '[DEFAULT]' }),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: (base: string) => {
    baseSimulada.baseAbierta = base;
    return baseSimulada;
  },
}));

/* Nunca el id de producción (`ventanilla-unica-f31b1`): con él, el guion llama a
   `process.exit(2)` y se lleva por delante el proceso de Vitest. */
const PROYECTO_ENSAYO = 'ventanilla-unica-stage';
const BASE_ENSAYO = 'drill-20260830';
/* El año se pasa SIEMPRE: sin `--anio` el guion usa el reloj, y la suite corre
   en UTC en CI y en Bogotá en local. Una prueba de fechas que dependa de eso ya
   nos ha mordido dos veces. */
const ANIO = '2026';

const ARGV_ORIGINAL = process.argv;

/**
 * Siembra una restauración COMPLETA: toda colección del inventario y toda
 * subcolección, con documentos, y los contadores en cero. Se deriva de
 * `inventarioDesdeReglas()` —la misma fuente que usa el guion— y no de una lista
 * a mano, por la misma razón por la que el guion lo hace: una colección nueva
 * entra sola, sin que nadie tenga que acordarse de venir aquí.
 */
function sembrarRestauracionCompleta(): void {
  const inventario = inventarioDesdeReglas();
  baseSimulada.raiz.clear();
  baseSimulada.grupos.clear();
  baseSimulada.contadores.clear();
  baseSimulada.baseAbierta = undefined;
  for (const coleccion of inventario.raiz) baseSimulada.raiz.set(coleccion, 7);
  for (const sub of inventario.subcolecciones) baseSimulada.grupos.set(sub.nombre, 7);
}

/**
 * Corre el verificador entero y devuelve lo que el ensayo consume: el informe
 * impreso y el código de salida.
 *
 * `verificar-restauracion.mjs` no exporta nada —todo su trabajo ocurre al
 * importarlo—, así que se le fija `process.argv` y se importa con
 * `vi.resetModules()` para poder correrlo una vez por caso.
 *
 * `process.exitCode` se lee ANTES y se RESTAURA después: es estado global del
 * proceso de pruebas, y dejarlo en 1 haría salir en rojo al worker de Vitest
 * aunque todas las pruebas pasaran.
 */
async function correrVerificador(): Promise<{ informe: string; codigo: number }> {
  const salida: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...partes: unknown[]) => {
    salida.push(partes.join(' '));
  });
  const exitCodeOriginal = process.exitCode;

  /* `argv[1]` NO puede acabar en `detectar-consecutivos-fantasma.mjs`: ese
     módulo, que el verificador importa, arranca su `main()` contra Firestore si
     cree que se le invocó directamente. */
  process.argv = [
    'node',
    'scripts/backups/verificar-restauracion.mjs',
    '--proyecto', PROYECTO_ENSAYO,
    '--base', BASE_ENSAYO,
    '--anio', ANIO,
  ];

  try {
    vi.resetModules();
    await import('@/scripts/backups/verificar-restauracion.mjs');
    return { informe: salida.join('\n'), codigo: Number(process.exitCode ?? 0) };
  } finally {
    process.exitCode = exitCodeOriginal;
    process.argv = ARGV_ORIGINAL;
    log.mockRestore();
  }
}

beforeEach(() => {
  sembrarRestauracionCompleta();
});

describe('una colección que DEBE traer datos y viene vacía tumba el ensayo', () => {
  /* La razón se asevera además del nombre: es el texto que el guion SOLO
     construye dentro del `if` que decide el veredicto. */
  const CASOS: ReadonlyArray<{ coleccion: string; razon: string }> = [
    { coleccion: 'users', razon: 'Sin usuarios nadie puede autenticarse' },
    { coleccion: 'ventanilla_radicados', razon: 'Es el libro de correspondencia' },
    { coleccion: 'counters', razon: 'Sin contadores no se puede emitir' },
  ];

  for (const { coleccion, razon } of CASOS) {
    it(`"${coleccion}" vacía ⇒ NO VÁLIDA y código 1`, async () => {
      baseSimulada.raiz.set(coleccion, 0);

      const { informe, codigo } = await correrVerificador();

      expect(informe).toContain(`"${coleccion}" quedó VACÍA`);
      expect(informe).toContain(razon);
      expect(informe).toContain('⛔ RESTAURACIÓN NO VÁLIDA');
      expect(informe).not.toContain('✔ RESTAURACIÓN VÁLIDA');
      expect(codigo).toBe(1);
    });
  }

  /* Deliberadamente NO se asevera la marca «✗ VACÍA» de la tabla: se imprime
     FUERA del `if` que decide el veredicto y sobreviviría intacta a que ese `if`
     se desactive. Aseverarla sería reincidir en el doble verde. */
});

describe('las otras dos formas de perder datos, también ejecutadas', () => {
  it('una subcolección vacía con el padre poblado ⇒ NO VÁLIDA y código 1', async () => {
    baseSimulada.grupos.set('actuaciones', 0);

    const { informe, codigo } = await correrVerificador();

    expect(informe).toContain('"expedientes/actuaciones" está VACÍA mientras "expedientes" tiene 7 documento(s)');
    expect(informe).toContain('⛔ RESTAURACIÓN NO VÁLIDA');
    expect(codigo).toBe(1);
  });

  it('un contador en marcha sin ningún documento del año ⇒ NO VÁLIDA y código 1', async () => {
    baseSimulada.contadores.set(`counters/radicados-${ANIO}`, 5);

    const { informe, codigo } = await correrVerificador();

    expect(informe).toContain(`La serie "radicados" tiene contador en 5 pero NINGÚN documento del año ${ANIO}`);
    expect(informe).toContain('⛔ RESTAURACIÓN NO VÁLIDA');
    expect(codigo).toBe(1);
  });
});

describe('el control: sin esto, un verificador que fallara SIEMPRE también saldría verde arriba', () => {
  it('con todo poblado dictamina VÁLIDA y código 0', async () => {
    const { informe, codigo } = await correrVerificador();

    expect(informe).toContain('✔ RESTAURACIÓN VÁLIDA');
    expect(informe).not.toContain('⛔');
    expect(codigo).toBe(0);
  });

  it('verifica la base que se le pidió, no la que venga por defecto', async () => {
    await correrVerificador();

    expect(baseSimulada.baseAbierta).toBe(BASE_ENSAYO);
  });
});
