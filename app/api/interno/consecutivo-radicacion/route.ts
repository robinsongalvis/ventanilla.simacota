import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  abrirSerieRadicadosUnaVez,
  AperturaSerieRadicadosError,
  obtenerEstadoAperturaRadicados,
} from '@/lib/server/apertura-series';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';

/* ══════════════════════════════════════════════════════════════
   Apertura única de la serie de radicación de contingencia.

   Esta ruta NO es un ajuste reutilizable. Un ADMIN confirma el PRIMER número
   que emitirá la plataforma; la transacción deja el counter en N-1 y bloquea
   de forma inmutable la apertura. Repetir N es idempotente, intentar otro N
   recibe 409. La apertura no crea radicado ni reserva: N continúa disponible
   hasta que una radicación interna real se confirme.
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

function responderError(error: unknown, fallback: string): NextResponse {
  if (error instanceof AperturaSerieRadicadosError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** Estado de solo lectura de la apertura y el próximo número. */
export async function GET(): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;
  if (usuario.rol !== 'ADMIN') {
    return NextResponse.json({ error: 'Su rol no puede consultar la apertura de la serie.' }, { status: 403 });
  }

  try {
    const estado = await obtenerEstadoAperturaRadicados(getFirebaseAdminDb());
    return NextResponse.json(estado);
  } catch (error) {
    return responderError(error, 'No fue posible consultar la apertura de la serie.');
  }
}

/** Confirma una sola vez el primer número que emitirá la plataforma. */
export async function POST(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;
  if (usuario.rol !== 'ADMIN') {
    return NextResponse.json({ error: 'Su rol no puede abrir la serie.' }, { status: 403 });
  }

  let primerNumero: unknown;
  try {
    const entrada: unknown = await request.json();
    if (entrada === null || typeof entrada !== 'object' || Array.isArray(entrada)) {
      return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
    }
    primerNumero = (entrada as Record<string, unknown>).primerNumero;
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  if (typeof primerNumero !== 'number') {
    return NextResponse.json(
      { error: 'El primer número debe enviarse como número entero.' },
      { status: 400 },
    );
  }

  try {
    const resultado = await abrirSerieRadicadosUnaVez({
      db: getFirebaseAdminDb(),
      primerNumero,
      actor: {
        uid: usuario.uid,
        nombre: usuario.nombre ?? null,
        rol: usuario.rol,
        tenantId: usuario.tenantId,
      },
    });
    return NextResponse.json(resultado);
  } catch (error) {
    return responderError(error, 'No fue posible abrir la serie.');
  }
}
