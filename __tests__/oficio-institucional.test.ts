/**
 * Tests del builder de oficio institucional.
 *
 * El oficio se inserta tal cual en `respuestaOficial.nota`, se envía
 * por correo al ciudadano y queda visible en la consulta pública. Por
 * eso debe respetar privacidad (anónimo/reservado), tener estructura
 * estable y nunca filtrar datos internos del funcionario más allá de
 * nombre/cargo/dependencia (que sí son públicos en un oficio).
 */
import { describe, it, expect } from 'vitest';
import { buildOficioInstitucional, PLACEHOLDER_CUERPO } from '@/lib/respuesta-oficial/oficio-institucional';

const RADICADO_ID = '1-WEB-2026-00000042';
const FECHA = new Date('2026-06-15T14:30:00.000Z');

describe('buildOficioInstitucional — identificado con cuerpo', () => {
  const oficio = buildOficioInstitucional({
    radicadoId: RADICADO_ID,
    fecha: FECHA,
    ciudadano: {
      nombre: 'María Pérez',
      correo: 'maria@example.com',
      esAnonimo: false,
    },
    dependencia: 'Secretaría de Gobierno',
    funcionario: {
      nombre: 'Juan Funcionario',
      cargo:  'Coordinador de Atención al Ciudadano',
      rol:    'FUNCIONARIO',
    },
    cuerpoRespuesta: 'En relación con su petición, le informamos que el trámite fue revisado y procede favorablemente.',
  });

  it('incluye ciudad/departamento + fecha en español', () => {
    expect(oficio).toContain('Simacota, Santander');
    expect(oficio.toLowerCase()).toContain('junio de 2026');
  });

  it('saluda con tratamiento formal y nombre del ciudadano', () => {
    expect(oficio).toContain('Señor(a)');
    expect(oficio).toContain('María Pérez');
    expect(oficio).toContain('maria@example.com');
  });

  it('incluye asunto y referencia al número de radicado', () => {
    expect(oficio).toContain(`Asunto: Respuesta a solicitud radicada No. ${RADICADO_ID}`);
    expect(oficio).toContain(`mediante radicado No. ${RADICADO_ID}`);
  });

  it('inserta el cuerpo de la respuesta tal cual', () => {
    expect(oficio).toContain('procede favorablemente');
  });

  it('cierra con firma institucional: nombre, cargo, dependencia, alcaldía', () => {
    expect(oficio).toContain('Atentamente,');
    expect(oficio).toContain('Juan Funcionario');
    expect(oficio).toContain('Coordinador de Atención al Ciudadano');
    expect(oficio).toContain('Secretaría de Gobierno');
    expect(oficio).toContain('Alcaldía Municipal de Simacota');
  });

  it('NO incluye placeholder cuando el cuerpo fue provisto', () => {
    expect(oficio).not.toContain(PLACEHOLDER_CUERPO);
    expect(oficio).not.toContain('[Escribe aquí');
  });
});

describe('buildOficioInstitucional — sin cuerpo (placeholder editable)', () => {
  it('inserta placeholder claro cuando el cuerpo es vacío', () => {
    const oficio = buildOficioInstitucional({
      radicadoId: RADICADO_ID,
      fecha: FECHA,
      ciudadano: { nombre: 'X', esAnonimo: false },
      dependencia: 'Despacho',
      funcionario: { nombre: 'F', rol: 'FUNCIONARIO' },
    });
    expect(oficio).toContain(PLACEHOLDER_CUERPO);
  });

  it('trata cuerpo de solo espacios como vacío', () => {
    const oficio = buildOficioInstitucional({
      radicadoId: RADICADO_ID,
      fecha: FECHA,
      ciudadano: { nombre: 'X', esAnonimo: false },
      dependencia: 'Despacho',
      funcionario: { nombre: 'F', rol: 'FUNCIONARIO' },
      cuerpoRespuesta: '   \n  ',
    });
    expect(oficio).toContain(PLACEHOLDER_CUERPO);
  });
});

describe('buildOficioInstitucional — privacidad', () => {
  it('radicado ANÓNIMO oculta nombre y contacto, usa "Solicitante"', () => {
    const oficio = buildOficioInstitucional({
      radicadoId: RADICADO_ID,
      fecha: FECHA,
      ciudadano: {
        nombre: 'No Debe Aparecer',
        correo: 'oculto@ejemplo.com',
        direccion: 'Calle Falsa 123',
        esAnonimo: true,
      },
      dependencia: 'Despacho',
      funcionario: { nombre: 'F', rol: 'FUNCIONARIO' },
      cuerpoRespuesta: 'Texto',
    });
    expect(oficio).toContain('Solicitante');
    expect(oficio).not.toContain('No Debe Aparecer');
    expect(oficio).not.toContain('oculto@ejemplo.com');
    expect(oficio).not.toContain('Calle Falsa 123');
  });

  it('radicado RESERVADO oculta identidad del ciudadano', () => {
    const oficio = buildOficioInstitucional({
      radicadoId: RADICADO_ID,
      fecha: FECHA,
      ciudadano: {
        nombre: 'Reservado X',
        correo: 'reservado@example.com',
        reservado: true,
      },
      dependencia: 'Despacho',
      funcionario: { nombre: 'F', rol: 'FUNCIONARIO' },
      cuerpoRespuesta: 'Texto',
    });
    expect(oficio).toContain('Solicitante');
    expect(oficio).not.toContain('Reservado X');
    expect(oficio).not.toContain('reservado@example.com');
  });

  it('identificado sin correo ni dirección igual produce un oficio válido', () => {
    const oficio = buildOficioInstitucional({
      radicadoId: RADICADO_ID,
      fecha: FECHA,
      ciudadano: { nombre: 'Solo Nombre', esAnonimo: false },
      dependencia: 'Despacho',
      funcionario: { nombre: 'F', rol: 'FUNCIONARIO' },
      cuerpoRespuesta: 'Texto',
    });
    expect(oficio).toContain('Solo Nombre');
    expect(oficio).toContain('Asunto:');
    expect(oficio).toContain('Atentamente,');
  });
});

describe('buildOficioInstitucional — fallback de cargo', () => {
  it('si no hay cargo y hay rol, usa el label del rol', () => {
    const oficio = buildOficioInstitucional({
      radicadoId: RADICADO_ID,
      fecha: FECHA,
      ciudadano: { nombre: 'X', esAnonimo: false },
      dependencia: 'Despacho',
      funcionario: { nombre: 'Jefe X', rol: 'JEFE_DEPENDENCIA' },
      cuerpoRespuesta: 'Texto',
    });
    expect(oficio).toContain('Jefe X');
    expect(oficio).toContain('Jefe de Dependencia');
  });

  it('si no hay cargo ni rol, usa fallback genérico', () => {
    const oficio = buildOficioInstitucional({
      radicadoId: RADICADO_ID,
      fecha: FECHA,
      ciudadano: { nombre: 'X', esAnonimo: false },
      dependencia: 'Despacho',
      funcionario: { nombre: 'Anónimo Funcionario' },
      cuerpoRespuesta: 'Texto',
    });
    expect(oficio).toContain('Funcionario');
  });

  it('prefiere el cargo explícito sobre el label del rol', () => {
    const oficio = buildOficioInstitucional({
      radicadoId: RADICADO_ID,
      fecha: FECHA,
      ciudadano: { nombre: 'X', esAnonimo: false },
      dependencia: 'Despacho',
      funcionario: { nombre: 'F', cargo: 'Secretario General', rol: 'FUNCIONARIO' },
      cuerpoRespuesta: 'Texto',
    });
    expect(oficio).toContain('Secretario General');
  });
});

describe('buildOficioInstitucional — fecha', () => {
  it('acepta ISO string', () => {
    const oficio = buildOficioInstitucional({
      radicadoId: RADICADO_ID,
      fecha: '2026-12-01T10:00:00.000Z',
      ciudadano: { nombre: 'X', esAnonimo: false },
      dependencia: 'Despacho',
      funcionario: { nombre: 'F', rol: 'FUNCIONARIO' },
      cuerpoRespuesta: 'Texto',
    });
    expect(oficio.toLowerCase()).toContain('diciembre de 2026');
  });

  it('con fecha inválida usa fallback razonable (no rompe el oficio)', () => {
    const oficio = buildOficioInstitucional({
      radicadoId: RADICADO_ID,
      fecha: 'NO ES FECHA',
      ciudadano: { nombre: 'X', esAnonimo: false },
      dependencia: 'Despacho',
      funcionario: { nombre: 'F', rol: 'FUNCIONARIO' },
      cuerpoRespuesta: 'Texto',
    });
    expect(oficio).toContain('Simacota, Santander,');
    expect(oficio).toContain('Asunto:');
  });
});

describe('buildOficioInstitucional — estructura general', () => {
  const oficio = buildOficioInstitucional({
    radicadoId: RADICADO_ID,
    fecha: FECHA,
    ciudadano: { nombre: 'Test', esAnonimo: false },
    dependencia: 'Secretaría X',
    funcionario: { nombre: 'F', rol: 'FUNCIONARIO' },
    cuerpoRespuesta: 'CUERPO_MARCADOR',
  });

  it('respeta el orden estructural del oficio', () => {
    const idxCiudad   = oficio.indexOf('Simacota, Santander');
    const idxSenor    = oficio.indexOf('Señor(a)');
    const idxAsunto   = oficio.indexOf('Asunto:');
    const idxSaludo   = oficio.indexOf('Cordial saludo');
    const idxCuerpo   = oficio.indexOf('CUERPO_MARCADOR');
    const idxCierre   = oficio.indexOf('Atentamente,');
    // "Alcaldía Municipal de Simacota" aparece en el cuerpo Y en la firma;
    // verificamos la firma final con lastIndexOf.
    const idxFirma    = oficio.lastIndexOf('Alcaldía Municipal de Simacota');
    expect(idxCiudad).toBeLessThan(idxSenor);
    expect(idxSenor).toBeLessThan(idxAsunto);
    expect(idxAsunto).toBeLessThan(idxSaludo);
    expect(idxSaludo).toBeLessThan(idxCuerpo);
    expect(idxCuerpo).toBeLessThan(idxCierre);
    expect(idxCierre).toBeLessThan(idxFirma);
  });

  it('la firma queda al final del oficio (última línea)', () => {
    const lineas = oficio.split('\n');
    expect(lineas[lineas.length - 1]).toBe('Alcaldía Municipal de Simacota');
  });

  it('no inyecta marcadores html/markdown — es texto plano', () => {
    expect(oficio).not.toContain('<');
    expect(oficio).not.toContain('**');
    expect(oficio).not.toContain('##');
  });
});
