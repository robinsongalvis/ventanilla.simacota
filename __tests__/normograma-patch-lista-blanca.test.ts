import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * PATCH y DELETE del normograma tomaban el nombre de la colección del QUERY
 * STRING sin validarlo, y el PATCH volcaba el cuerpo del cliente entero
 * (`{ ...body }`) dentro del `update`. Dos agujeros que se componen: un ADMIN
 * podía escribir cualquier campo en cualquier colección de Firestore —incluidos
 * los contadores de la serie legal— pasando su nombre por la URL.
 *
 * Las rutas hermanas del MISMO módulo ya tenían la lista blanca. Estas dos eran
 * las únicas sin ella.
 */

const { mockUpdate, mockDelete, mockGet } = vi.hoisted(() => ({
  mockUpdate: vi.fn(async () => undefined),
  mockDelete: vi.fn(async () => undefined),
  mockGet: vi.fn(async () => ({
    exists: true,
    data: () => ({ rol: 'ADMIN', activo: true, nombre: 'Admin de prueba', tenantId: 'VENTANILLA_UNICA' }),
  })),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'cookie-de-sesion' }) }),
}));

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminAuth: () => ({ verifySessionCookie: async () => ({ uid: 'uid-admin' }) }),
  getFirebaseAdminDb: () => ({
    doc: () => ({ get: mockGet }),
    collection: (nombre: string) => ({
      doc: (id: string) => ({
        update: (datos: Record<string, unknown>) => mockUpdate(nombre, id, datos),
        delete: () => mockDelete(nombre, id),
      }),
    }),
  }),
}));

import { PATCH, DELETE } from '@/app/api/simi/normograma/[id]/route';

const params = Promise.resolve({ id: 'doc-1' });

function peticion(coleccion: string, body: unknown) {
  return new Request(`http://local/api/simi/normograma/doc-1?coleccion=${coleccion}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('normograma PATCH — colección', () => {
  it('rechaza una colección que no está en la lista blanca, sin escribir nada', async () => {
    const res = await PATCH(peticion('counters', { titulo: 'x' }), { params });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rechaza también las colecciones del núcleo, que es lo que hacía peligroso el agujero', async () => {
    for (const coleccion of ['ventanilla_radicados', 'users', 'unicidad_radicados', 'expedientes']) {
      const res = await PATCH(peticion(coleccion, { titulo: 'x' }), { params });
      expect(res.status, `debía rechazar ${coleccion}`).toBe(400);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('acepta las tres colecciones normativas', async () => {
    for (const coleccion of ['normatividad_municipal', 'normatividad_nacional', 'plantillas_respuesta']) {
      const res = await PATCH(peticion(coleccion, { titulo: 'Decreto 1077' }), { params });
      expect(res.status, coleccion).toBe(200);
    }
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });
});

describe('normograma PATCH — campos', () => {
  it('solo escribe los campos de la lista blanca', async () => {
    await PATCH(
      peticion('normatividad_nacional', {
        titulo: 'Decreto 1077 de 2015',
        estado: 'vigente',
        campoInventado: 'no debería llegar',
        __proto__: { contaminado: true },
      }),
      { params },
    );
    const [, , datos] = mockUpdate.mock.calls[0];
    expect(datos).toHaveProperty('titulo', 'Decreto 1077 de 2015');
    expect(datos).toHaveProperty('estado', 'vigente');
    expect(datos).not.toHaveProperty('campoInventado');
    expect(datos).not.toHaveProperty('contaminado');
  });

  /* La constancia de quién validó es justamente lo que el validador no puede
     escribirse a sí mismo. */
  it('ignora validado_por y fecha_validacion venidos del cliente, y los pone el servidor', async () => {
    await PATCH(
      peticion('normatividad_nacional', {
        estado: 'interna_validada',
        validado_por: 'uid-suplantado',
        fecha_validacion: '1999-01-01T00:00:00.000Z',
      }),
      { params },
    );
    const [, , datos] = mockUpdate.mock.calls[0];
    expect(datos.validado_por).toBe('uid-admin');
    expect(datos.fecha_validacion).not.toBe('1999-01-01T00:00:00.000Z');
  });

  it('no permite pisar el id ni las marcas de creación', async () => {
    await PATCH(peticion('normatividad_nacional', { titulo: 'x', id: 'otro', createdAt: '1999-01-01' }), { params });
    const [, , datos] = mockUpdate.mock.calls[0];
    expect(datos).not.toHaveProperty('id');
    expect(datos).not.toHaveProperty('createdAt');
  });

  it('un cuerpo sin ningún campo modificable es 400, no un update vacío', async () => {
    const res = await PATCH(peticion('normatividad_nacional', { loQueSea: 1 }), { params });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('normograma DELETE — colección', () => {
  it('rechaza una colección fuera de la lista blanca sin borrar nada', async () => {
    const req = new Request('http://local/api/simi/normograma/doc-1?coleccion=ventanilla_radicados', { method: 'DELETE' });
    const res = await DELETE(req, { params });
    expect(res.status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
