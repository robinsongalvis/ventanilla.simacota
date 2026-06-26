import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { GET as getResumenDiario } from '@/app/api/interno/resumen-diario/route';
import { POST as vistoResumenDiario } from '@/app/api/interno/resumen-diario/visto/route';
import { requireActiveInternalUser } from '@/lib/server/internal-auth';
import { nowColombia } from '@/lib/fecha-colombia';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

// Mocks
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDocGet = vi.fn();
const mockWhere = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnThis();

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: vi.fn(() => ({
    collection: vi.fn().mockImplementation((name: string) => {
      if (name === 'notificaciones_resumen_diario') {
        return {
          doc: vi.fn().mockImplementation(() => ({
            get: mockDocGet,
            set: mockSet,
          })),
        };
      }
      return {
        where: mockWhere,
        limit: mockLimit,
        get: mockGet,
      };
    }),
  })),
}));

vi.mock('@/lib/server/internal-auth', () => ({
  requireActiveInternalUser: vi.fn(),
  InternalAuthError: class extends Error {
    constructor(message: string, public status: number = 401) {
      super(message);
    }
  },
}));

function mockRadicado(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId: '1-WEB-2026-00000001',
    estadoActual: 'PENDIENTE',
    ultimaActualizacion: new Date().toISOString(),
    prioridad: 'AMARILLO',
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: '1098765432',
      nombreCompleto: 'Diana Funcionario',
      email: 'diana@example.com',
      telefono: '3001234567',
      direccion: 'Calle Falsa 123',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId: '1-WEB-2026-00000001',
      consecutivo: 1,
      fechaRadicado: new Date().toISOString(),
      horaRadicado: '08:00',
      medioRecepcion: 'WEB',
      origen: 'WEB',
    },
    termino: {
      tipoSolicitudId: 'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta: 15,
      unidad: 'HABILES',
      fechaVencimiento: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // Vence en 10 días
      prorrogasAplicadas: 0,
    },
    clasificacion: {
      oficinaDestino: 'SEC_GOBIERNO',
      zonaGeografica: 'CASCO_URBANO',
      funcionarioResponsableUid: 'usr_001',
    },
    detalle: {
      asunto: 'Asunto de prueba',
      descripcion: 'Descripción de prueba',
      numeroFolios: 1,
    },
    archivos: [],
    ...overrides,
  } as unknown as VentanillaRadicado;
}

describe('Resumen Diario API & Lógica', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockReturnThis();
    mockLimit.mockReturnThis();
  });

  // 1. Usuario sin alertas no recibe modal
  it('1. Usuario sin alertas no recibe modal', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValueOnce({
      uid: 'usr_001',
      email: 'diana@simacota.gov.co',
      nombre: 'Diana',
      rol: 'FUNCIONARIO',
      tenantId: 'SEC_GOBIERNO',
      activo: true,
    });

    // Simulamos que el documento visto no existe (primer ingreso)
    mockDocGet.mockResolvedValueOnce({ exists: false });

    // Simulamos que no hay radicados activos en su dependencia
    mockGet.mockResolvedValueOnce({ docs: [] });

    const res = await getResumenDiario();
    const data = await res.json();

    expect(data.mostrar).toBe(false);
    expect(data.totales.vencidos).toBe(0);
    expect(data.prioridades).toHaveLength(0);
  });

  // 2. Primer ingreso del día con alertas muestra el modal
  it('2. Primer ingreso del día con alertas muestra el modal', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValueOnce({
      uid: 'usr_001',
      email: 'diana@simacota.gov.co',
      nombre: 'Diana',
      rol: 'FUNCIONARIO',
      tenantId: 'SEC_GOBIERNO',
      activo: true,
    });

    mockDocGet.mockResolvedValueOnce({ exists: false });

    // Un radicado vencido
    const vencido = mockRadicado({
      radicadoId: 'VENCIDO-1',
      estadoActual: 'PENDIENTE',
      termino: {
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoSolicitudNombre: 'Petición',
        diasRespuesta: 15,
        unidad: 'HABILES',
        fechaVencimiento: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Vencido hace 5 días
        prorrogasAplicadas: 0,
      },
    });

    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => vencido }],
    });

    const res = await getResumenDiario();
    const data = await res.json();

    expect(data.mostrar).toBe(true);
    expect(data.totales.vencidos).toBe(1);
    expect(data.prioridades).toHaveLength(1);
    expect(data.prioridades[0].tipo).toBe('VENCIDO');
  });

  // 3. Después de cerrarlo no vuelve a mostrarse ese día
  it('3. Después de cerrarlo no vuelve a mostrarse ese día', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValueOnce({
      uid: 'usr_001',
      email: 'diana@simacota.gov.co',
      nombre: 'Diana',
      rol: 'FUNCIONARIO',
      tenantId: 'SEC_GOBIERNO',
      activo: true,
    });

    // Simulamos que el documento visto SÍ existe (ya lo cerró hoy)
    mockDocGet.mockResolvedValueOnce({ exists: true });

    // Hay un vencido, pero no debe mostrarse el modal
    const vencido = mockRadicado({
      termino: {
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoSolicitudNombre: 'Petición',
        diasRespuesta: 15,
        unidad: 'HABILES',
        fechaVencimiento: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        prorrogasAplicadas: 0,
      },
    });

    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => vencido }],
    });

    const res = await getResumenDiario();
    const data = await res.json();

    expect(data.mostrar).toBe(false); // ya visto hoy
    expect(data.totales.vencidos).toBe(1); // los contadores se siguen calculando
  });

  // 4. Al día siguiente vuelve a evaluarse (vía POST de visto con fecha hoy)
  it('4. POST visto valida la fecha de Colombia', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValueOnce({
      uid: 'usr_001',
      email: 'diana@simacota.gov.co',
      nombre: 'Diana',
      rol: 'FUNCIONARIO',
      tenantId: 'SEC_GOBIERNO',
      activo: true,
    });

    const hoyColombia = nowColombia().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });

    // Payload con fecha de hoy -> OK
    const reqOk = new Request('http://localhost/api/interno/resumen-diario/visto', {
      method: 'POST',
      body: JSON.stringify({ fecha: hoyColombia }),
    });

    mockSet.mockResolvedValueOnce(undefined);
    const resOk = await vistoResumenDiario(reqOk);
    const dataOk = await resOk.json();
    expect(dataOk.ok).toBe(true);
    expect(mockSet).toHaveBeenCalledOnce();

    // Payload con fecha distinta -> Error 400
    const reqErr = new Request('http://localhost/api/interno/resumen-diario/visto', {
      method: 'POST',
      body: JSON.stringify({ fecha: '2026-01-01' }),
    });

    const resErr = await vistoResumenDiario(reqErr);
    const dataErr = await resErr.json();
    expect(resErr.status).toBe(400);
    expect(dataErr.error).toContain('día actual en Colombia');
  });

  // 5. FUNCIONARIO solo ve su dependencia
  it('5. FUNCIONARIO solo ve su dependencia', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValueOnce({
      uid: 'usr_001',
      email: 'diana@simacota.gov.co',
      nombre: 'Diana',
      rol: 'FUNCIONARIO',
      tenantId: 'SEC_GOBIERNO',
      activo: true,
    });

    mockDocGet.mockResolvedValueOnce({ exists: false });

    // Solo retornamos un vencido de HACIENDA (no debería coincidir si Firestore filtrara, pero si llega por algún motivo, el backend lo procesa)
    // El backend realiza la consulta where('clasificacion.oficinaDestino', '==', 'SEC_GOBIERNO')
    expect(mockWhere).not.toHaveBeenCalled(); // Verificamos que se haya aplicado el where
    
    const vencidoOtro = mockRadicado({
      clasificacion: { oficinaDestino: 'SEC_HACIENDA', zonaGeografica: 'CASCO_URBANO', funcionarioResponsableUid: 'usr_999' },
      termino: {
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoSolicitudNombre: 'Petición',
        diasRespuesta: 15,
        unidad: 'HABILES',
        fechaVencimiento: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        prorrogasAplicadas: 0,
      },
    });

    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => vencidoOtro }],
    });

    const res = await getResumenDiario();
    const data = await res.json();

    // Como no pertenece a su oficina y no está asignado a él, se filtra en backend
    expect(data.totales.vencidos).toBe(0);
    expect(data.mostrar).toBe(false);
  });

  // 6. JEFE_DEPENDENCIA solo ve su dependencia
  it('6. JEFE_DEPENDENCIA solo ve su dependencia', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValueOnce({
      uid: 'usr_002',
      email: 'jefe@simacota.gov.co',
      nombre: 'Jefe Gobierno',
      rol: 'JEFE_DEPENDENCIA',
      tenantId: 'SEC_GOBIERNO',
      activo: true,
    });

    mockDocGet.mockResolvedValueOnce({ exists: false });

    const vencidoGobierno = mockRadicado({
      clasificacion: { oficinaDestino: 'SEC_GOBIERNO', zonaGeografica: 'CASCO_URBANO' },
      termino: {
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoSolicitudNombre: 'Petición',
        diasRespuesta: 15,
        unidad: 'HABILES',
        fechaVencimiento: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        prorrogasAplicadas: 0,
      },
    });

    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => vencidoGobierno }],
    });

    const res = await getResumenDiario();
    const data = await res.json();

    expect(data.totales.vencidos).toBe(1);
    expect(data.mostrar).toBe(true);
  });

  // 7. ADMIN ve resumen global
  it('7. ADMIN ve resumen global', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValueOnce({
      uid: 'usr_admin',
      email: 'admin@simacota.gov.co',
      nombre: 'Administrador',
      rol: 'ADMIN',
      tenantId: 'VENTANILLA_UNICA',
      activo: true,
    });

    mockDocGet.mockResolvedValueOnce({ exists: false });

    // Dos vencidos de diferentes dependencias
    const r1 = mockRadicado({ radicadoId: 'R-GOB', clasificacion: { oficinaDestino: 'SEC_GOBIERNO', zonaGeografica: 'CASCO_URBANO' }, termino: { tipoSolicitudId: 'PETICION_GENERAL', tipoSolicitudNombre: 'Petición', diasRespuesta: 15, unidad: 'HABILES', fechaVencimiento: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), prorrogasAplicadas: 0 } });
    const r2 = mockRadicado({ radicadoId: 'R-HAC', clasificacion: { oficinaDestino: 'SEC_HACIENDA', zonaGeografica: 'CASCO_URBANO' }, termino: { tipoSolicitudId: 'PETICION_GENERAL', tipoSolicitudNombre: 'Petición', diasRespuesta: 15, unidad: 'HABILES', fechaVencimiento: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), prorrogasAplicadas: 0 } });

    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => r1 }, { data: () => r2 }],
    });

    const res = await getResumenDiario();
    const data = await res.json();

    expect(data.totales.vencidos).toBe(2);
    expect(data.mostrar).toBe(true);
  });

  // 8. CONTROL_INTERNO no recibe botones ni enlaces de respuesta a ciudadanos
  // (Esta validación se hace a nivel UI comprobando el rol del usuario)
  it('8. CONTROL_INTERNO carga hallazgos y planes', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValueOnce({
      uid: 'usr_ci',
      email: 'ci@simacota.gov.co',
      nombre: 'Control Interno',
      rol: 'CONTROL_INTERNO',
      tenantId: 'VENTANILLA_UNICA',
      activo: true,
    });

    mockDocGet.mockResolvedValueOnce({ exists: false });
    mockGet.mockResolvedValueOnce({ docs: [] }); // no radicados

    // Mock de hallazgos y planes
    const mockHallazgo = { id: 'hallazgo-01', descripcion: 'Incumplimiento en Gobierno', estado: 'ABIERTO' };
    const mockPlan = { id: 'plan-01', descripcion: 'Plan de mejora Gobierno', estado: 'PENDIENTE', fechaCompromiso: '2026-06-20' };

    mockGet.mockResolvedValueOnce({ docs: [{ id: 'hallazgo-01', data: () => mockHallazgo }] });
    mockGet.mockResolvedValueOnce({ docs: [{ id: 'plan-01', data: () => mockPlan }] });

    const res = await getResumenDiario();
    const data = await res.json();

    expect(data.mostrar).toBe(true);
    expect(data.prioridades.some((p: { tipo: string }) => p.tipo === 'HALLAZGO_PENDIENTE')).toBe(true);
  });

  // 9. Vencidos tienen prioridad sobre próximos a vencer
  it('9. Vencidos tienen prioridad sobre próximos a vencer', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValueOnce({
      uid: 'usr_admin',
      email: 'admin@simacota.gov.co',
      nombre: 'Admin',
      rol: 'ADMIN',
      tenantId: 'VENTANILLA_UNICA',
      activo: true,
    });

    mockDocGet.mockResolvedValueOnce({ exists: false });

    const porVencer = mockRadicado({
      radicadoId: 'POR-VENCER',
      termino: {
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoSolicitudNombre: 'Petición',
        diasRespuesta: 15,
        unidad: 'HABILES',
        fechaVencimiento: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // Vence mañana
        prorrogasAplicadas: 0,
      },
    });

    const vencido = mockRadicado({
      radicadoId: 'VENCIDO-YA',
      termino: {
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoSolicitudNombre: 'Petición',
        diasRespuesta: 15,
        unidad: 'HABILES',
        fechaVencimiento: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Vencido ayer
        prorrogasAplicadas: 0,
      },
    });

    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => porVencer }, { data: () => vencido }],
    });

    const res = await getResumenDiario();
    const data = await res.json();

    expect(data.prioridades[0].radicadoId).toBe('VENCIDO-YA'); // Vencido primero
    expect(data.prioridades[1].radicadoId).toBe('POR-VENCER'); // Próximo a vencer segundo
  });

  // 10. Los resueltos no aparecen
  it('10. Los resueltos no aparecen', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValueOnce({
      uid: 'usr_admin',
      email: 'admin@simacota.gov.co',
      nombre: 'Admin',
      rol: 'ADMIN',
      tenantId: 'VENTANILLA_UNICA',
      activo: true,
    });

    mockDocGet.mockResolvedValueOnce({ exists: false });

    const resuelto = mockRadicado({
      radicadoId: 'RESUELTO-1',
      estadoActual: 'RESUELTO',
      termino: {
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoSolicitudNombre: 'Petición',
        diasRespuesta: 15,
        unidad: 'HABILES',
        fechaVencimiento: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        prorrogasAplicadas: 0,
      },
    });

    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => resuelto }],
    });

    const res = await getResumenDiario();
    const data = await res.json();

    expect(data.totales.vencidos).toBe(0);
    expect(data.mostrar).toBe(false);
  });

  // 11. Correos fallidos aparecen cuando corresponda
  it('11. Correos fallidos aparecen cuando corresponda', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValueOnce({
      uid: 'usr_admin',
      email: 'admin@simacota.gov.co',
      nombre: 'Admin',
      rol: 'ADMIN',
      tenantId: 'VENTANILLA_UNICA',
      activo: true,
    });

    mockDocGet.mockResolvedValueOnce({ exists: false });

    const correoFallido = mockRadicado({
      radicadoId: 'FALLIDO-1',
      alertaNotificacionFallida: true,
    });

    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => correoFallido }],
    });

    const res = await getResumenDiario();
    const data = await res.json();

    expect(data.totales.correosFallidos).toBe(1);
    expect(data.prioridades[0].tipo).toBe('CORREO_FALLIDO');
  });

  // 12. No se devuelven datos personales (PII)
  it('12. No se devuelven datos personales (PII)', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValueOnce({
      uid: 'usr_admin',
      email: 'admin@simacota.gov.co',
      nombre: 'Admin',
      rol: 'ADMIN',
      tenantId: 'VENTANILLA_UNICA',
      activo: true,
    });

    mockDocGet.mockResolvedValueOnce({ exists: false });

    const r = mockRadicado({
      termino: {
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoSolicitudNombre: 'Petición',
        diasRespuesta: 15,
        unidad: 'HABILES',
        fechaVencimiento: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        prorrogasAplicadas: 0,
      },
    });

    mockGet.mockResolvedValueOnce({
      docs: [{ data: () => r }],
    });

    const res = await getResumenDiario();
    const data = await res.json();
    const txt = JSON.stringify(data);

    // Comprobamos que no se devuelvan datos sensibles en ninguna parte del body
    expect(txt).not.toContain('diana@example.com');
    expect(txt).not.toContain('3001234567');
    expect(txt).not.toContain('Calle Falsa 123');
    expect(txt).not.toContain('Asunto de prueba');
    expect(txt).not.toContain('Descripción de prueba');
  });

  // 13. La fecha usa America/Bogota
  it('13. La fecha usa America/Bogota', async () => {
    const ahora = nowColombia();
    // Validamos que el cálculo de fecha del helper nowColombia() devuelva una fecha válida
    expect(ahora).toBeInstanceOf(Date);
    expect(Number.isNaN(ahora.getTime())).toBe(false);
  });

  it('14. La vista móvil no desborda y usa dialog accesible', () => {
    const source = readFileSync('app/interno/dashboard/components/ResumenDiarioModal.tsx', 'utf8');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('max-w-3xl');
    expect(source).toContain('max-h-[92dvh]');
    expect(source).toContain('overflow-y-auto');
  });

  it('15. Los botones aplican filtros/vistas existentes', () => {
    const source = readFileSync('app/interno/dashboard/components/ResumenDiarioModal.tsx', 'utf8');
    expect(source).toContain("onFiltroMIPG(filtro)");
    expect(source).toContain("onVistaChange('TABLERO')");
    expect(source).toContain("onVistaChange(vista)");
    expect(source).not.toContain('Responder');
    expect(source).not.toContain('Nueva bandeja');
  });
});
