import { describe, expect, it } from 'vitest';
import { evaluarCompletitud } from '@/lib/motor-expedientes/completitud';
import type { AporteRequisito, ContextoEvaluacionRequisito, DefinicionTramite } from '@/lib/motor-expedientes/tipos';
import type { EstadoVisualRequisito } from '@/app/interno/licencias/estilos-estado-requisito';

/* ══════════════════════════════════════════════════════════════
   El resumen de «Documentos del trámite» es UN SOLO EJE de estado.

   Aportados · Pendientes · Requieren corrección · Sin definir deben ser
   MUTUAMENTE EXCLUYENTES: cada requisito cae en exactamente uno (o en
   «No exigido», el 5.º, que no se muestra como tarjeta). Esta prueba lo
   demuestra sobre el evaluador REAL (`evaluarCompletitud`, sin mocks),
   reproduciendo la MISMA clasificación que hace `ChecklistRequisitos.estadoDe`
   —el orden de exclusión DUPLICADO > INDETERMINADO > NO_APLICA > PENDIENTE >
   APORTADO— y verificando que ningún requisito quede en dos cubos.

   Custodia el fix D-1 (se retiró «Condicionales» del resumen porque es un eje
   de TIPO y se solapaba): si alguien volviera a mezclar ejes, los conjuntos
   dejarían de ser disjuntos y esta prueba se pondría roja.
══════════════════════════════════════════════════════════════ */

const DEF: DefinicionTramite = {
  id: 'excluyentes-test',
  nombre: 'Prueba de exclusividad',
  activo: true,
  terminos: { dias: 45, unidad: 'HABILES' },
  regimenSubsanacion: { dias: 30, unidad: 'HABILES', prorrogaDias: 15, ventanaRequerimiento: { dias: 10, unidad: 'HABILES' } },
  requiereVisita: false,
  generaResolucion: false,
  clavesContexto: [
    { nombre: 'esApoderado', tipo: 'boolean' },
    { nombre: 'requiereActa', tipo: 'boolean' },
  ],
  requisitos: [
    { id: 'r-aportado', nombre: 'Aportado', tipo: 'OBLIGATORIO' },
    { id: 'r-pendiente', nombre: 'Pendiente', tipo: 'OBLIGATORIO' },
    { id: 'r-duplicado', nombre: 'Duplicado', tipo: 'OBLIGATORIO' },
    { id: 'r-indeterminado', nombre: 'Indeterminado', tipo: 'CONDICIONAL', condicion: { operador: 'IGUAL', clave: 'esApoderado', valor: true } },
    { id: 'r-noaplica', nombre: 'No aplica', tipo: 'CONDICIONAL', condicion: { operador: 'IGUAL', clave: 'requiereActa', valor: true } },
    { id: 'r-opcional', nombre: 'Opcional', tipo: 'OPCIONAL' },
  ],
};

/** Reproduce `ChecklistRequisitos.estadoDe` — el ORDEN de exclusión importa. */
function estadoDe(id: string, resultado: ReturnType<typeof evaluarCompletitud>, aportes: AporteRequisito[]): EstadoVisualRequisito {
  if (resultado.aportesDuplicados.some((d) => d.requisitoId === id)) return 'DUPLICADO';
  if (resultado.indeterminados.some((i) => i.requisitoId === id)) return 'INDETERMINADO';
  if (resultado.noAplicables.includes(id)) return 'NO_APLICA';
  if (resultado.faltantes.some((f) => f.requisitoId === id)) return 'PENDIENTE';
  const aporte = aportes.find((a) => a.requisitoId === id);
  return aporte?.estado === 'APORTADO' && aporte.documentoIds.length > 0 ? 'APORTADO' : 'NO_APLICA';
}

describe('Resumen de documentos — estados mutuamente excluyentes (D-1)', () => {
  // Un escenario con los cinco estados presentes a la vez.
  const aportes: AporteRequisito[] = [
    { requisitoId: 'r-aportado', estado: 'APORTADO', documentoIds: ['d1'] },
    // dos aportes para el mismo requisito → DUPLICADO
    { requisitoId: 'r-duplicado', estado: 'APORTADO', documentoIds: ['d2'] },
    { requisitoId: 'r-duplicado', estado: 'APORTADO', documentoIds: ['d3'] },
  ];
  // `esApoderado` ausente → r-indeterminado; `requiereActa=false` → r-noaplica.
  const contexto: ContextoEvaluacionRequisito = { requiereActa: false };

  it('cada requisito cae en EXACTAMENTE un estado', () => {
    const resultado = evaluarCompletitud(DEF, aportes, contexto);
    const porEstado = new Map<EstadoVisualRequisito, string[]>();
    for (const r of DEF.requisitos) {
      const e = estadoDe(r.id, resultado, aportes);
      porEstado.set(e, [...(porEstado.get(e) ?? []), r.id]);
    }

    // El escenario produce los cinco estados, uno por requisito (más el opcional, que es NO_APLICA).
    expect(porEstado.get('APORTADO')).toEqual(['r-aportado']);
    expect(porEstado.get('PENDIENTE')).toEqual(['r-pendiente']);
    expect(porEstado.get('DUPLICADO')).toEqual(['r-duplicado']);
    expect(porEstado.get('INDETERMINADO')).toEqual(['r-indeterminado']);
    // r-noaplica (condición no cumplida) + r-opcional (sin aportar) → NO_APLICA.
    expect(porEstado.get('NO_APLICA')?.sort()).toEqual(['r-noaplica', 'r-opcional']);
  });

  it('las cuatro tarjetas del resumen son conjuntos DISJUNTOS (ningún requisito en dos)', () => {
    const resultado = evaluarCompletitud(DEF, aportes, contexto);

    const aportados = DEF.requisitos.filter((r) => estadoDe(r.id, resultado, aportes) === 'APORTADO').map((r) => r.id);
    const pendientes = resultado.faltantes.map((f) => f.requisitoId);
    const requierenCorreccion = resultado.aportesDuplicados.map((d) => d.requisitoId);
    const sinDefinir = resultado.indeterminados.map((i) => i.requisitoId);

    const cubos = [aportados, pendientes, requierenCorreccion, sinDefinir];
    const union = cubos.flat();
    // Sin solapamiento ⇔ el total de la unión = suma de los tamaños (ningún id repetido).
    expect(new Set(union).size).toBe(union.length);

    // Y cada par es disjunto, explícitamente.
    for (let i = 0; i < cubos.length; i++) {
      for (let j = i + 1; j < cubos.length; j++) {
        const interseccion = cubos[i]!.filter((id) => cubos[j]!.includes(id));
        expect(interseccion, `los cubos ${i} y ${j} deben ser disjuntos`).toEqual([]);
      }
    }
  });

  it('los contadores del resumen = tamaño de cada cubo (misma realidad del evaluador)', () => {
    const resultado = evaluarCompletitud(DEF, aportes, contexto);
    const totalNoOpcionales = DEF.requisitos.filter((r) => r.tipo !== 'OPCIONAL').length;
    const noResueltos = resultado.noAplicables.length + resultado.indeterminados.length + resultado.aportesDuplicados.length;
    const aplicables = Math.max(0, totalNoOpcionales - noResueltos);

    const aportados = Math.max(0, aplicables - resultado.faltantes.length);
    const pendientes = resultado.faltantes.length;
    const requiereCorreccion = resultado.aportesDuplicados.length;
    const sinDefinir = resultado.indeterminados.length;

    expect({ aportados, pendientes, requiereCorreccion, sinDefinir }).toEqual({
      aportados: 1, pendientes: 1, requiereCorreccion: 1, sinDefinir: 1,
    });
    // «Aplicables» = APORTADO + PENDIENTE (los dos estados exigibles que sí contamos).
    expect(aportados + pendientes).toBe(aplicables);
  });
});
