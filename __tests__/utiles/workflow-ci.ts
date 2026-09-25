import { readFileSync } from 'node:fs';

/**
 * Lector del workflow de CI: devuelve los PASOS y las CLAVES de un job como
 * registros con sus valores, no como texto suelto donde buscar subcadenas.
 *
 * POR QUÉ EXISTE (barrido de dobles verdes, 30-ago-2026). La prueba «ci.yml
 * corre el gate en el job validate» aseveraba
 * `expect(ci).toContain('run: npm run verificar:indices')` sobre el ARCHIVO
 * ENTERO. Se le añadió al paso un `|| true` —con lo que el gate deja de poder
 * fallar el job— y la prueba siguió pasando: la subcadena seguía ahí, con la
 * neutralización detrás. Un gate que no puede fallar es peor que no tenerlo:
 * ocupa la casilla y nadie vuelve a mirar.
 *
 * POR QUÉ NO js-yaml. El repositorio NO depende de ningún parser de YAML:
 * `js-yaml` aparece en `node_modules` solo como transitiva de eslint —no
 * declarada, y con dictamen de seguridad propio (7-ago-2026)—, así que
 * apoyarse en ella sería acoplarse a un detalle de hoisting. Añadirla como
 * dependencia directa es una decisión de personas, no un efecto colateral de
 * arreglar una prueba.
 *
 * QUÉ ES ESTO ENTONCES: no un parser de YAML, sino un lector del SUBCONJUNTO
 * que usan los workflows de GitHub —mapas anidados por sangría y listas de
 * pasos—, que FALLA RUIDOSAMENTE (lanza) en cuanto no encuentra la forma que
 * espera. Esa es la diferencia que importa: un lector que devolviera vacío
 * ante un cambio de formato reproduciría el doble verde que viene a cerrar.
 *
 * ALCANCE DECLARADO (ADR-0033 §4.6-bis).
 *   LEE: de un job, sus claves escalares de primer nivel (`clavesDelJob`), su
 *   `needs` (`dependenciasDelJob`, en línea `[a, b]` o en lista de guiones),
 *   su mapa `outputs` (`salidasDelJob`) y su lista `steps` (`pasosDelJob`);
 *   de cada paso, sus claves escalares de primer nivel (`name`, `id`, `if`,
 *   `run`, `uses`, `continue-on-error`) más su mapa `env`. Un `run:` con
 *   escalar de bloque `|` o `|-` se devuelve entero, con sus saltos de línea.
 *   NO LEE: `with`, `strategy`/matrices, `on:`/disparadores, anclas y alias
 *   YAML, listas de escalares fuera de `needs`, ni claves multilínea distintas
 *   de `run`. Los escalares plegados (`>`, `>-`) LANZAN en vez de devolver un
 *   valor aproximado. Tampoco interpreta comentarios YAML al final de una
 *   línea de valor: un `run: cmd # nota` quedaría con el comentario dentro (y
 *   pondría en rojo la prueba que exige el comando exacto — se prefiere el
 *   falso rojo visible al verde ciego).
 */

/** Ruta del workflow, relativa a la raíz del repositorio (cwd de vitest). */
export const RUTA_WORKFLOW_CI = '.github/workflows/ci.yml';

/** Un paso de un job, con lo que hace falta para juzgar si un gate puede fallar. */
export type PasoCI = {
  /** `name:` — para nombrar el paso en los mensajes de error. */
  nombre: string | null;
  /** `id:` — el identificador que leen `steps.<id>.outcome` y las salidas del job. */
  id: string | null;
  /** `if:` — condición de ejecución, tal cual está escrita. */
  si: string | null;
  /** `run:` — el comando ENTERO. Es aquí donde se esconde un `|| true`. */
  run: string | null;
  /** `uses:` — acción reutilizable, cuando el paso no corre un comando. */
  usa: string | null;
  /** `continue-on-error:` — `null` si no está declarado. Cualquier valor debilita el gate. */
  continuarSiFalla: string | null;
  /** Mapa `env:` del paso (vacío si no lo declara). */
  env: Record<string, string>;
};

/** Contenido crudo del workflow de CI. Lanza (ENOENT) si el archivo no existe. */
export function leerWorkflowCI(ruta: string = RUTA_WORKFLOW_CI): string {
  return readFileSync(ruta, 'utf8');
}

const esIgnorable = (linea: string): boolean =>
  linea.trim() === '' || linea.trimStart().startsWith('#');

const sangria = (linea: string): number => linea.length - linea.trimStart().length;

function desentrecomillar(valor: string): string {
  const v = valor.trim();
  const comilla = v.slice(0, 1);
  if (v.length >= 2 && (comilla === "'" || comilla === '"') && v.endsWith(comilla)) {
    return v.slice(1, -1);
  }
  return v;
}

/** Líneas que cuelgan de la de índice `inicio` (todas las más sangradas que ella). */
function bloqueDe(lineas: string[], inicio: number): string[] {
  const nivel = sangria(lineas[inicio]!);
  const salida: string[] = [];
  for (let i = inicio + 1; i < lineas.length; i += 1) {
    const linea = lineas[i]!;
    if (esIgnorable(linea)) { salida.push(linea); continue; }
    if (sangria(linea) <= nivel) break;
    salida.push(linea);
  }
  while (salida.length > 0 && esIgnorable(salida[salida.length - 1]!)) salida.pop();
  return salida;
}

/** Índice de la línea `clave:` en `lineas`, al nivel de sangría menos profundo presente. */
function indiceDeClave(lineas: string[], clave: string, donde: string): number {
  const utiles = lineas.map((l, i) => ({ l, i })).filter((x) => !esIgnorable(x.l));
  if (utiles.length === 0) throw new Error(`[workflow-ci] ${donde}: bloque vacío, no hay «${clave}:».`);
  const nivel = Math.min(...utiles.map((x) => sangria(x.l)));
  const encontrada = utiles.filter(
    (x) => sangria(x.l) === nivel && (x.l.trim() === `${clave}:` || x.l.trim().startsWith(`${clave}:`)),
  );
  if (encontrada.length !== 1) {
    throw new Error(
      `[workflow-ci] ${donde}: se esperaba exactamente una clave «${clave}:» al nivel ${nivel}; ` +
      `se encontraron ${encontrada.length}. El formato del workflow cambió.`,
    );
  }
  return encontrada[0]!.i;
}

function bloqueDeJob(workflow: string, job: string): string[] {
  const lineas = workflow.split('\n');
  const iJobs = indiceDeClave(lineas, 'jobs', 'workflow');
  const cuerpoJobs = bloqueDe(lineas, iJobs);
  const iJob = indiceDeClave(cuerpoJobs, job, `jobs.${job}`);
  return bloqueDe(cuerpoJobs, iJob);
}

/** Pares `clave: valor` escalares al nivel de sangría más externo del bloque. */
function escalaresDe(bloque: string[], donde: string): Record<string, string> {
  const utiles = bloque.filter((l) => !esIgnorable(l));
  if (utiles.length === 0) return {};
  const nivel = Math.min(...utiles.map(sangria));
  const salida: Record<string, string> = {};
  for (const linea of utiles) {
    if (sangria(linea) !== nivel) continue;
    const m = /^([A-Za-z0-9_.-]+):(.*)$/.exec(linea.trim());
    if (!m) {
      throw new Error(`[workflow-ci] ${donde}: línea no reconocida como «clave: valor» → «${linea.trim()}».`);
    }
    const valor = m[2]!.trim();
    if (valor === '') continue; // mapa o lista anidada: no es escalar
    salida[m[1]!] = desentrecomillar(valor);
  }
  return salida;
}

/** Claves escalares de primer nivel del job (`name`, `runs-on`, `if`, `needs`, `continue-on-error`…). */
export function clavesDelJob(workflow: string, job: string): Record<string, string> {
  return escalaresDe(bloqueDeJob(workflow, job), `jobs.${job}`);
}

/** `jobs.<job>.outputs` como mapa. Lanza si el job no declara `outputs:`. */
export function salidasDelJob(workflow: string, job: string): Record<string, string> {
  const cuerpo = bloqueDeJob(workflow, job);
  const i = indiceDeClave(cuerpo, 'outputs', `jobs.${job}`);
  return escalaresDe(bloqueDe(cuerpo, i), `jobs.${job}.outputs`);
}

/** `jobs.<job>.needs`, tanto en línea (`[ a, b ]`) como en lista de guiones. */
export function dependenciasDelJob(workflow: string, job: string): string[] {
  const cuerpo = bloqueDeJob(workflow, job);
  const i = indiceDeClave(cuerpo, 'needs', `jobs.${job}`);
  const valor = cuerpo[i]!.trim().slice('needs:'.length).trim();
  if (valor.startsWith('[')) {
    if (!valor.endsWith(']')) {
      throw new Error(`[workflow-ci] jobs.${job}.needs: lista en línea sin cerrar → «${valor}».`);
    }
    return valor.slice(1, -1).split(',').map((x) => desentrecomillar(x)).filter((x) => x !== '');
  }
  if (valor !== '') return [desentrecomillar(valor)];
  const items = bloqueDe(cuerpo, i).filter((l) => !esIgnorable(l));
  return items.map((l) => {
    const t = l.trim();
    if (!t.startsWith('- ')) {
      throw new Error(`[workflow-ci] jobs.${job}.needs: se esperaba una lista de guiones → «${t}».`);
    }
    return desentrecomillar(t.slice(2));
  });
}

/** Escalar de bloque `|`: se devuelve entero, con sus saltos de línea. */
function escalarDeBloque(lineas: string[], inicio: number, donde: string): string {
  const cuerpo = bloqueDe(lineas, inicio).filter((l) => !esIgnorable(l));
  if (cuerpo.length === 0) throw new Error(`[workflow-ci] ${donde}: escalar de bloque vacío.`);
  const nivel = Math.min(...cuerpo.map(sangria));
  return cuerpo.map((l) => l.slice(nivel)).join('\n');
}

function leerPaso(lineas: string[], donde: string): PasoCI {
  const utiles = lineas.map((l, i) => ({ l, i })).filter((x) => !esIgnorable(x.l));
  if (utiles.length === 0) throw new Error(`[workflow-ci] ${donde}: paso sin claves.`);
  const nivel = sangria(utiles[0]!.l);
  const campos: Record<string, string> = {};
  let env: Record<string, string> = {};

  for (const { l, i } of utiles) {
    if (sangria(l) !== nivel) continue;
    const m = /^([A-Za-z0-9_.-]+):(.*)$/.exec(l.trim());
    if (!m) throw new Error(`[workflow-ci] ${donde}: línea no reconocida como «clave: valor» → «${l.trim()}».`);
    const clave = m[1]!;
    const bruto = m[2]!.trim();
    if (clave === 'env') {
      env = escalaresDe(bloqueDe(lineas, i), `${donde}.env`);
      continue;
    }
    if (bruto === '') continue; // mapa o lista anidada (`with:`) — fuera de alcance
    if (bruto === '|' || bruto === '|-') {
      campos[clave] = escalarDeBloque(lineas, i, `${donde}.${clave}`);
      continue;
    }
    if (/^[|>]/.test(bruto)) {
      throw new Error(
        `[workflow-ci] ${donde}.${clave}: escalar de bloque «${bruto}» no modelado. ` +
        'Amplía el lector antes de usar esta forma en el workflow.',
      );
    }
    campos[clave] = desentrecomillar(bruto);
  }

  return {
    nombre: campos['name'] ?? null,
    id: campos['id'] ?? null,
    si: campos['if'] ?? null,
    run: campos['run'] ?? null,
    usa: campos['uses'] ?? null,
    continuarSiFalla: campos['continue-on-error'] ?? null,
    env,
  };
}

/** Pasos de `jobs.<job>.steps`, en orden. Lanza si el job no tiene pasos legibles. */
export function pasosDelJob(workflow: string, job: string): PasoCI[] {
  const cuerpo = bloqueDeJob(workflow, job);
  const iSteps = indiceDeClave(cuerpo, 'steps', `jobs.${job}`);
  const lista = bloqueDe(cuerpo, iSteps);
  const inicios = lista
    .map((l, i) => ({ l, i }))
    .filter((x) => !esIgnorable(x.l) && x.l.trimStart().startsWith('- '));
  if (inicios.length === 0) {
    throw new Error(`[workflow-ci] jobs.${job}.steps: 0 pasos legibles. El formato del workflow cambió.`);
  }
  const nivel = sangria(inicios[0]!.l);
  const anclas = inicios.filter((x) => sangria(x.l) === nivel).map((x) => x.i);

  return anclas.map((inicio, n) => {
    const fin = n + 1 < anclas.length ? anclas[n + 1]! : lista.length;
    const trozo = lista.slice(inicio, fin);
    trozo[0] = trozo[0]!.replace(/^(\s*)-(\s)/, '$1 $2'); // el guion pasa a ser sangría
    return leerPaso(trozo, `jobs.${job}.steps[${n}]`);
  });
}

/** El ÚNICO paso con ese `id`. Lanza si no hay exactamente uno. */
export function pasoConId(pasos: PasoCI[], id: string, job: string): PasoCI {
  const hallados = pasos.filter((p) => p.id === id);
  if (hallados.length !== 1) {
    throw new Error(
      `[workflow-ci] El job «${job}» declara ${hallados.length} pasos con id «${id}»; se esperaba exactamente 1.`,
    );
  }
  return hallados[0]!;
}
