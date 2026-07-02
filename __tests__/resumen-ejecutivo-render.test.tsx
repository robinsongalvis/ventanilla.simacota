import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';
import { ResumenEjecutivoRadicado } from '@/app/interno/dashboard/components/ResumenEjecutivoRadicado';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Fase 1 — tests de render del componente.

   Verifican que el resumen ejecutivo muestra las señales visuales
   esperadas según el estado del radicado (sin asignar, alerta de
   correo, datos incompletos, sellados, etc.).
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-02T15:00:00.000Z');

function fechaVencimientoEn(dias: number, ref: Date = AHORA): string {
  const d = new Date(ref);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

function radicadoBase(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId:          '1-OFICIO-2026-00000042',
    estadoActual:        'EN_PROCESO',
    ultimaActualizacion: AHORA.toISOString(),
    prioridad:           'AMARILLO',
    esAnonimo:           false,
    tipoPresentacion:    'IDENTIFICADA',
    identidadReservada:  false,
    canalRespuesta:      'CORREO',
    solicitante: {
      tipoPersona:     'NATURAL',
      tipoDocumento:   'CC',
      numeroDocumento: '1098765432',
      nombreCompleto:  'María Pérez',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId:     '1-OFICIO-2026-00000042',
      consecutivo:    42,
      fechaRadicado:  '2026-06-30T08:42:00.000Z',
      horaRadicado:   '08:42',
      medioRecepcion: 'PRESENCIAL',
      origen:         'FISICO_ESCANER',
    },
    termino: {
      tipoSolicitudId:     'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta:       15,
      unidad:              'HABILES',
      fechaVencimiento:    fechaVencimientoEn(10),
      prorrogasAplicadas:  0,
    },
    clasificacion: {
      oficinaDestino: 'SEC_GOBIERNO',
      zonaGeografica: 'CASCO_URBANO',
      funcionarioResponsableNombre: 'Ana López',
    },
    detalle: {
      asunto:       'Certificado de residencia',
      descripcion:  'Descripción',
      numeroFolios: 2,
    },
    archivos: [],
    ...overrides,
  };
}

describe('Panel Op Fase 1 — ResumenEjecutivoRadicado', () => {
  /* 1 · Vista base: radicado, solicitante, dependencia, responsable, tipo */
  it('renderiza los datos claves del radicado activo', () => {
    render(
      <ResumenEjecutivoRadicado
        radicado={radicadoBase()}
        ultimoEvento={null}
        ahora={AHORA}
      />,
    );
    expect(screen.getByText('1-OFICIO-2026-00000042')).toBeTruthy();
    expect(screen.getByText('María Pérez')).toBeTruthy();
    expect(screen.getByText(/Secretaría de Gobierno/i)).toBeTruthy();
    expect(screen.getByText('Ana López')).toBeTruthy();
    expect(screen.getByText(/Petición general/i)).toBeTruthy();
  });

  /* 2 · Sin responsable → chip visual y label "Sin asignar" en cursiva */
  it('muestra "Sin asignar" cuando el radicado no tiene responsable', () => {
    const r = radicadoBase({
      clasificacion: {
        oficinaDestino: 'SEC_GOBIERNO',
        zonaGeografica: 'CASCO_URBANO',
        // funcionarioResponsableNombre ausente
      },
    });
    render(<ResumenEjecutivoRadicado radicado={r} ultimoEvento={null} ahora={AHORA} />);
    expect(screen.getByText('Sin asignar')).toBeTruthy();
  });

  /* 3 · Alerta de correo institucional fallido → chip rojo */
  it('muestra chip cuando alertaNotificacionFallida es true', () => {
    const r = radicadoBase({ alertaNotificacionFallida: true });
    render(<ResumenEjecutivoRadicado radicado={r} ultimoEvento={null} ahora={AHORA} />);
    expect(screen.getByText(/Correo institucional falló/i)).toBeTruthy();
  });

  /* 4 · Datos incompletos → chip amarillo */
  it('muestra chip "Datos incompletos" cuando el solicitante lo marcó', () => {
    const r = radicadoBase({
      solicitante: {
        ...radicadoBase().solicitante,
        datosNoAportados: { correo: true, telefono: false, direccion: false, documento: false },
      },
    });
    render(<ResumenEjecutivoRadicado radicado={r} ultimoEvento={null} ahora={AHORA} />);
    expect(screen.getByText(/Datos incompletos/i)).toBeTruthy();
  });

  /* 5 · Con archivos y sellados → chips separados */
  it('muestra chips de anexos y sellados con los conteos correctos', () => {
    const r = radicadoBase({
      archivos: [
        { nombre: 'a.pdf', path: 'radicados/1/a.pdf', tipo: 'application/pdf', tamanioKB: 100, orden: 1,
          sellado: { path: 'sellados/1/a.pdf', nombre: 'a.pdf', tamanioKB: 105, fecha: AHORA.toISOString(),
                     actorUid: 'u', hashOriginal: 'h1', hashSellado: 'h2', paginasEstampadas: 1 } },
        { nombre: 'b.pdf', path: 'radicados/1/b.pdf', tipo: 'application/pdf', tamanioKB: 200, orden: 2 },
      ],
    });
    render(<ResumenEjecutivoRadicado radicado={r} ultimoEvento={null} ahora={AHORA} />);
    expect(screen.getByText('2 anexos')).toBeTruthy();
    expect(screen.getByText(/1 sellado/i)).toBeTruthy();
  });

  /* 6 · Última actuación desde el evento pasado por prop */
  it('muestra el label del último evento y su fecha relativa', () => {
    const evento: TrazabilidadRadicado = {
      fecha:       '2026-07-02T14:30:00.000Z',
      accion:      'CONSTANCIA_ENVIADA_CORREO',
      actorUid:    'u',
      actorNombre: 'Funcionaria',
      nota:        'Constancia enviada',
    };
    render(
      <ResumenEjecutivoRadicado
        radicado={radicadoBase()}
        ultimoEvento={evento}
        ahora={AHORA}
      />,
    );
    expect(screen.getByText('Constancia enviada por correo')).toBeTruthy();
    expect(screen.getByText(/hace 30 min/i)).toBeTruthy();
  });

  /* 7 · Próxima acción coherente con el estado */
  it('muestra la próxima acción según el estado (EN_REVISION → proyectar respuesta)', () => {
    const r = radicadoBase({ estadoActual: 'EN_REVISION' });
    render(<ResumenEjecutivoRadicado radicado={r} ultimoEvento={null} ahora={AHORA} />);
    expect(screen.getByText(/proyectar respuesta/i)).toBeTruthy();
  });
});
