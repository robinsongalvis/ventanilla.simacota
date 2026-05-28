import { NextResponse } from 'next/server';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const {
      radicadoId,
      usuarioId,
      actorNombre,
      puntuacion, // 'POSITIVO' | 'CORREGIDO' | 'NEGATIVO'
      motivoCorreccion,
      clasificacionOriginal,
      clasificacionFinal,
      etiquetasIA,
      etiquetasFinales,
      resumenIA,
      resumenEditado,
      confianzaIA,
    } = payload;

    if (!radicadoId || !usuarioId || !puntuacion) {
      return NextResponse.json(
        { error: 'radicadoId, usuarioId y puntuacion son requeridos.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const ahora = new Date().toISOString();
    const feedbackId = `fb_${radicadoId}_${Date.now()}`;

    // 1. Registrar evaluación en la colección 'ai_feedback'
    const feedbackDoc = {
      feedbackId,
      radicadoId,
      usuarioId,
      actorNombre: actorNombre || 'Funcionario',
      puntuacion,
      motivoCorreccion: motivoCorreccion || null,
      fecha: ahora,
    };
    await setDoc(doc(db, 'ai_feedback', feedbackId), feedbackDoc);

    // 2. Actualizar el radicado en 'ventanilla_radicados' con la evaluación
    const radRef = doc(db, 'ventanilla_radicados', radicadoId);
    await updateDoc(radRef, {
      feedbackIa: {
        usuarioId,
        actorNombre: actorNombre || 'Funcionario',
        puntuacion,
        motivoCorreccion: motivoCorreccion || null,
        fecha: ahora,
      },
    });

    // 3. Si hubo corrección, registrar auditoría en la colección 'ai_auditoria'
    if (puntuacion === 'CORREGIDO' || clasificacionOriginal !== clasificacionFinal) {
      const auditoriaId = `aud_${radicadoId}_${Date.now()}`;
      const auditoriaDoc = {
        auditoriaId,
        radicadoId,
        timestamp: ahora,
        promptVersion: 'simi-classifier-v1.0',
        clasificacionOriginal: clasificacionOriginal || null,
        clasificacionFinal: clasificacionFinal || null,
        confianzaIA: confianzaIA || null,
        resumenIA: resumenIA || null,
        resumenEditado: resumenEditado || null,
        etiquetasIA: etiquetasIA || [],
        etiquetasFinales: etiquetasFinales || [],
        accionFuncionario: puntuacion === 'CORREGIDO' ? 'MODIFICADO' : 'ACEPTADO',
        motivoCorreccion: motivoCorreccion || 'Traslado o re-enrutamiento manual.',
      };
      await setDoc(doc(db, 'ai_auditoria', auditoriaId), auditoriaDoc);
    }

    return NextResponse.json({ exito: true, feedbackId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error en /api/ai/feedback:', msg);
    return NextResponse.json(
      { error: 'Error al registrar feedback de IA.', detalles: msg },
      { status: 500 }
    );
  }
}
