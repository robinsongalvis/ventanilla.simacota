import { describe, it, expect } from 'vitest';
import { validarNumeroRadicadoManual, esNumeroCanonico } from '@/lib/server/numero-radicado-manual';

/**
 * El número que el operario transcribe del LIBRO DE VENTANILLA es la identidad
 * legal del trámite. No se genera aquí: se copia de un papel escrito a mano.
 *
 * Por eso estas pruebas pesan más de lo que parece — un número mal transcrito
 * no se repara después, y dos escrituras del mismo número (con y sin relleno)
 * harían invisible una colisión a la comprobación de unicidad.
 */
const HOY = new Date('2026-08-26T12:00:00-05:00');
const v = (entrada: unknown) => validarNumeroRadicadoManual(entrada, HOY);

describe('el número del libro — lo que se acepta', () => {
  it('acepta la forma canónica de 8 dígitos tal cual', () => {
    const r = v('1-110-202608-00001342');
    expect(r.ok && r.canonico).toBe('1-110-202608-00001342');
    expect(r.ok && r.seNormalizo).toBe(false);
  });

  /* El caso real: el libro escribe 5 dígitos y el sistema 8. Son el MISMO
     número, y guardarlos distintos rompería la unicidad sin que nadie lo vea. */
  it.each([
    ['1-110-202608-01342', '1-110-202608-00001342'],
    ['1-110-202608-1342', '1-110-202608-00001342'],
    ['1-110-202608-27', '1-110-202608-00000027'],
    ['1-110-202608-00027', '1-110-202608-00000027'],
  ])('normaliza %s a %s', (escrito, canonico) => {
    const r = v(escrito);
    expect(r.ok && r.canonico).toBe(canonico);
    expect(r.ok && r.seNormalizo).toBe(true);
    expect(r.ok && r.transcrito).toBe(escrito);
  });

  it('las cuatro escrituras del mismo número dan el MISMO canónico', () => {
    const formas = ['1-110-202608-27', '1-110-202608-027', '1-110-202608-0027', '1-110-202608-00000027'];
    const canonicos = new Set(formas.map((f) => (v(f) as { canonico: string }).canonico));
    expect(canonicos.size).toBe(1);
  });

  it('tolera espacios de más sin cambiar el número', () => {
    expect((v('  1-110-202608-01342 ') as { canonico: string }).canonico).toBe('1-110-202608-00001342');
  });

  it('conserva lo que el operario escribió, para el acta', () => {
    const r = v('1-110-202608-01342');
    expect(r.ok && r.transcrito).toBe('1-110-202608-01342');
  });
});

describe('el número del libro — lo que se rechaza, y por qué', () => {
  it.each([
    ['vacío', ''],
    ['no es texto', 42],
    ['sin el prefijo de ventanilla', '2-110-202608-01342'],
    ['otra oficina', '1-999-202608-01342'],
    ['mes 13', '1-110-202613-01342'],
    ['mes 00', '1-110-202600-01342'],
    ['sin mes', '1-110-2026-01342'],
    ['más de 8 dígitos', '1-110-202608-000013420'],
    ['con letras', '1-110-202608-0134A'],
    ['formato de expediente', '68745-0-26-0046'],
  ])('rechaza %s', (_caso, entrada) => {
    expect(v(entrada).ok).toBe(false);
  });

  it('el consecutivo cero se rechaza: el libro no empieza en cero', () => {
    const r = v('1-110-202608-00000000');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/cero/i);
  });

  /* Un dedazo en el año o el mes fija la serie ANUAL equivocada, y eso ya no se
     corrige con una explicación. */
  it('rechaza un número del futuro y dice qué revisar', () => {
    const r = v('1-110-202612-00001342');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/todavía no ha llegado/i);
  });

  it('rechaza un número de hace más de cinco años y ofrece el camino correcto', () => {
    const r = v('1-110-201608-00001342');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/históricos/i);
  });

  it('el mensaje de formato enseña un ejemplo, no solo la regla', () => {
    const r = v('cualquier cosa');
    expect(!r.ok && r.motivo).toMatch(/1-110-202608-01342/);
  });
});

describe('lo canónico es lo que emite la plataforma', () => {
  it('reconoce la forma que ya usa el sistema', () => {
    expect(esNumeroCanonico('1-110-202608-00001342')).toBe(true);
    expect(esNumeroCanonico('1-110-202608-01342')).toBe(false);
  });
});
