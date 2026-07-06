import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { generarRadicadoSalida } from '@/lib/salidas/radicado-salida';
import {
  construirDocSalida,
  construirNotaSalida,
  validarSalida,
  type EntradaSalida,
} from '@/lib/salidas/construir-salida';
import type { TrazabilidadRadicado } from '@/src/types/ventanilla';
import type { SalidaOficial } from '@/src/types/salida';

/**
 * Sprint Radicación de salida — registrar un despacho.
 *
 * Mismo patrón client-side de radicarInstitucionalmente: el consecutivo
 * sale de una transacción sobre counters/salidas-{año}, el documento se
 * crea en ventanilla_salidas (reglas: solo ADMIN/RECEPCIONISTA crean;
 * el libro es inmutable) y, cuando la salida responde a un radicado de
 * entrada, el amarre queda escrito en la trazabilidad de la entrada
 * con el evento OFICIO_SALIDA_REGISTRADO.
 */

export class SalidaValidacionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SalidaValidacionError';
  }
}

export async function registrarSalida(
  datos: EntradaSalida,
  actor: { uid: string; nombre: string },
): Promise<{ salidaId: string; consecutivo: number; salida: SalidaOficial }> {
  const error = validarSalida(datos);
  if (error) throw new SalidaValidacionError(error);

  const ahora = new Date();
  const { consecutivo, salidaId } = await generarRadicadoSalida(ahora);
  const salida = construirDocSalida(datos, salidaId, consecutivo, actor, ahora);

  await setDoc(doc(getDb(), 'ventanilla_salidas', salidaId), salida);

  // El amarre: la historia del radicado de entrada muestra el despacho.
  if (salida.radicadoEntradaId) {
    await addDoc(
      collection(getDb(), 'ventanilla_radicados', salida.radicadoEntradaId, 'trazabilidad'),
      {
        eventoId: `ev_${salida.radicadoEntradaId}_SALIDA_${consecutivo}`,
        fecha: ahora.toISOString(),
        accion: 'OFICIO_SALIDA_REGISTRADO',
        actorUid: actor.uid,
        actorNombre: actor.nombre,
        nota: construirNotaSalida(
          salidaId,
          salida.destinatario.nombre,
          salida.dependenciaOrigen,
        ),
        metadata: { salidaId },
      } satisfies TrazabilidadRadicado,
    );
  }

  // El documento completo alimenta la constancia de despacho (Fase B).
  return { salidaId, consecutivo, salida };
}
