import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(async () => ({ messageId: 'sintetico-no-enviado' })),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: mocks.createTransport },
}));

async function cargarMailer() {
  return import('@/lib/email/mailer');
}

describe('mailer con Nodemailer 10 — sin red ni envíos reales', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    vi.stubEnv('EMAIL_HOST', 'smtp.example.invalid');
    vi.stubEnv('EMAIL_PORT', '465');
    vi.stubEnv('EMAIL_USER', 'cuenta@example.invalid');
    vi.stubEnv('EMAIL_PASS', 'clave-sintetica-no-secreta');
    vi.stubEnv('EMAIL_FROM', 'ventanilla@example.invalid');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('crea una sola instancia con el contrato de transporte de Nodemailer 10', async () => {
    const { getMailTransporter } = await cargarMailer();

    const primero = getMailTransporter();
    const segundo = getMailTransporter();

    expect(primero).toBe(segundo);
    expect(mocks.createTransport).toHaveBeenCalledTimes(1);
    expect(mocks.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.invalid',
      port: 465,
      secure: true,
      auth: {
        user: 'cuenta@example.invalid',
        pass: 'clave-sintetica-no-secreta',
      },
    });
  });

  it('delega el mensaje al transporte simulado sin abrir conexión SMTP', async () => {
    const { enviarEmail } = await cargarMailer();

    await enviarEmail({
      to: 'destino@example.invalid',
      subject: 'Validación sintética',
      html: '<p>Contenido sintético</p>',
      replyTo: 'respuesta@example.invalid',
    });

    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: 'ventanilla@example.invalid',
      to: 'destino@example.invalid',
      subject: 'Validación sintética',
      html: '<p>Contenido sintético</p>',
      replyTo: 'respuesta@example.invalid',
    });
  });

  it('falla cerrado si falta la configuración antes de crear un transporte', async () => {
    vi.stubEnv('EMAIL_PASS', '');
    const { getMailTransporter } = await cargarMailer();

    expect(() => getMailTransporter()).toThrow('Configuración de email incompleta');
    expect(mocks.createTransport).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
