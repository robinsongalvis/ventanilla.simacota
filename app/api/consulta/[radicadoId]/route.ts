import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Link: '</api/public/radicado/consulta>; rel="successor-version"',
};

/**
 * Endpoint retirado por H-03. Nunca delega una consulta sin segundo factor.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    error: 'Esta ruta de consulta fue retirada. Utilice el formulario seguro en /consulta.',
  }, { status: 410, headers: HEADERS });
}

export async function POST(): Promise<NextResponse> {
  return NextResponse.json({
    error: 'Esta ruta de consulta fue retirada. Utilice el formulario seguro en /consulta.',
  }, { status: 410, headers: HEADERS });
}
