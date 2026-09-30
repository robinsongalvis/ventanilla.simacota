import { NextResponse } from 'next/server';
import { puedeMoverConsecutivoRadicacion } from '@/lib/permisos/consecutivo-radicacion';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { atLocalNoon } from '@/lib/tiempos-radicado';
import {
  describirEstado,
  esConsecutivoValido,
  validarAjusteConsecutivo,
  type AuditoriaAjusteConsecutivo,
} from '@/lib/server/ajuste-consecutivo-radicacion';

/* ══════════════════════════════════════════════════════════════
   Consecutivo de radicación — consulta y ajuste de relevo.

   Sirve al cambio de software de la Alcaldía: el sistema anterior sigue
   emitiendo hasta el día del corte, y cuál fue su último radicado solo se sabe
   ese día, mirando el libro de ventanilla. Esta ruta permite que quien lo
   tiene delante —administración o la propia ventanilla— lo declare, para que la
   numeración continúe sin huecos y sin repetir.

   GUARDAS, en orden:
    1. Sesión interna activa y rol autorizado — administración y ventanilla,
       según `puedeMoverConsecutivoRadicacion`: un consecutivo mal movido
       falsea el registro público del municipio.
    2. Solo AVANZA (`validarAjusteConsecutivo`): retroceder reemitiría números
       que ya están en manos de ciudadanos.
    3. El próximo radicado no puede existir ya como documento.
    4. Lectura y escritura en la MISMA transacción: entre leer el contador y
       escribirlo puede entrar una radicación real, y sin transacción el ajuste
       la pisaría.
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

function refContador(db: FirebaseFirestore.Firestore, anio: number) {
  return db.collection('counters').doc(`radicados-${anio}`);
}

/** Estado actual: en cuánto va y qué radicado saldría ahora. */
export async function GET(): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;
  if (!puedeMoverConsecutivoRadicacion(usuario.rol)) {
    return NextResponse.json({ error: 'Su rol no puede consultar el consecutivo.' }, { status: 403 });
  }
  try {
    const db = getFirebaseAdminDb();
    const ahora = new Date();
    const anio = atLocalNoon(ahora).getFullYear();
    const snap = await refContador(db, anio).get();
    const ultimo: unknown = snap.exists ? snap.data()?.ultimo : 0;
    if (!esConsecutivoValido(ultimo)) {
      return NextResponse.json({ error: 'El contador actual es inválido. Se requiere revisión antes de ajustarlo.' }, { status: 409 });
    }

    return NextResponse.json({ ok: true, ...describirEstado(anio, ultimo, ahora) });
  } catch {
    return NextResponse.json({ error: 'No fue posible consultar el consecutivo.' }, { status: 500 });
  }
}

/** Declara el último consecutivo del sistema anterior. El próximo radicado será ese + 1. */
export async function POST(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;
  if (!puedeMoverConsecutivoRadicacion(usuario.rol)) {
    return NextResponse.json({ error: 'Su rol no puede ajustar el consecutivo.' }, { status: 403 });
  }

  let cuerpo: { ultimoDelSistemaAnterior?: unknown; motivo?: unknown };
  try {
    const entrada: unknown = await request.json();
    if (entrada === null || typeof entrada !== 'object' || Array.isArray(entrada)) {
      return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
    }
    cuerpo = entrada;
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

  const ahora = new Date();
  const anio = atLocalNoon(ahora).getFullYear();

  try {
    const db = getFirebaseAdminDb();
    // Un id estable en los reintentos de la transacción, distinto para cada ajuste.
    const auditoriaRef = db.collection('admin_auditoria').doc();
    const resultado = await db.runTransaction(async (tx) => {
      const ref = refContador(db, anio);
      const snap = await tx.get(ref);
      const actual: unknown = snap.exists ? snap.data()?.ultimo : 0;
      if (!esConsecutivoValido(actual)) {
        return { error: { status: 409, mensaje: 'El contador actual es inválido. Se requiere revisión antes de ajustarlo.' } };
      }

      const nuevo = cuerpo.ultimoDelSistemaAnterior;
      const error = validarAjusteConsecutivo(actual, nuevo);
      if (error) return { error };

      const estado = describirEstado(anio, nuevo as number, ahora);
      const idProximo = estado.proximoRadicado;

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

      const auditoria: AuditoriaAjusteConsecutivo = {
        accion: 'CONSECUTIVO_RADICACION_AJUSTADO',
        actorUid: usuario.uid,
        actorNombre: usuario.nombre ?? null,
        actorRol: usuario.rol,
        tenantId: usuario.tenantId,
        fecha: ahora.toISOString(),
        metadata: { serie: 'radicados', anio, anterior: actual, nuevo: nuevo as number, motivo, proximoRadicado: idProximo },
      };
      tx.create(auditoriaRef, auditoria);

      return { ok: true as const, anterior: actual, ...estado };
    });

    if ('error' in resultado && resultado.error) {
      return NextResponse.json({ error: resultado.error.mensaje }, { status: resultado.error.status });
    }
    return NextResponse.json(resultado);
  } catch {
    return NextResponse.json({ error: 'No fue posible ajustar el consecutivo.' }, { status: 500 });
  }
}
