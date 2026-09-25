import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/* ══════════════════════════════════════════════════════════════
   TRANSPORTER SINGLETON
   Crea el transporter una vez por proceso (hot-reload safe).
   Compatible con Gmail (App Password), Outlook, o cualquier
   servidor SMTP institucional.
══════════════════════════════════════════════════════════════ */

let _transporter: Transporter | null = null;

export function getMailTransporter(): Transporter {
  if (_transporter) return _transporter;

  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT ?? 587);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      'Configuración de email incompleta. ' +
      'Verifique EMAIL_HOST, EMAIL_USER y EMAIL_PASS en las variables de entorno.',
    );
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,   // true para 465 (SSL), false para 587 (STARTTLS)
    auth: { user, pass },
  });

  return _transporter;
}

export interface EnvioEmailParams {
  to:      string;
  subject: string;
  html:    string;
  replyTo?: string;
}

export async function enviarEmail(params: EnvioEmailParams): Promise<void> {
  const from = process.env.EMAIL_FROM ?? process.env.EMAIL_USER;
  if (!from) throw new Error('EMAIL_FROM o EMAIL_USER no configurado.');

  const transporter = getMailTransporter();
  await transporter.sendMail({
    from,
    to:      params.to,
    subject: params.subject,
    html:    params.html,
    replyTo: params.replyTo,
  });
}
