/**
 * Aritmética de calendario del acto. Aparte para que `reglas-acto-lsr.ts`
 * quede legible y para poder probar el caso del 29 de febrero sin montar nada.
 */

/** Suma meses respetando el fin de mes: 31-ene + 1 mes = 28/29-feb, no el 3 de marzo. */
export function sumarMeses(iso: string, meses: number): Date {
  const d = new Date(iso);
  const dia = d.getDate();
  const destino = new Date(d);
  destino.setDate(1);
  destino.setMonth(destino.getMonth() + meses);
  const ultimoDelMes = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(dia, ultimoDelMes));
  destino.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return destino;
}
