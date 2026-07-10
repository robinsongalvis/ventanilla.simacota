/**
 * scripts/laboratorio/dev-stage.mjs
 *
 * Lanza `next dev` con el entorno de STAGE cargado desde .env.stage.
 * Se usa un lanzador Node (y no `source` de shell) porque
 * FIREBASE_SERVICE_ACCOUNT es un JSON con comillas que el shell mutila.
 *
 * Uso: npm run dev:stage
 */
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const PROYECTO_PROD = 'ventanilla-unica-f31b1';

const env = { ...process.env };
for (const linea of readFileSync(resolve('.env.stage'), 'utf8').split('\n')) {
  if (!linea || linea.startsWith('#') || !linea.includes('=')) continue;
  const i = linea.indexOf('=');
  env[linea.slice(0, i)] = linea.slice(i + 1);
}

if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === PROYECTO_PROD) {
  console.error('⛔ GUARDA: .env.stage apunta a producción. Abortado.');
  process.exit(1);
}

console.log(`▶ next dev contra ${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
const hijo = spawn('npx', ['next', 'dev'], { env, stdio: 'inherit' });
hijo.on('exit', (code) => process.exit(code ?? 0));
