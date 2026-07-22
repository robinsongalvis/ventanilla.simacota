import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Endpoint diagnóstico SEV-1 (rama diagnostico/sev1-runtime, solo preview).
 * Hace que el propio proceso de la Function declare su runtime real:
 * versión de Node, execArgv (¿flag --no-experimental-require-module?),
 * estado de la feature require(esm) y el resultado de require('jose').
 * Evidencia exigida por el propietario antes de aceptar la causa raíz.
 */
export async function GET() {
  const features = (process as unknown as { features?: Record<string, unknown> }).features;
  const info: Record<string, unknown> = {
    marcador: 'DIAGNOSTICO_SEV1_RUNTIME',
    nodeVersion: process.version,
    execArgv: process.execArgv,
    nodeOptionsEnv: process.env.NODE_OPTIONS ?? null,
    featureRequireModule: features?.require_module ?? null,
    vercelRegion: process.env.VERCEL_REGION ?? null,
    fechaUtc: new Date().toISOString(),
  };
  try {
    const { createRequire } = await import('node:module');
    const requireReal = createRequire(process.cwd() + '/package.json');
    requireReal('jose');
    info.requireJose = 'OK';
  } catch (e) {
    info.requireJose = `FALLO: ${String(e)}`;
  }
  try {
    await import('firebase-admin/auth');
    info.importFirebaseAdminAuth = 'OK';
  } catch (e) {
    info.importFirebaseAdminAuth = `FALLO: ${String(e)}`;
  }
  console.log('DIAGNOSTICO_SEV1_RUNTIME', JSON.stringify(info));
  return NextResponse.json(info);
}
