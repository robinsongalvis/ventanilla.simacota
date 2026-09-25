import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SelloDespacho } from '@/app/interno/dashboard/components/salidas/SelloDespacho';
import type { SalidaOficial } from '@/src/types/salida';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Fase B de salidas — constancia de despacho imprimible.
══════════════════════════════════════════════════════════════ */

const SALIDA: SalidaOficial = {
  salidaId:      '2-SAL-2026-00000012',
  consecutivo:   12,
  fechaSalida:   '2026-07-01T14:30:00.000Z',
  tipoSalida:    'RESPUESTA',
  radicadoEntradaId: '1-WEB-2026-00000034',
  destinatario:  { nombre: 'María Rodríguez', entidad: 'Gobernación de Santander', email: null, direccion: null },
  asunto:        'Respuesta a su solicitud',
  dependenciaOrigen: 'SEC_PLANEACION',
  firmante:      { uid: 'uid-1', nombre: 'Carlos Méndez' },
  medioEnvio:    'FISICO',
  registradoPor: { uid: 'uid-laura', nombre: 'Laura' },
  archivoPath:   null,
};

describe('Fase B — SelloDespacho', () => {
  /* 1 · el sello trae los datos del despacho */
  it('muestra número 2-SAL, destinatario, medio y firmante', () => {
    render(<SelloDespacho salida={SALIDA} />);
    expect(screen.getByText('2-SAL-2026-00000012')).toBeTruthy();
    expect(screen.getByText(/María Rodríguez \(Gobernación de Santander\)/)).toBeTruthy();
    expect(screen.getByText(/Correo físico/)).toBeTruthy();
    expect(screen.getByText(/Firma: Carlos Méndez/)).toBeTruthy();
  });

  /* 2 · una respuesta muestra el amarre a la entrada */
  it('muestra el radicado de entrada cuando es respuesta', () => {
    render(<SelloDespacho salida={SALIDA} />);
    expect(screen.getByText(/Responde al radicado: 1-WEB-2026-00000034/)).toBeTruthy();
  });

  /* 3 · un oficio independiente no inventa amarre */
  it('sin radicado de entrada no muestra la línea del amarre', () => {
    render(
      <SelloDespacho
        salida={{ ...SALIDA, tipoSalida: 'OFICIO_INDEPENDIENTE', radicadoEntradaId: null }}
      />,
    );
    expect(screen.queryByText(/Responde al radicado/)).toBeNull();
  });

  /* 4 · el botón de imprimir está presente */
  it('ofrece el botón de imprimir la constancia', () => {
    render(<SelloDespacho salida={SALIDA} />);
    expect(screen.getByRole('button', { name: /Imprimir constancia de despacho/i })).toBeTruthy();
  });
});
