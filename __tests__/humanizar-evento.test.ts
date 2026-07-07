import { describe, expect, it } from 'vitest';
import type { TrazabilidadRadicado } from '@/src/types/ventanilla';
import { construirHistoria } from '@/lib/trazabilidad/humanizar-evento';

/* ══════════════════════════════════════════════════════════════
   Sprint Panel claro — la trazabilidad contada en humano.

   El caso principal reproduce la secuencia REAL del radicado
   1-OFICIO-2026-00000021 del pantallazo del user: radicación,
   anotación de datos, dos traslados y sus dos correos automáticos.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-07T01:30:00.000Z'); // 6 jul, 8:30 pm Colombia

function evento(overrides: Partial<TrazabilidadRadicado>): TrazabilidadRadicado {
  return {
    eventoId: `ev_${Math.random()}`,
    fecha: '2026-07-06T22:16:00.000Z', // 5:16 pm Colombia
    accion: 'RADICACION',
    actorUid: 'uid-laura',
    actorNombre: 'Laura',
    nota: '',
    ...overrides,
  } as TrazabilidadRadicado;
}

const SECUENCIA_REAL: TrazabilidadRadicado[] = [
  evento({
    accion: 'RADICACION',
    fecha: '2026-07-06T22:16:00.000Z',
    nota: 'Radicado por Laura · Canal: Oficio físico · Dirigido a: Secretaría de Hacienda',
  }),
  evento({
    accion: 'DATOS_NO_APORTADOS_MARCADOS',
    fecha: '2026-07-06T22:16:30.000Z',
    nota: 'El solicitante no aportó: documento.',
  }),
  evento({
    accion: 'ASIGNACION',
    fecha: '2026-07-06T22:20:00.000Z',
    actorNombre: 'Oscar Vargas',
    oficinaOrigen: 'SEC_HACIENDA',
    oficinaDestino: 'SEC_HACIENDA',
    nota: 'Trasladado a Secretaría de Hacienda por Oscar Vargas',
  }),
  evento({
    accion: 'NOTIFICACION_CORREO_ENVIADA',
    fecha: '2026-07-06T22:20:10.000Z',
    actorNombre: 'Sistema',
    nota: 'Correo (ASIGNACION) enviado a davidgalvis1519@gmail.com',
  }),
  evento({
    accion: 'ASIGNACION',
    fecha: '2026-07-07T00:56:00.000Z', // 7:56 pm Colombia
    oficinaOrigen: 'SEC_HACIENDA',
    oficinaDestino: 'SEC_PLANEACION',
    nota: 'Trasladado a Secretaría de Planeación por Laura',
  }),
  evento({
    accion: 'NOTIFICACION_CORREO_ENVIADA',
    fecha: '2026-07-07T00:56:10.000Z',
    actorNombre: 'Sistema',
    nota: 'Correo (ASIGNACION) enviado a davidgalvis1519@gmail.com',
  }),
];

describe('Panel claro — construirHistoria', () => {
  /* 1 · los códigos se vuelven frases */
  it('traduce cada código a un título humano', () => {
    const [dia] = construirHistoria(SECUENCIA_REAL, AHORA);
    const titulos = dia.eventos.map((e) => e.titulo);
    expect(titulos).toContain('Radicado en la Ventanilla Única');
    expect(titulos).toContain('Trasladado a Secretaría de Planeación');
    expect(titulos).toContain('Anotación: datos que el solicitante no aportó');
    expect(titulos.join(' ')).not.toMatch(/[A-Z]+_[A-Z]+/); // cero SCREAMING_SNAKE
  });

  /* 2 · los correos automáticos se pliegan en su actuación causante */
  it('pliega los 2 correos dentro de sus traslados: 6 eventos quedan en 4', () => {
    const [dia] = construirHistoria(SECUENCIA_REAL, AHORA);
    expect(dia.eventos).toHaveLength(4);
    const traslado = dia.eventos.find((e) => e.titulo.includes('Planeación'));
    expect(traslado?.correos).toEqual([{ texto: 'Se avisó al ciudadano por correo' }]);
  });

  /* 3 · misma dependencia: sin flecha redundante */
  it('una asignación Hacienda→Hacienda dice "Asignado dentro de" sin flechas', () => {
    const [dia] = construirHistoria(SECUENCIA_REAL, AHORA);
    const interna = dia.eventos.find((e) => e.titulo.startsWith('Asignado dentro'));
    expect(interna?.titulo).toBe('Asignado dentro de Secretaría de Hacienda');
    expect(interna?.detalle ?? '').not.toContain('→');
  });

  /* 4 · traslado real: destino en el título, origen en el detalle */
  it('un traslado entre dependencias muestra destino y desde dónde', () => {
    const [dia] = construirHistoria(SECUENCIA_REAL, AHORA);
    const traslado = dia.eventos.find((e) => e.titulo === 'Trasladado a Secretaría de Planeación');
    expect(traslado?.detalle).toBe('Desde Secretaría de Hacienda');
    expect(traslado?.tono).toBe('AZUL');
  });

  /* 5 · agrupación por día colombiano con "Hoy" */
  it('agrupa todo en "Hoy · 6 de julio" aunque cruce medianoche UTC', () => {
    const dias = construirHistoria(SECUENCIA_REAL, AHORA);
    expect(dias).toHaveLength(1);
    expect(dias[0].etiqueta).toBe('Hoy · 6 de julio');
    // Reciente primero dentro del día.
    expect(dias[0].eventos[0].titulo).toBe('Trasladado a Secretaría de Planeación');
  });

  /* 6 · un correo FALLIDO jamás se pliega: es alerta roja */
  it('el correo fallido queda como evento propio en rojo', () => {
    const conFallo = [...SECUENCIA_REAL, evento({
      accion: 'NOTIFICACION_CORREO_FALLIDA',
      fecha: '2026-07-07T00:56:20.000Z',
      actorNombre: 'Sistema',
      nota: 'SMTP no disponible',
    })];
    const [dia] = construirHistoria(conFallo, AHORA);
    const fallo = dia.eventos.find((e) => e.tono === 'ROJO');
    expect(fallo?.titulo).toBe('El correo al ciudadano falló');
  });

  /* 7 · filtro "Solo actuaciones" oculta correos huérfanos */
  it('con filtro ACTUACIONES los correos sueltos desaparecen', () => {
    const conHuerfano = [...SECUENCIA_REAL, evento({
      accion: 'NOTIFICACION_CORREO_ENVIADA',
      fecha: '2026-07-06T20:00:00.000Z', // lejos de toda actuación
      actorNombre: 'Sistema',
      nota: 'Correo suelto',
    })];
    const todo = construirHistoria(conHuerfano, AHORA)[0].eventos;
    const actuaciones = construirHistoria(conHuerfano, AHORA, 'ACTUACIONES')[0].eventos;
    expect(todo).toHaveLength(5);        // el huérfano se muestra en TODO
    expect(actuaciones).toHaveLength(4); // y desaparece en ACTUACIONES
  });

  /* 8 · filtro "Correos" muestra solo lo relacionado con correos */
  it('con filtro CORREOS quedan los eventos con correo', () => {
    const correos = construirHistoria(SECUENCIA_REAL, AHORA, 'CORREOS')[0].eventos;
    expect(correos).toHaveLength(2); // los dos traslados que avisaron
    expect(correos.every((e) => e.correos.length > 0)).toBe(true);
  });

  /* 9 · un código futuro desconocido no revienta ni grita */
  it('un código no catalogado se muestra legible en gris', () => {
    const [dia] = construirHistoria([evento({
      accion: 'EVENTO_NUEVO_RARO' as TrazabilidadRadicado['accion'],
      nota: 'detalle',
    })], AHORA);
    expect(dia.eventos[0].titulo).toBe('Evento nuevo raro');
    expect(dia.eventos[0].tono).toBe('GRIS');
  });

  /* 10 · días distintos, etiquetas distintas */
  it('separa días y etiqueta el anterior como "Ayer"', () => {
    const dosDias = [
      evento({ fecha: '2026-07-06T22:00:00.000Z' }),               // hoy 6 jul
      evento({ accion: 'PRORROGA', fecha: '2026-07-05T15:00:00.000Z', nota: '5 días más' }),
    ];
    const dias = construirHistoria(dosDias, AHORA);
    expect(dias).toHaveLength(2);
    expect(dias[0].etiqueta).toBe('Hoy · 6 de julio');
    expect(dias[1].etiqueta).toBe('Ayer · 5 de julio');
  });
});
