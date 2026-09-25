import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESTADOS_ACTIVOS } from '@/lib/radicado-estados';

/**
 * Dos vigilantes de plazos —el cron de alertas PQRSD y el motor predictivo de
 * SIMI— mantenían cada uno su copia local de los estados activos, y ninguna
 * coincidía con la canónica: las dos omitían `EN_SUBSANACION` sin decir si era
 * decisión u olvido.
 *
 * La omisión resultó correcta (en ese estado el término está SUSPENDIDO), pero
 * eso no se sabía leyendo el código — y una lista que se recorre sin declarar
 * quién no está en ella es un vigilante que no sabe qué no está mirando
 * (ADR-0033 §4.6-bis).
 *
 * Ahora ambos DERIVAN del dominio y declaran su exclusión. Esta prueba impide
 * que vuelvan a divergir: añadir un estado activo al dominio lo incorpora a los
 * dos vigilantes solo, y quitar la declaración de la exclusión rompe aquí.
 *
 * 30-ago-2026 — ESTE ARCHIVO LEÍA EL TEXTO, NO EL ALCANCE. Todo lo de arriba se
 * comprobaba con `readFileSync` sobre la FUENTE, y el conjunto que los
 * vigilantes consultan de verdad no aparecía por ningún lado: mientras el
 * literal siguiera escrito, el filtro podía tachar `DEVUELTO` —sin declararlo
 * en las exclusiones— y las tres pruebas seguían verdes. El huérfano que el
 * nombre prometía cazar era justamente el que se colaba.
 *
 * Ahora los dos vigilantes se EJECUTAN con la frontera del Admin SDK simulada y
 * se compara la cláusula `estadoActual in [...]` que le llega a Firestore contra
 * el dominio menos lo declarado. Y como el dominio se AUMENTA con un estado
 * sonda antes de cargarlos, la igualdad prueba además la promesa del párrafo
 * anterior —que un estado nuevo entra solo—, que hasta hoy solo verificaba una
 * expresión regular sobre la línea del `import`.
 */

/* ── LA SONDA ──────────────────────────────────────────────────────────────
   Un estado activo que el dominio no tenía, añadido ANTES de que cualquiera de
   los dos vigilantes se cargue (ambos se importan dinámicamente, dentro de las
   pruebas; este `add` corre al evaluar el archivo). Los vigilantes derivan su
   conjunto en tiempo de carga, así que si de verdad DERIVAN, la sonda aparece
   en lo que le preguntan a Firestore; si alguien vuelve a escribir la lista a
   mano —aunque conserve el `import` para que la prueba textual pase—, no
   aparece y la corrida viva lo dice. Vitest aísla el registro de módulos por
   archivo: esta mutación no sale de aquí. */
const ESTADO_SONDA = 'ESTADO_SONDA_DE_LA_PRUEBA';
ESTADOS_ACTIVOS.add(ESTADO_SONDA);

/* ── LA BASE FALSA: la frontera del Admin SDK, y nada más ──────────────────
   No sustituye a los vigilantes; solo apunta QUÉ le preguntan a Firestore. Es
   la única forma de mirar el conjunto que de verdad consultan: el `Set` que
   cada módulo deriva es privado, y volver a leerlo del archivo con una
   expresión regular sería repetir el error que trajo hasta aquí. */
interface ClausulaConsultada {
  coleccion: string;
  campo:     string;
  operador:  string;
  /* Lo que viaja a Firestore. `unknown` a propósito: el operador `in` manda un
     arreglo y el `<=` una fecha; cada prueba se queda con el que le toca. */
  valor:     unknown;
}

interface ConsultaEncadenable {
  where(campo: string, operador: string, valor: unknown): ConsultaEncadenable;
  orderBy(campo: string): ConsultaEncadenable;
  limit(cantidad: number): ConsultaEncadenable;
  add(datos: Record<string, unknown>): Promise<void>;
  get(): Promise<{ empty: boolean; size: number; docs: { data: () => unknown }[] }>;
}

const CLAUSULAS: ClausulaConsultada[] = [];
/** Documentos que la base devuelve por colección. Sin sembrar, el vigilante no encuentra nada. */
const SEMILLA = new Map<string, Record<string, unknown>[]>();

function consultaFalsa(coleccion: string): ConsultaEncadenable {
  const encadenable: ConsultaEncadenable = {
    where(campo, operador, valor) {
      CLAUSULAS.push({ coleccion, campo, operador, valor });
      return encadenable;
    },
    orderBy: () => encadenable,
    limit:   () => encadenable,
    /* SIMI sí escribe durante estas corridas: al radicado sembrado en estado
       DEVUELTO le corresponde una alerta `devuelto_sin_ajuste`. Se traga a
       propósito — lo que estas pruebas miden es el ALCANCE, no la alerta. */
    add:     async () => {},
    get:     async () => {
      const docs = (SEMILLA.get(coleccion) ?? []).map((d) => ({ data: () => d }));
      return { empty: docs.length === 0, size: docs.length, docs };
    },
  };
  return encadenable;
}

const baseFalsa = { collection: (nombre: string) => consultaFalsa(nombre) };

vi.mock('@/lib/firebase-admin', () => ({ getFirebaseAdminDb: () => baseFalsa }));
/* Cable trampa: los radicados sembrados vencen dentro de un mes, así que
   ninguna corrida de este archivo debería enviar correo. Si alguna lo intenta,
   el cron cuenta el error, declara fracaso total y responde 500 — y la prueba
   lo ve en vez de tragárselo. */
vi.mock('@/lib/email/mailer', () => ({
  enviarEmail: async () => { throw new Error('la corrida de alcance no debe enviar correo'); },
}));
vi.mock('@/lib/logger', () => ({ logError: () => {} }));

const RUTA_CRON_PQRSD = 'app/api/cron/alertas-vencimiento/route.ts';
const RUTA_MOTOR_SIMI = 'lib/simi-juridico/predictDeadlineAlerts.ts';

/**
 * Cada vigilante con su ruta y con la forma de CORRERLO de verdad. La tercera
 * columna devuelve cuántos radicados dice haber analizado: es el número que
 * expone si un estado sobrevivió a la consulta y murió en un filtro posterior.
 */
const VIGILANTES = [
  [
    'cron de alertas de vencimiento PQRSD',
    RUTA_CRON_PQRSD,
    async (): Promise<number> => {
      const { GET } = await import('@/app/api/cron/alertas-vencimiento/route');
      const respuesta = await GET(new Request('http://prueba/api/cron/alertas-vencimiento', {
        headers: { authorization: 'Bearer secreto-de-prueba' },
      }));
      /* 200 = la corrida llegó hasta el final. Con 401, 503 o 500 no habría
         consultado nada y estaríamos midiendo un silencio. */
      expect(respuesta.status, 'la corrida no llegó hasta el final').toBe(200);
      const informe = await respuesta.json() as { total: number };
      return informe.total;
    },
  ],
  [
    'motor predictivo de SIMI',
    RUTA_MOTOR_SIMI,
    async (): Promise<number> => {
      const { generateDeadlineAlerts } = await import('@/lib/simi-juridico/predictDeadlineAlerts');
      return (await generateDeadlineAlerts()).radicadosAnalizados;
    },
  ],
] as const;

beforeEach(() => {
  /* Sin credencial el cron responde 503 y no consulta nada: la prueba mediría
     un silencio y se pondría roja con el código sano. Y sin vaciar lo
     registrado, la segunda corrida vería las cláusulas de la primera y el
     «acota su lectura una sola vez» fallaría por contagio, no por defecto. */
  process.env.CRON_SECRET = 'secreto-de-prueba';
  CLAUSULAS.length = 0;
  SEMILLA.clear();
});

/** El bloque de exclusiones declaradas, tal cual está escrito en el vigilante. */
function declaracionDeExclusiones(ruta: string): string | null {
  return readFileSync(ruta, 'utf8').match(/EXCLUIDOS_POR_TERMINO_SUSPENDIDO = \{([^}]*)\}/)?.[1] ?? null;
}

/** Los estados que el vigilante declara dejar fuera, por su nombre. */
function exclusionesDeclaradas(ruta: string): string[] {
  return [...(declaracionDeExclusiones(ruta) ?? '').matchAll(/^\s*([A-Z_]+):/gm)].map((x) => x[1]);
}

/** El alcance que le corresponde: el dominio ENTERO menos lo que declara excluir. */
function alcanceQueLeCorresponde(ruta: string): string[] {
  const fuera = new Set(exclusionesDeclaradas(ruta));
  return [...ESTADOS_ACTIVOS].filter((e) => !fuera.has(e)).sort();
}

describe('los vigilantes de plazos derivan sus estados del dominio', () => {
  it.each(VIGILANTES)('%s importa la lista canónica en vez de reescribirla', (_nombre, ruta) => {
    const fuente = readFileSync(ruta, 'utf8');
    expect(fuente).toMatch(/ESTADOS_ACTIVOS as ESTADOS_ACTIVOS_DOMINIO.*radicado-estados/);
    // Ninguna lista literal de estados: eso es lo que se desincronizaba.
    expect(fuente).not.toMatch(/new Set\(\[\s*'PENDIENTE'/);
  });

  it.each(VIGILANTES)('%s declara por escrito lo que deja fuera, con su razón', (_nombre, ruta) => {
    const declaracion = declaracionDeExclusiones(ruta);
    expect(declaracion, 'no declara sus exclusiones').toBeTruthy();
    expect(declaracion!).toMatch(/EN_SUBSANACION/);
    // Una razón, no un marcador.
    expect(declaracion!).toMatch(/SUSPENDIDO/);
    expect(declaracion!.length).toBeGreaterThan(60);
    /* Y ÚNICA en el archivo: una segunda declaración dejaría intacta a la
       primera —la que estas pruebas leen— y volvería a separar lo declarado de
       lo aplicado. */
    expect(readFileSync(ruta, 'utf8').match(/EXCLUIDOS_POR_TERMINO_SUSPENDIDO\s*=/g) ?? [],
      'hay más de una declaración de exclusiones').toHaveLength(1);
  });

  it.each(VIGILANTES)('%s no declara excluir un estado que el dominio ya no tiene (lectura TEXTUAL)', (_nombre, ruta) => {
    /* ALCANCE DE ESTA PRUEBA (ADR-0033 §4.6-bis): solo el TEXTO de la
       declaración. Comprueba que no se declare excluir algo inexistente —el
       paso previo a que la derivación deje de coincidir con la realidad— y NADA
       sobre lo que el vigilante consulta de verdad. El nombre anterior prometía
       cazar huérfanos y no miraba ninguno. De eso se ocupa la corrida viva. */
    const declarados = exclusionesDeclaradas(ruta);
    expect(declarados.length, 'no declara ninguna exclusión').toBeGreaterThan(0);
    for (const d of declarados) {
      expect(ESTADOS_ACTIVOS.has(d), `declara excluir '${d}', que no es un estado activo del dominio`).toBe(true);
    }
  });
});

describe('los vigilantes CONSULTAN lo que dicen vigilar (corrida viva)', () => {
  it.each(VIGILANTES)(
    '%s pregunta a Firestore por el dominio ENTERO menos lo que declara excluir',
    async (_nombre, ruta, correr) => {
      await correr();

      const porEstado = CLAUSULAS.filter(
        (c) => c.coleccion === 'ventanilla_radicados' && c.campo === 'estadoActual' && c.operador === 'in',
      );
      expect(porEstado, 'no acota su lectura por estado, o la acota más de una vez').toHaveLength(1);

      const consultados = [...(porEstado[0].valor as string[])].sort();
      /* IGUALDAD, no inclusión. Si FALTA uno, el vigilante dejó de mirarlo sin
         declararlo: ese es el huérfano. Si SOBRA, mira algo que el dominio ya
         no considera activo. Entre los esperados va la SONDA: su ausencia
         significa que el conjunto dejó de derivarse del dominio. */
      expect(consultados, 'lo que consulta no es lo que declara vigilar').toEqual(alcanceQueLeCorresponde(ruta));
    },
  );
});

describe('ningún estado sobrevive a la consulta y muere después', () => {
  /* ALCANCE DE ESTA PRUEBA (ADR-0033 §4.6-bis): el tramo que va de la consulta
     al CONTEO que cada vigilante reporta. Cubre el segundo filtro por estado
     que hoy solo tiene el cron de PQRSD (`.filter((r) =>
     ESTADOS_ACTIVOS.has(...))`) y cualquiera que le nazca al motor de SIMI.
     NO cubre lo que pasa DESPUÉS del conteo: un `continue` dentro del bucle de
     envío descartaría un estado sin mover este número. Ese tramo se mide por
     los avisos efectivamente enviados, y esa es otra prueba. */
  it.each(VIGILANTES)('%s cuenta en su informe todos los estados que consultó', async (_nombre, ruta, correr) => {
    const esperados = alcanceQueLeCorresponde(ruta);
    /* Vencen dentro de un mes: pasan el filtro de estado y mueren en el umbral,
       antes de tocar el correo. Fecha RELATIVA a propósito — una absoluta
       ataría la evidencia a la zona horaria de quien la corre (local Bogotá, CI
       en UTC). Sin destinatario resoluble a propósito: si el umbral fallara, el
       radicado se cuenta como omitido en vez de reventar. */
    const dentroDeUnMes = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    SEMILLA.set('ventanilla_radicados', esperados.map((estadoActual, i) => ({
      radicadoId:    `1-110-202608-0000000${i}`,
      estadoActual,
      prioridad:     'VERDE',
      termino:       { fechaVencimiento: dentroDeUnMes },
      clasificacion: { oficinaDestino: 'OFICINA_SIN_CORREO' },
    })));

    const analizados = await correr();

    expect(analizados, 'algún estado consultado se cayó en un filtro posterior').toBe(esperados.length);
  });
});

describe('los vigilantes usan el criterio CANÓNICO de dato de prueba', () => {
  /* El paquete 1 unificó `esDatoDePrueba` para que reconociera `esPrueba`, pero
     estos dos crons no lo LLAMABAN: tenían su propio filtro inline
     (`!isTest && !excludeFromMetrics`), que no mira `anulado`.
     Consecuencia viva: los 27 radicados de prueba anulados con acta conservan
     su estado y su fecha de vencimiento, así que habrían generado alertas de
     mora como si fueran PQRSD ciudadanas — y esas alertas alimentan el tablero
     de Control Interno.
     Arreglar el criterio y no cablearlo es arreglarlo a medias. */
  it.each(VIGILANTES)('%s llama al criterio compartido, no a una copia', (_nombre, ruta) => {
    const fuente = readFileSync(ruta, 'utf8');
    expect(fuente).toMatch(/from '@\/lib\/radicados\/dato-de-prueba'/);
    expect(fuente).toMatch(/soloOperacionReal|esDatoDePrueba/);
  });

  it.each(VIGILANTES)('%s ya no filtra con su propia condición inline', (_nombre, ruta) => {
    const codigo = readFileSync(ruta, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(codigo).not.toMatch(/!r\.isTest\s*&&\s*!r\.excludeFromMetrics/);
    expect(codigo).not.toMatch(/d\.isTest \|\| d\.excludeFromMetrics/);
  });
});
