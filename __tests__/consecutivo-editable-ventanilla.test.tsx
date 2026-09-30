/**
 * NÚMERO DE RADICADO EDITABLE EN VENTANILLA — relevo del software anterior.
 *
 * QUÉ PASA EN LA REALIDAD. El municipio releva el software que veía ventanilla.
 * Ese sistema sigue emitiendo radicados hasta el día del corte y se cae con
 * frecuencia, así que la funcionaria termina anotando números en una hoja. Cuál
 * será el último NO se sabe de antemano: hay días sin nada y días en que el
 * número salta decenas (1744 → 1780 en una jornada). El dato solo existe el día
 * del relevo, en el libro que ella tiene delante.
 *
 * LO QUE SE CUSTODIA AQUÍ, en orden de gravedad:
 *
 *  1. QUE EL NÚMERO NO RETROCEDA. Un radicado entregado se fue con el ciudadano
 *     y su constancia; reemitirlo son dos expedientes con la misma identidad
 *     legal y no hay forma limpia de decidir cuál vale. Un hueco, en cambio, se
 *     explica en una línea del acta de migración. De ahí que la validación sea
 *     asimétrica A PROPÓSITO.
 *
 *  2. QUIÉN PUEDE TOCARLO. Administración y ventanilla, nadie más. No por
 *     jerarquía: por quién tiene el libro delante. Si cualquier rol pudiera
 *     teclear el número, el consecutivo dejaría de ser una garantía y pasaría a
 *     depender de que nadie se equivoque cada día.
 *
 *  3. EL ORDEN AL ENVIAR. Primero se fija el contador, después se radica.
 *     Invertirlo dejaría el radicado con el número viejo y el contador movido
 *     para el siguiente — el hueco que se quería evitar, pero regalado.
 *
 *  4. QUE UN RELEVO PENDIENTE NUNCA IMPIDA RADICAR. Si no hay número de
 *     referencia (la consulta falló, el rol no puede editar), se radica por el
 *     camino de siempre y el servidor emite el que toque.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DIGITOS_CONSECUTIVO,
  normalizarConsecutivo,
  partirIdentificador,
  planearRelevo,
} from '@/lib/recepcion/consecutivo-relevo';
import { puedeMoverConsecutivoRadicacion } from '@/lib/permisos/consecutivo-radicacion';
import type { RolInterno } from '@/lib/hooks/useAuth';
import { RadicacionFuncionarioForm } from '@/app/interno/recepcion/components/RadicacionFuncionarioForm';

// El primer render del formulario completo en jsdom puede pasar de 5 s con carga.
vi.setConfig({ testTimeout: 15_000 });
afterEach(() => cleanup());

const fuente = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8');

/* ════════════════════════════════════════════════════════════════════════
   1 · SOLO SE AVANZA
   ════════════════════════════════════════════════════════════════════════ */
describe('planearRelevo — el número solo puede avanzar', () => {
  it('el caso real del relevo: saldría el 30 y el libro va en 1779 → se fija y se continúa en 1780', () => {
    const plan = planearRelevo('1-110-202609-00000030', '00001780');
    expect(plan).toEqual({
      accion: 'ajustar',
      ultimoDelSistemaAnterior: 1779,
      numeroEsperado: 1780,
      motivo: expect.stringContaining('1779'),
    });
  });

  it('el motivo se escribe solo y nombra los dos números — es lo que explicará el hueco a quien audite', () => {
    const plan = planearRelevo('1-110-202609-00000030', '1780');
    if (plan.accion !== 'ajustar') throw new Error('se esperaba un ajuste');
    // El servidor exige 10 caracteres como mínimo; un motivo vacío sería un 400
    // justo cuando hay un ciudadano esperando en el mostrador.
    expect(plan.motivo.length).toBeGreaterThanOrEqual(10);
    expect(plan.motivo).toContain('1779');
    expect(plan.motivo).toContain('1780');
  });

  it('RECHAZA retroceder — esos números ya están en manos de ciudadanos', () => {
    const plan = planearRelevo('1-110-202609-00001780', '00001750');
    if (plan.accion !== 'rechazar') throw new Error('se esperaba un rechazo');
    expect(plan.mensaje).toContain('solo puede avanzar');
    expect(plan.mensaje).toContain('1750');
    expect(plan.mensaje).toContain('1780');
  });

  it('el mismo número no pide nada al servidor: se radica por el camino de siempre', () => {
    expect(planearRelevo('1-110-202609-00001780', '00001780')).toEqual({ accion: 'radicar' });
  });

  it('los ceros a la izquierda no son un cambio — 1780 y 00001780 son el mismo radicado', () => {
    expect(planearRelevo('1-110-202609-00001780', '1780')).toEqual({ accion: 'radicar' });
  });

  it('rechaza el cero y el campo vacío en lugar de emitir un radicado sin número', () => {
    expect(planearRelevo('1-110-202609-00001780', '').accion).toBe('rechazar');
    expect(planearRelevo('1-110-202609-00000001', '0').accion).toBe('rechazar');
  });

  it('sin número de referencia se radica igual — un relevo pendiente no puede bloquear ventanilla', () => {
    expect(planearRelevo('Se generará al radicar', '1780')).toEqual({ accion: 'radicar' });
    expect(planearRelevo('', '1780')).toEqual({ accion: 'radicar' });
  });

  it('acepta los identificadores antiguos de cuatro segmentos con cualquier oficina radicadora', () => {
    // La oficina puede cambiar (`110` es Secretaría General hoy); el formato no.
    expect(partirIdentificador('1-200-202601-00000005')).toEqual({
      prefijo: '1-200-202601-',
      consecutivo: '00000005',
    });
  });
});

/* ════════════════════════════════════════════════════════════════════════
   2 · PARTIR Y NORMALIZAR
   ════════════════════════════════════════════════════════════════════════ */
describe('partirIdentificador / normalizarConsecutivo', () => {
  it('parte el identificador dejando el prefijo intacto — nadie lo edita desde la pantalla', () => {
    expect(partirIdentificador('1-110-202609-00001780')).toEqual({
      prefijo: '1-110-202609-',
      consecutivo: '00001780',
    });
  });

  it('devuelve null para lo que no es un identificador, para que la pantalla no ofrezca edición a ciegas', () => {
    expect(partirIdentificador('Se generará al radicar')).toBeNull();
    expect(partirIdentificador('1-WEB-2026-00000099')).toBeNull();
    expect(partirIdentificador('')).toBeNull();
  });

  it('limpia lo que se teclea o se pega del libro y no deja pasar del ancho del campo', () => {
    expect(normalizarConsecutivo(' 1.780 ')).toBe('1780');
    expect(normalizarConsecutivo('abc17x80')).toBe('1780');
    expect(normalizarConsecutivo('9'.repeat(20))).toHaveLength(DIGITOS_CONSECUTIVO);
  });
});

/* ════════════════════════════════════════════════════════════════════════
   3 · QUIÉN PUEDE TOCARLO
   ════════════════════════════════════════════════════════════════════════ */
describe('permiso — administración y ventanilla, nadie más', () => {
  /* La lista completa está escrita a mano a propósito: si mañana se añade un
     rol al sistema, este test obliga a decidir explícitamente si puede mover el
     consecutivo, en lugar de heredar un permiso por descuido. */
  const ROLES: Record<RolInterno, boolean> = {
    ADMIN: true,
    RECEPCIONISTA: true,
    FUNCIONARIO: false,
    JEFE_DEPENDENCIA: false,
    CONTROL_INTERNO: false,
  };

  for (const [rol, esperado] of Object.entries(ROLES) as [RolInterno, boolean][]) {
    it(`${rol} ${esperado ? 'SÍ' : 'NO'} puede mover el consecutivo`, () => {
      expect(puedeMoverConsecutivoRadicacion(rol)).toBe(esperado);
    });
  }

  it('CONTROL_INTERNO queda fuera aunque audite: auditar no es operar', () => {
    expect(puedeMoverConsecutivoRadicacion('CONTROL_INTERNO')).toBe(false);
  });

  it('la ruta aplica el permiso en GET y en POST, no solo al escribir', () => {
    /* Dejar el GET abierto filtraría en cuánto va el consecutivo del municipio a
       cualquier funcionario — y con él, cuántos trámites entraron. */
    const src = fuente('app/api/interno/consecutivo-radicacion/route.ts');
    const usos = src.match(/!puedeMoverConsecutivoRadicacion\(usuario\.rol\)/g) ?? [];
    expect(usos, 'el permiso debe aplicarse en GET y en POST').toHaveLength(2);
  });

  it('el permiso se comprueba ANTES de tocar Firestore', () => {
    /* Un guard colocado después de leer ya habría consultado la base con una
       sesión no autorizada: el rechazo llegaría tarde. */
    const src = fuente('app/api/interno/consecutivo-radicacion/route.ts');
    const posPermiso = src.indexOf('!puedeMoverConsecutivoRadicacion');
    const posDb = src.indexOf('getFirebaseAdminDb()');
    expect(posPermiso).toBeGreaterThan(-1);
    expect(posDb).toBeGreaterThan(-1);
    expect(posPermiso).toBeLessThan(posDb);
  });

  it('el tablero decide la edición con el MISMO permiso que la ruta', () => {
    /* Una pantalla más permisiva que el servidor ofrece algo que el servidor
       rechaza; una más estricta esconde lo que la funcionaria necesita. La única
       forma de que no se separen es que compartan la función. */
    const src = fuente('app/interno/dashboard/page.tsx');
    expect(src).toMatch(/puedeFijarConsecutivo = puedeMoverConsecutivoRadicacion\(usuario\.rol\)/);
    expect(src).toMatch(/onConsecutivoChange=\{puedeFijarConsecutivo \? setConsecutivoEditado : undefined\}/);
  });
});

/* ════════════════════════════════════════════════════════════════════════
   4 · EL ORDEN AL ENVIAR
   ════════════════════════════════════════════════════════════════════════ */
describe('orden del envío — primero se fija el contador, después se radica', () => {
  it('el ajuste del consecutivo va antes de radicar', () => {
    /* Al revés, el radicado saldría con el número viejo y el contador quedaría
       movido para el siguiente: el hueco que se quería evitar, regalado. */
    const src = fuente('app/interno/dashboard/page.tsx');
    const posAjuste = src.indexOf("await fetch('/api/interno/consecutivo-radicacion'");
    const posRadicar = src.indexOf('await radicarSegunFlag(');
    expect(posAjuste, 'no se encontró el ajuste del consecutivo').toBeGreaterThan(-1);
    expect(posRadicar, 'no se encontró la radicación').toBeGreaterThan(-1);
    expect(posAjuste).toBeLessThan(posRadicar);
  });

  it('si el ajuste falla NO se radica — mejor un reintento que un número equivocado', () => {
    const src = fuente('app/interno/dashboard/page.tsx');
    const inicio = src.indexOf("if (plan.accion === 'ajustar')");
    expect(inicio, 'no se encontró la rama de ajuste').toBeGreaterThan(-1);
    const bloque = src.slice(inicio, src.indexOf('const ahora = new Date();', inicio));
    expect(bloque, 'la rama de ajuste quedó vacía: el test no estaría comprobando nada').not.toBe('');
    // `return` dentro del `if (!res.ok)`: corta antes de llegar a radicarSegunFlag.
    expect(bloque).toMatch(/if \(!res\.ok\)\s*\{[\s\S]*?return;[\s\S]*?\}/);
  });

  it('la emisión del consecutivo no se toca: sigue saliendo de su transacción', () => {
    /* El camino elegido deja el contador en su sitio y radica normal. Meter mano
       en la transacción de emisión pondría en riesgo lo que protege a CADA
       radicado (defecto H3 — consecutivos fantasma, guard D9) por un caso que
       se usa el día del relevo. */
    const src = fuente('app/api/radicacion/interna/route.ts');
    expect(src).not.toMatch(/consecutivoSolicitado|consecutivoForzado|ultimoDelSistemaAnterior/);
  });
});

/* ════════════════════════════════════════════════════════════════════════
   5 · LA PANTALLA
   ════════════════════════════════════════════════════════════════════════ */
describe('Radicación Rápida — el campo del número', () => {
  const PROXIMO = '1-110-202609-00000030';

  it('quien puede relevar ve el número escrito y editable, con el prefijo fijo aparte', () => {
    render(
      <RadicacionFuncionarioForm
        radicadoPreview={PROXIMO}
        consecutivoEditado="00000030"
        onConsecutivoChange={() => {}}
      />,
    );
    const campo = screen.getByLabelText('Consecutivo del radicado') as HTMLInputElement;
    expect(campo.value).toBe('00000030');
    // El prefijo está a la vista pero fuera del input: no se puede editar.
    expect(screen.getByText('1-110-202609-')).toBeTruthy();
  });

  it('el resto de los roles siguen con el número automático — no hay input que tocar', () => {
    render(<RadicacionFuncionarioForm radicadoPreview={PROXIMO} />);
    expect(screen.queryByLabelText('Consecutivo del radicado')).toBeNull();
    expect(screen.getByText(PROXIMO)).toBeTruthy();
  });

  it('lo que se teclea llega limpio: solo dígitos y hasta el ancho del campo', () => {
    const recibido: string[] = [];
    render(
      <RadicacionFuncionarioForm
        radicadoPreview={PROXIMO}
        consecutivoEditado="00000030"
        onConsecutivoChange={(v) => recibido.push(v)}
      />,
    );
    const campo = screen.getByLabelText('Consecutivo del radicado');
    fireEvent.change(campo, { target: { value: '1.780' } });
    fireEvent.change(campo, { target: { value: '9'.repeat(20) } });
    expect(recibido[0]).toBe('1780');
    expect(recibido[1]).toHaveLength(DIGITOS_CONSECUTIVO);
  });

  it('avisa del salto ANTES de radicar: después el número ya es la identidad legal del trámite', () => {
    render(
      <RadicacionFuncionarioForm
        radicadoPreview={PROXIMO}
        consecutivoEditado="1780"
        onConsecutivoChange={() => {}}
      />,
    );
    expect(screen.getByText(/El anterior queda como 1779/)).toBeTruthy();
  });

  it('un número ya usado se explica en el propio campo y se marca inválido', () => {
    render(
      <RadicacionFuncionarioForm
        radicadoPreview="1-110-202609-00001780"
        consecutivoEditado="1750"
        onConsecutivoChange={() => {}}
      />,
    );
    const aviso = screen.getByRole('alert');
    expect(aviso.textContent).toContain('solo puede avanzar');
    expect(screen.getByLabelText('Consecutivo del radicado').getAttribute('aria-invalid')).toBe('true');
  });

  it('el aviso no parpadea mientras teclea: el veredicto espera a que suelte el campo', () => {
    /* Con el número puesto y el libro en 1780, teclear pasa por 1, 17 y 178 —
       todos «ya usados». Un rojo intermitente delante de un ciudadano que
       espera enseña a ignorar los avisos, que es peor que no tenerlos. */
    render(
      <RadicacionFuncionarioForm
        radicadoPreview="1-110-202609-00001780"
        consecutivoEditado="1"
        onConsecutivoChange={() => {}}
      />,
    );
    const campo = screen.getByLabelText('Consecutivo del radicado');
    fireEvent.focus(campo);
    expect(screen.queryByRole('alert')).toBeNull();
    // Al salir sí se pronuncia: el número quedó mal y hay que verlo.
    fireEvent.blur(campo);
    expect(screen.getByRole('alert').textContent).toContain('solo puede avanzar');
  });

  it('al entrar en el campo se selecciona el número: se teclea encima, no se borran ocho ceros', () => {
    render(
      <RadicacionFuncionarioForm
        radicadoPreview="1-110-202609-00000030"
        consecutivoEditado="00000030"
        onConsecutivoChange={() => {}}
      />,
    );
    const campo = screen.getByLabelText('Consecutivo del radicado') as HTMLInputElement;
    fireEvent.focus(campo);
    expect(campo.selectionStart).toBe(0);
    expect(campo.selectionEnd).toBe('00000030'.length);
  });

  it('mientras no hay número consultado, el campo cae al texto de siempre', () => {
    render(
      <RadicacionFuncionarioForm
        radicadoPreview="Se generará al radicar"
        consecutivoEditado="00000030"
        onConsecutivoChange={() => {}}
      />,
    );
    expect(screen.queryByLabelText('Consecutivo del radicado')).toBeNull();
    expect(screen.getByText('Se generará al radicar')).toBeTruthy();
  });
});
