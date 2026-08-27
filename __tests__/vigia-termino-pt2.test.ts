import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * LA LECCIÓN PT-2, APLICADA AL VIGÍA DEL TÉRMINO.
 *
 * El 24-ago-2026 la auditoría encontró esto en el cron de PQRSD: el SMTP estaba
 * vacío, cada envío lanzaba, el `catch` contaba el error, la ruta devolvía
 * `ok:true` y el panel de Vercel pintaba el cron SANO — mientras CERO avisos de
 * vencimiento llegaban a nadie.
 *
 * Un vigilante que reporta éxito cuando no vigila es peor que no tenerlo,
 * porque el tablero lo pinta verde. Estas pruebas fijan la regla: si HABÍA algo
 * que avisar y NINGÚN correo salió, el cron responde 500.
 */

const enviarEmail = vi.fn();

const memoria: Record<string, unknown>[] = [];
const db = {
  expedientes: [] as Record<string, unknown>[],
  previos: [] as Record<string, unknown>[],

  collection(nombre: string) {
    const self = {
      limit: () => ({
        get: async () => ({
          size: db.expedientes.length,
          docs: db.expedientes.map((d) => ({ data: () => d })),
        }),
      }),
      get: async () => ({
        docs: (nombre === 'vigilancia_termino_licencias' ? db.previos : []).map((d) => ({ data: () => d })),
      }),
      doc: (id: string) => ({ id, path: `${nombre}/${id}` }),
    };
    return self;
  },
  doc: () => ({ get: async () => ({ exists: false, data: () => null }) }),
  batch: () => ({
    set: (ref: { path: string }, datos: Record<string, unknown>) => memoria.push({ ...datos, __ref: ref.path }),
    delete: () => {},
    commit: async () => {},
  }),
};

vi.mock('@/lib/firebase-admin', () => ({ getFirebaseAdminDb: () => db }));
vi.mock('@/lib/logger', () => ({ logError: () => {} }));
vi.mock('@/lib/email/mailer', () => ({ enviarEmail: (...a: unknown[]) => enviarEmail(...a) }));

const { GET } = await import('@/app/api/cron/vencimientos-licencias/route');

const pedir = () =>
  GET(new Request('http://test/api/cron/vencimientos-licencias', {
    headers: { authorization: 'Bearer secreto-de-prueba' },
  }));

/** Un expediente YA VENCIDO: fuerza que haya novedad que avisar. */
const vencido = (id: string) => ({
  id,
  tenantId: 'SEC_PLANEACION',
  estadoJuridico: 'EN_REVISION',
  creadoEn: '2026-01-10T12:00:00.000Z',
  numeroExpediente: { numero: `1-110-202601-0000000${id}` },
  fechaAlertaConservadora: '2026-02-01T12:00:00.000Z',
});

beforeEach(() => {
  process.env.CRON_SECRET = 'secreto-de-prueba';
  enviarEmail.mockReset();
  memoria.length = 0;
  db.expedientes = [];
  db.previos = [];
  vi.setSystemTime(new Date('2026-08-27T12:30:00Z')); // jueves: NO toca resumen semanal
});

describe('había alertas y ningún envío salió', () => {
  it('responde 500, no un 200 silencioso', async () => {
    db.expedientes = [vencido('1')];
    enviarEmail.mockRejectedValue(new Error('SMTP no configurado'));

    const res = await pedir();
    const body = await res.json();

    expect(
      res.status,
      'un 200 aquí pintaría el cron sano mientras Planeación no recibe nada',
    ).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/no han sido comunicados/i);
  });

  it('y el 500 dice cuántos se intentaron, para poder diagnosticar', async () => {
    db.expedientes = [vencido('1')];
    enviarEmail.mockRejectedValue(new Error('SMTP no configurado'));
    const body = await (await pedir()).json();
    expect(body.correo).toMatchObject({ intentados: 1, enviados: 0, errores: 1 });
  });
});

describe('había alertas y el envío salió', () => {
  it('responde 200 y deja constancia de lo enviado', async () => {
    db.expedientes = [vencido('1')];
    enviarEmail.mockResolvedValue(undefined);

    const res = await pedir();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.correo).toMatchObject({ intentados: 1, enviados: 1, errores: 0 });
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(enviarEmail.mock.calls[0][0].to).toBe('planeacion@simacota-santander.gov.co');
  });
});

describe('no había nada que avisar', () => {
  it('no manda correo, y eso NO es un fracaso', async () => {
    /* La regla anti-ruido: sin novedades no se escribe a nadie. Y como no se
       intentó nada, tampoco puede haber «fracaso total». */
    db.expedientes = [];
    const res = await pedir();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(enviarEmail).not.toHaveBeenCalled();
    expect(body.correo).toMatchObject({ intentados: 0, enviados: 0 });
  });

  it('un expediente que YA estaba vencido ayer no vuelve a avisarse hoy', async () => {
    /* El defecto del cron de PQRSD, que reenvía cada día hábil hasta que el
       radicado sale del umbral, y acaba en la carpeta de filtrados. */
    db.expedientes = [vencido('1')];
    db.previos = [{ expedienteId: '1', numeroExpediente: 'X', nivel: 'VENCIDO' }];

    await pedir();
    expect(enviarEmail, 'sin cambio de nivel no hay novedad que contar').not.toHaveBeenCalled();
  });
});

describe('el resumen semanal del lunes', () => {
  it('sale aunque no haya nada que vigilar', async () => {
    /* El encargo del propietario: que Planeación aprenda a esperarlo, para que
       su ausencia también informe. */
    vi.setSystemTime(new Date('2026-08-31T12:30:00Z')); // lunes
    db.expedientes = [];
    enviarEmail.mockResolvedValue(undefined);

    await pedir();

    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(enviarEmail.mock.calls[0][0].subject).toMatch(/ningún expediente en vigilancia/i);
  });
});
