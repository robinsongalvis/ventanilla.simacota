import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* ══════════════════════════════════════════════════════════════
   Guardas estáticas del arranque de Sentry (G7, ADR-0025).

   Sentry existe aquí para observar errores, no para observar CIUDADANOS.
   Estas guardas fijan las decisiones de privacidad (Ley 1581) que hacen
   aceptable enviar eventos a un tercero, de modo que no se relajen en un
   refactor sin que alguien lo note:

   1. `sendDefaultPii: false` en TODOS los inits — jamás IPs/cookies/headers.
   2. Todo `beforeSend` pasa por `sanitizarEventoSentry` (H-N03).
   3. Nada de Session Replay: grabaría pantallas con datos reales de
      ciudadanos. Activarlo exige ADR propio.
   4. `tracesSampleRate: 0` — solo errores.
   5. El init está condicionado al DSN: sin variable, no-op total.

   Son guardas de FORMA (leen el archivo, no ejecutan el SDK): el
   comportamiento del depurador lo cubre sanitizar-observabilidad.test.ts.
══════════════════════════════════════════════════════════════ */

const ARCHIVOS = ['instrumentation.ts', 'instrumentation-client.ts'] as const;

describe.each(ARCHIVOS)('%s — decisiones de privacidad fijadas', (archivo) => {
  const fuente = readFileSync(join(process.cwd(), archivo), 'utf8');

  it('nunca envía PII por defecto', () => {
    expect(fuente).toContain('sendDefaultPii: false');
  });

  it('todo evento pasa por el depurador H-N03', () => {
    expect(fuente).toContain('sanitizarEventoSentry(');
  });

  it('sin Session Replay (grabaría pantallas de ciudadanos)', () => {
    expect(fuente).not.toMatch(/replayIntegration|Replay\(/);
  });

  it('solo errores: sin trazas de rendimiento', () => {
    expect(fuente).toContain('tracesSampleRate: 0');
    expect(fuente).not.toMatch(/tracesSampleRate:\s*0\.\d|tracesSampleRate:\s*[1-9]/);
  });

  it('el init está condicionado al DSN (sin variable = no-op)', () => {
    expect(fuente).toMatch(/if \(!?dsn\)/);
  });
});

describe('cobertura de las tres superficies', () => {
  it('el servidor exporta onRequestError (errores fuera de try/catch)', () => {
    const fuente = readFileSync(join(process.cwd(), 'instrumentation.ts'), 'utf8');
    expect(fuente).toContain('export const onRequestError');
  });

  it('existe la frontera global del App Router y reporta a Sentry', () => {
    const fuente = readFileSync(join(process.cwd(), 'app/global-error.tsx'), 'utf8');
    expect(fuente).toContain('captureException(error)');
    expect(fuente).toContain("html lang=\"es\"");
  });
});
