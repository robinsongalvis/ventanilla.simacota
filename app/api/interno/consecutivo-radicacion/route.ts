import { NextResponse } from 'next/server';
import { requireActiveInternalUser } from '@/lib/server/internal-auth';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { formatearRadicadoInstitucional } from '@/lib/radicado-institucional';
import {
  describirEstado,
  validarAjusteConsecutivo,
} from '@/lib/server/ajuste-consecutivo-radicacion';

/* ══════════════════════════════════════════════════════════════
   Consecutivo de radicación — consulta y ajuste de relevo.

   Sirve al cambio de software de la Alcaldía: el sistema anterior sigue
   emitiendo hasta el día del corte, y cuál fue su último radicado solo se sabe
   ese día, mirando el libro de ventanilla. Esta ruta permite que una persona
   con rol de administración lo declare, para que la numeración continúe sin
   huecos y sin repetir.

   GUARDAS, en orden:
    1. Sesión interna activa y rol autorizado — un consecutivo mal movido
       falsea el registro público del municipio.
    2. Solo AVANZA (`validarAjusteConsecutivo`): retroceder reemitiría números
       que ya están en manos de ciudadanos.
    3. El próximo radicado no puede existir ya como documento.
    4. Lectura y escritura en la MISMA transacción: entre leer el contador y
       escribirlo puede entrar una radicación real, y sin transacción el ajuste
       la pisaría.
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

/** Quién puede mover el consecutivo. Deliberadamente corto. */
const ROLES_AUTORIZADOS = new Set<string>(['ADMIN', 'SUPER_ADMIN', 'DESARROLLADOR']);

function refContador(db: FirebaseFirestore.Firestore, anio: number) {
  return db.collection('counters').doc(`radicados-${anio}`);
}

/** Estado actual: en cuánto va y qué radicado saldría ahora. */
export async function GET(): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (!ROLES_AUTORIZADOS.has(usuario.rol)) {
      return NextResponse.json({ error: 'Su rol no puede consultar el consecutivo.' }, { status: 403 });
    }

    const db = getFirebaseAdminDb();
    const anio = new Date().getFullYear();
    const snap = await refContador(db, anio).get();
    const ultimo = snap.exists ? Number(snap.data()?.ultimo ?? 0) : 0;

    return NextResponse.json({ ok: true, ...describirEstado(anio, ultimo) });
  } catch {
    return NextResponse.json({ error: 'No fue posible consultar el consecutivo.' }, { status: 500 });
  }
}

/** Declara el último consecutivo del sistema anterior. El próximo radicado será ese + 1. */
export async function POST(request: Request): Promise<NextResponse> {
  let usuario;
  try {
    usuario = await requireActiveInternalUser();
  } catch {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  if (!ROLES_AUTORIZADOS.has(usuario.rol)) {
    return NextResponse.json({ error: 'Su rol no puede ajustar el consecutivo.' }, { status: 403 });
  }

  let cuerpo: { ultimoDelSistemaAnterior?: unknown; motivo?: unknown };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const motivo = typeof cuerpo.motivo === 'string' ? cuerpo.motivo.trim() : '';
  if (motivo.length < 10) {
    // El motivo no es burocracia: es lo que explica el salto a quien audite el
    // libro dentro de dos años, cuando nadie recuerde por qué faltan números.
    return NextResponse.json(
      { error: 'Explique brevemente el motivo del ajuste (mínimo 10 caracteres).' },
      { status: 400 },
    );
  }

  const db = getFirebaseAdminDb();
  const anio = new Date().getFullYear();
  const ahora = new Date();

  try {
    const resultado = await db.runTransaction(async (tx) => {
      const ref = refContador(db, anio);
      const snap = await tx.get(ref);
      const actual = snap.exists ? Number(snap.data()?.ultimo ?? 0) : 0;

      const nuevo = cuerpo.ultimoDelSistemaAnterior;
      const error = validarAjusteConsecutivo(actual, nuevo);
      if (error) return { error };

      const siguiente = (nuevo as number) + 1;
      const idProximo = formatearRadicadoInstitucional(siguiente, ahora);

      // Un radicado con ese id ya existente significaría que el número está
      // usado: emitirlo otra vez crearía dos trámites con la misma identidad.
      const choque = await tx.get(db.collection('ventanilla_radicados').doc(idProximo));
      if (choque.exists) {
        return {
          error: {
            status: 409,
            mensaje: `Ya existe un radicado con el número ${idProximo}. Verifique el dato del libro.`,
          },
        };
      }

      tx.set(ref, {
        ultimo: nuevo as number,
        anio,
        actualizadoEn: ahora.toISOString(),
        ultimoAjusteManual: {
          anterior: actual,
          nuevo: nuevo as number,
          motivo,
          por: { uid: usuario.uid, nombre: usuario.nombre ?? null, rol: usuario.rol },
          fecha: ahora.toISOString(),
        },
      }, { merge: true });

      return { ok: true as const, anterior: actual, ...describirEstado(anio, nuevo as number, ahora) };
    });

    if ('error' in resultado && resultado.error) {
      return NextResponse.json({ error: resultado.error.mensaje }, { status: resultado.error.status });
    }
    return NextResponse.json(resultado);
  } catch {
    return NextResponse.json({ error: 'No fue posible ajustar el consecutivo.' }, { status: 500 });
  }
}
