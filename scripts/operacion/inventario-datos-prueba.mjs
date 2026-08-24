/**
 * scripts/operacion/inventario-datos-prueba.mjs
 *
 * INVENTARIO en SOLO LECTURA de los datos de prueba que quedaron en la base,
 * como insumo de la limpieza previa al go-live (PLAN_GO_LIVE §Limpieza).
 *
 * POR QUÉ CLASIFICA COMO CLASIFICA. Los registros de prueba son de dos
 * clases con destinos distintos:
 *   C1 BORRABLE — fuera de la serie legal (p. ej. `1-WEB-*` del botón de
 *      prueba) Y con marca explícita de prueba: borrarlos no deja hueco en
 *      la foliación AGN.
 *   C2 ANULAR — DENTRO de la serie legal (`1-110-*`) Y con marca explícita:
 *      NO se borran; se anulan con acta, como en el libro de papel. El
 *      número se pierde con constancia; el registro queda.
 *   C3 CUARENTENA — SIN marca explícita pero con indicios (nombre/asunto
 *      con "prueba"/"test"/"uat"): NO se recomienda acción; se listan para
 *      decisión humana. Un indicio no es una marca — un ciudadano real
 *      puede llamarse "Prueba" de apellido o preguntar por "pruebas de
 *      laboratorio".
 *
 * EL FORMATO DEL NÚMERO NO ES CRITERIO. La serie convivió con dos formatos
 * (1-110-{AAAA}- histórico y 1-110-{AAAAMM}- vigente) porque el 15-jul se
 * adoptó el consecutivo de la alcaldía por continuidad institucional: un
 * radicado con formato viejo es tan legítimo como uno nuevo. El reporte
 * segmenta por formato SOLO para revisión, jamás para recomendar.
 *
 * SOLO LECTURA: este archivo no contiene una sola llamada de escritura, y
 * la guarda de abajo lo hace fallar si el proyecto no coincide con el que
 * se le ordena inventariar. El detalle con PII va a un `.local.json` que el
 * .gitignore excluye; a stdout solo salen conteos e ids.
 *
 * Uso:
 *   FIREBASE_SERVICE_ACCOUNT="$(grep '^FIREBASE_SERVICE_ACCOUNT=' .env.X | cut -d= -f2-)" \
 *     node scripts/operacion/inventario-datos-prueba.mjs --proyecto <project_id>
 */
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { writeFileSync } from 'node:fs';

function arg(nombre) {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? undefined : process.argv[i + 1];
}

const proyectoOrdenado = arg('--proyecto');
if (!proyectoOrdenado) {
  console.error('Uso: node scripts/operacion/inventario-datos-prueba.mjs --proyecto <project_id>');
  process.exit(1);
}

const crudo = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!crudo) {
  console.error('Falta FIREBASE_SERVICE_ACCOUNT en el entorno.');
  process.exit(2);
}
// El .env puede traer el valor entre comillas (dotenv las quita al cargar;
// un `grep | cut` crudo no). Se toleran aquí para que el comando documentado
// funcione tal cual — falló en el primer uso real por esto.
const sinComillas = crudo.trim().replace(/^['"]/, '').replace(/['"]$/, '');
let credencial;
try {
  credencial = JSON.parse(sinComillas);
} catch (e) {
  console.error('FIREBASE_SERVICE_ACCOUNT no es JSON válido:', e.message);
  process.exit(2);
}
// GUARDA: la credencial debe ser EXACTAMENTE la del proyecto ordenado. Sin
// esto, un .env equivocado inventariaría (o mañana, limpiaría) otra base.
if (credencial.project_id !== proyectoOrdenado) {
  console.error(`⛔ GUARDA: la credencial es de "${credencial.project_id}" pero se ordenó "${proyectoOrdenado}". Nada se leyó.`);
  process.exit(3);
}

if (!getApps().length) initializeApp({ credential: cert(credencial), projectId: proyectoOrdenado });
const db = getFirestore();

// Series CONSECUTIVAS oficiales: radicados (1-110), salidas (2-SAL/2-110) y
// planillas (PL). Borrar un doc marcado de CUALQUIERA deja hueco en su
// foliación — el ensayo en stage atrapó ese error cuando esta constante solo
// cubría 1-110: las salidas de prueba salían «borrables» y no lo son.
// Incluye las etiquetas históricas por canal (1-WEB/OFICIO/EMAIL/PRESENCIAL),
// que son la MISMA serie anual con otra máscara — pero solo cuando el último
// segmento está rellenado con ceros (`000` + 5 dígitos = consecutivos 1‥99999,
// que es como los escribe padStart(8,'0')). Esa distinción importa: el botón
// E2E emitía `1-WEB-2026-{8 dígitos ALEATORIOS}` SIN tocar el contador
// (64476419, 81440313…), y esos sí eran borrables — de hecho se borraron en la
// ronda del 23-ago. Sin el ancla de los ceros, meter el canal en esta constante
// habría convertido en «anulables» unos registros que no consumieron nada.
const RE_SERIE_LEGAL = /^(1-110-\d{4,6}-\d{8}|1-(?:WEB|OFICIO|EMAIL|PRESENCIAL)-\d{4,6}-000\d{5}|2-(?:SAL|110)-\d{4,6}-\d{8}|PL-\d{4}-\d{4})$/;
const RE_FORMATO_VIEJO = /^1-110-\d{4}-\d{8}$/;
const RE_INDICIO = /\b(prueba|test|uat|ensayo|demo)\b/i;

const marcaExplicita = (d) =>
  d.isTest === true || d.excludeFromMetrics === true || d.esPrueba === true ||
  typeof d?.laboratorio?.generador === 'string';

const resumen = { proyecto: proyectoOrdenado, fecha: new Date().toISOString(), colecciones: {} };
const detalle = { ...resumen, registros: {} };

async function inventariar(coleccion, describir) {
  const snap = await db.collection(coleccion).get();
  const filas = { C1_BORRABLE: [], C2_ANULAR: [], C3_CUARENTENA: [], LEGITIMOS: 0, formatoViejo: 0, formatoNuevo: 0 };
  for (const doc of snap.docs) {
    const d = doc.data();
    // PERTENECER A LA SERIE SE PRUEBA POR EL DATO, NO POR EL NOMBRE. El id
    // solo lleva una máscara, y la máscara cambió con el tiempo: `1-WEB-…`,
    // `1-OFICIO-…`, `1-EMAIL-…` y `1-PRESENCIAL-…` son etiquetas HISTÓRICAS
    // POR CANAL del MISMO consecutivo anual que hoy se escribe `1-110-…`
    // (lib/radicado-institucional.ts: «el consecutivo anual continúa: solo
    // cambia la máscara»; la consulta pública las acepta en una sola
    // expresión). Clasificar por el prefijo daba «fuera de la serie» a
    // radicados que SÍ consumieron el contador — y por tanto «borrables» a
    // registros cuyo borrado deja hueco en la foliación AGN. La prueba dura
    // es el campo `consecutivo`: si el documento lo guarda, salió del
    // contador. El regex se conserva solo como señal secundaria, para que un
    // documento de la serie al que le falte el campo tampoco caiga en
    // borrable.
    const consumioContador = typeof d.consecutivo === 'number';
    const enSerieLegal = consumioContador || RE_SERIE_LEGAL.test(doc.id);
    if (RE_FORMATO_VIEJO.test(doc.id)) filas.formatoViejo += 1;
    else if (enSerieLegal) filas.formatoNuevo += 1;
    const marcado = marcaExplicita(d);
    const texto = describir(d);
    if (marcado && !enSerieLegal) filas.C1_BORRABLE.push({ id: doc.id, ...texto });
    else if (marcado && enSerieLegal) filas.C2_ANULAR.push({ id: doc.id, ...texto });
    else if (!marcado && RE_INDICIO.test(JSON.stringify(texto))) filas.C3_CUARENTENA.push({ id: doc.id, ...texto });
    else filas.LEGITIMOS += 1;
  }
  resumen.colecciones[coleccion] = {
    total: snap.size,
    C1_BORRABLE: filas.C1_BORRABLE.length,
    C2_ANULAR: filas.C2_ANULAR.length,
    C3_CUARENTENA: filas.C3_CUARENTENA.length,
    LEGITIMOS: filas.LEGITIMOS,
    formatoViejo: filas.formatoViejo,
    formatoNuevo: filas.formatoNuevo,
  };
  detalle.registros[coleccion] = filas;
}

await inventariar('ventanilla_radicados', (d) => ({
  nombre: d?.solicitante?.nombreCompleto ?? null,
  asunto: d?.detalle?.asunto ?? null,
  estado: d?.estadoActual ?? null,
  fecha: d?.control?.fechaRadicado ?? null,
  marcas: { isTest: d.isTest === true, excludeFromMetrics: d.excludeFromMetrics === true, generador: d?.laboratorio?.generador ?? null },
}));
await inventariar('expedientes', (d) => ({
  numero: d?.numeroExpediente ?? null,
  solicitante: d?.solicitanteNombre ?? d?.solicitante?.nombreCompleto ?? null,
  esPrueba: d.esPrueba === true,
  origen: d?.origen ?? null,
}));
await inventariar('ventanilla_salidas', (d) => ({
  asunto: d?.asunto ?? null,
  destinatario: d?.destinatarioNombre ?? null,
  marcas: { isTest: d.isTest === true },
}));
await inventariar('ventanilla_planillas', (d) => ({
  fecha: d?.fecha ?? null,
  marcas: { isTest: d.isTest === true },
}));

const RUTA_DETALLE = 'docs/auditorias/inventario-datos-prueba.local.json';
writeFileSync(RUTA_DETALLE, JSON.stringify(detalle, null, 2));

console.log(`Inventario de datos de prueba · ${proyectoOrdenado} · SOLO LECTURA\n`);
for (const [col, r] of Object.entries(resumen.colecciones)) {
  console.log(`${col}: ${r.total} docs · C1 borrable=${r.C1_BORRABLE} · C2 anular=${r.C2_ANULAR} · C3 cuarentena=${r.C3_CUARENTENA} · legítimos=${r.LEGITIMOS}` +
    (col === 'ventanilla_radicados' ? ` · formato viejo=${r.formatoViejo} / nuevo=${r.formatoNuevo}` : ''));
}
console.log(`\nIds por clase (el detalle con PII quedó SOLO en ${RUTA_DETALLE}, fuera de git):`);
for (const [col, filas] of Object.entries(detalle.registros)) {
  for (const clase of ['C1_BORRABLE', 'C2_ANULAR', 'C3_CUARENTENA']) {
    if (filas[clase].length) console.log(`  ${col} · ${clase}: ${filas[clase].map((x) => x.id).join(', ')}`);
  }
}
