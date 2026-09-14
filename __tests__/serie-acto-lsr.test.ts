import { describe, expect, it } from 'vitest';
import {
  SERIE_DE_LA_MODALIDAD, ULTIMO_CONFIRMADO_2026, ULTIMO_RADICADO_2026,
  formatearNumeroActo, leerNumeroActo, siguienteConsecutivo, type ModalidadActo,
} from '@/lib/motor-expedientes/acto-lsr/serie-acto-lsr';
import {
  PARAMETROS_DECIDIDOS, PROCEDENCIA, TEXTO_RECURSOS_RESOLUCION_LSR,
} from '@/lib/motor-expedientes/acto-lsr/decisiones-tomadas';
import { decisionesQueFaltan } from '@/lib/motor-expedientes/acto-lsr/decisiones-pendientes';
import { generarActoLsr, renderTextoActo } from '@/lib/motor-expedientes/acto-lsr/generar-acto-lsr';
import { datosVacios } from '@/lib/motor-expedientes/acto-lsr/datos-acto-lsr';

/* ══════════════════════════════════════════════════════════════
   LAS CUATRO DECISIONES, YA TOMADAS — y lo que quedó anotado de cada una.

   Planeación y Jurídica respondieron el 14-sep-2026. Dos de las respuestas se
   apartan de una fuente escrita, y esa distancia no se disimula: se aplica lo
   decidido y la salvedad queda en el código, que es lo que un expediente
   necesita para defenderse el día que alguien reclame.

   ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────

   Esto MIRA: que el número se escriba como se decidió; que el consecutivo
   reinicie por año; que LA no abra contador propio mientras su descripción sea
   ambigua; y que las salvedades sigan escritas.

   Esto NO MIRA: la apertura de las series en producción (paso 5 del ADR-0041,
   la ordena el propietario), ni la emisión de un número real.
══════════════════════════════════════════════════════════════ */

describe('el número se escribe como lo decidió Planeación', () => {
  it('«LSR No. 001-2025», con tres dígitos', () => {
    expect(formatearNumeroActo('LSR', 1, 2025)).toBe('LSR No. 001-2025');
    expect(formatearNumeroActo('LC', 13, 2026)).toBe('LC No. 013-2026');
  });

  it('NO se escribe como el acto real de enero', () => {
    /* El acto que tenemos dice «LSR No. 001 DE 2.025». Se adoptó la otra forma
       a sabiendas, y la salvedad está escrita: los actos ya expedidos no se
       reescriben (AGN 060). */
    expect(formatearNumeroActo('LSR', 1, 2025)).not.toContain('DE 2.025');
  });

  it('lo escrito se puede volver a leer', () => {
    expect(leerNumeroActo('LSR No. 001-2025')).toEqual({ modalidad: 'LSR', consecutivo: 1, anio: 2025 });
    expect(leerNumeroActo('lsr no. 013-2026')).toEqual({ modalidad: 'LSR', consecutivo: 13, anio: 2026 });
    expect(leerNumeroActo('LSR No. 001 DE 2.025'), 'leyó como propia la forma antigua').toBeNull();
    expect(leerNumeroActo('cualquier cosa')).toBeNull();
  });
});

describe('el consecutivo reinicia cada año', () => {
  it('el primero del año es 001, aunque el año anterior fuera 013', () => {
    expect(siguienteConsecutivo({ consecutivo: 13, anio: 2026 }, 2027)).toBe(1);
  });

  it('dentro del mismo año, sigue', () => {
    expect(siguienteConsecutivo({ consecutivo: 13, anio: 2026 }, 2026)).toBe(14);
  });

  it('sin historia, empieza en 001', () => {
    expect(siguienteConsecutivo(null, 2026)).toBe(1);
  });

  it('el libro de 2026 lo confirma: LSR fue 001 en 2025 y va en 013 en 2026', () => {
    expect(ULTIMO_CONFIRMADO_2026.LSR).toBe(13);
    expect(siguienteConsecutivo({ consecutivo: 13, anio: 2026 }, 2026)).toBe(14);
  });
});

describe('LA no abre contador propio — el error recuperable', () => {
  it('apunta a la serie de LC', () => {
    /* «Es la misma de LC en términos, pero siguen siendo diferentes» admite dos
       lecturas, y el ingeniero no dio último número para LA. Si compartiera y le
       abriéramos serie propia, la primera ampliación se llevaría un número que
       LC ya usó: dos actos con el mismo número. Al revés solo queda un hueco.
       Se elige el error que se puede explicar. */
    expect(SERIE_DE_LA_MODALIDAD.LA).toBe('LC');
  });

  it('las demás usan la suya', () => {
    for (const m of ['LSR', 'LC', 'LSU', 'PH', 'LR', 'LU'] as ModalidadActo[]) {
      expect(SERIE_DE_LA_MODALIDAD[m], `${m} dejó de tener serie propia`).toBe(m);
    }
  });

  it('y por eso LA no tiene último número confirmado', () => {
    expect(ULTIMO_CONFIRMADO_2026.LA).toBeUndefined();
    /* LU tampoco: el ingeniero respondió «no tiene». Abriría en 001 al usarse. */
    expect(ULTIMO_CONFIRMADO_2026.LU).toBeUndefined();
  });

  it('el radicado de entrada abre en 0026', () => {
    expect(ULTIMO_RADICADO_2026).toBe(25);
  });
});

describe('las salvedades quedan escritas, no de palabra', () => {
  it('las cuatro decisiones declaran quién las tomó y cuándo', () => {
    expect(PROCEDENCIA).toHaveLength(4);
    for (const p of PROCEDENCIA) {
      expect(p.quienDecidio.length, `${p.decision} sin autor`).toBeGreaterThan(5);
      expect(p.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('la vigencia deja constancia de que se aparta de la norma transcrita', () => {
    /* Es la que más pesa: contar desde la expedición le recorta días de licencia
       al titular frente a lo que dice el D.1783 art. 27. */
    const vigencia = PROCEDENCIA.find((p) => p.decision.startsWith('ORIGEN_VIGENCIA'));
    expect(vigencia!.salvedad).toMatch(/1783/);
    expect(vigencia!.salvedad).toMatch(/firmeza/i);
    expect(vigencia!.salvedad, 'no dice que la decisión va en contra del titular').toMatch(/en contra del titular/);
  });

  it('el formato deja constancia de que no es el del acto real', () => {
    const formato = PROCEDENCIA.find((p) => p.decision.startsWith('FORMATO_DEL_NUMERO'));
    expect(formato!.salvedad).toMatch(/DE 2\.025/);
    expect(formato!.salvedad, 'no dice qué pasa con lo ya expedido').toMatch(/no se reescriben/);
  });

  it('los recursos corrigen el acto real, y la fórmula sigue reservada', () => {
    expect(TEXTO_RECURSOS_RESOLUCION_LSR).toMatch(/únicamente el recurso de reposición/);
    expect(TEXTO_RECURSOS_RESOLUCION_LSR).toMatch(/No procede recurso de apelación/);
    expect(TEXTO_RECURSOS_RESOLUCION_LSR).toMatch(/art\. 76/);
  });
});

describe('con las respuestas puestas, al generador ya no le falta ninguna decisión', () => {
  it('solo queda el número, que se emite en su momento', () => {
    const conNumero = { ...PARAMETROS_DECIDIDOS, numeroResolucion: formatearNumeroActo('LSR', 14, 2026) };
    expect(decisionesQueFaltan(conNumero)).toEqual([]);
  });

  it('sin número emitido, el generador sigue negándose — y no se lo inventa', () => {
    /* La regla no se relaja porque las decisiones ya estén tomadas: el número
       sale de un contador que nadie ha abierto todavía (paso 5 del ADR-0041). */
    const acto = generarActoLsr(datosVacios(), { ...PARAMETROS_DECIDIDOS, numeroResolucion: null });
    expect(acto.puedeExpedirse).toBe(false);
    expect(renderTextoActo(acto)).toContain('FALTA: El número de la resolución');
  });

  it('el texto de recursos que se imprime es el decidido, no uno inventado', () => {
    const acto = generarActoLsr(datosVacios(), { ...PARAMETROS_DECIDIDOS, numeroResolucion: 'LSR No. 014-2026' });
    const texto = renderTextoActo(acto);
    expect(texto).toMatch(/únicamente el recurso de reposición/);
    expect(texto, 'volvió a aparecer la apelación del acto real').not.toMatch(/recursos de reposición y apelación/);
  });
});
