export type EndpointAiLog = 'classify' | 'chat' | 'scan-doc' | 'copilot';

export interface AiLogSeguro {
  radicadoId: string | null;
  endpoint: EndpointAiLog;
  latenciaMs: number;
  errorPresente: boolean;
  errorCategoria: string | null;
  fallbackActivo: boolean;
  promptVersion: string;
}

export type MotivoAiLogInvalido =
  | 'PAYLOAD_INVALIDO'
  | 'PAYLOAD_DEMASIADO_GRANDE'
  | 'CAMPO_DESCONOCIDO'
  | 'ENDPOINT_INVALIDO'
  | 'LATENCIA_INVALIDA'
  | 'RADICADO_INVALIDO'
  | 'PROMPT_VERSION_INVALIDO';

export type ResultadoAiLogSeguro =
  | { ok: true; data: AiLogSeguro }
  | { ok: false; motivo: MotivoAiLogInvalido; mensaje: string };

export const MAX_AI_LOG_PAYLOAD_BYTES = 4096;

const ENDPOINTS_PERMITIDOS = new Set<EndpointAiLog>(['classify', 'chat', 'scan-doc', 'copilot']);
const CAMPOS_PERMITIDOS = new Set([
  'radicadoId',
  'endpoint',
  'latenciaMs',
  'error',
  'errorCode',
  'fallbackActivo',
  'promptVersion',
]);

const RADICADO_RE = /^[A-Z0-9][A-Z0-9_-]{0,79}$/i;
const TEXTO_CORTO_RE = /^[A-Za-z0-9._:-]{1,80}$/;

export function validarTamanoPayloadAiLog(
  body: string,
): Extract<ResultadoAiLogSeguro, { ok: false }> | null {
  if (Buffer.byteLength(body, 'utf8') > MAX_AI_LOG_PAYLOAD_BYTES) {
    return {
      ok: false,
      motivo: 'PAYLOAD_DEMASIADO_GRANDE',
      mensaje: 'Payload inválido.',
    };
  }
  return null;
}

export function construirAiLogSeguro(payload: unknown): ResultadoAiLogSeguro {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      ok: false,
      motivo: 'PAYLOAD_INVALIDO',
      mensaje: 'Payload inválido.',
    };
  }

  const data = payload as Record<string, unknown>;
  const desconocido = Object.keys(data).find((campo) => !CAMPOS_PERMITIDOS.has(campo));
  if (desconocido) {
    return {
      ok: false,
      motivo: 'CAMPO_DESCONOCIDO',
      mensaje: 'Payload inválido.',
    };
  }

  if (typeof data.endpoint !== 'string' || !ENDPOINTS_PERMITIDOS.has(data.endpoint as EndpointAiLog)) {
    return {
      ok: false,
      motivo: 'ENDPOINT_INVALIDO',
      mensaje: 'Payload inválido.',
    };
  }

  if (
    typeof data.latenciaMs !== 'number'
    || !Number.isFinite(data.latenciaMs)
    || data.latenciaMs < 0
    || data.latenciaMs > 120_000
  ) {
    return {
      ok: false,
      motivo: 'LATENCIA_INVALIDA',
      mensaje: 'Payload inválido.',
    };
  }

  const radicadoId = normalizarRadicadoId(data.radicadoId);
  if (radicadoId === undefined) {
    return {
      ok: false,
      motivo: 'RADICADO_INVALIDO',
      mensaje: 'Payload inválido.',
    };
  }

  const promptVersion = normalizarTextoCorto(data.promptVersion, 'unknown');
  if (promptVersion === undefined) {
    return {
      ok: false,
      motivo: 'PROMPT_VERSION_INVALIDO',
      mensaje: 'Payload inválido.',
    };
  }

  const errorCategoria = normalizarErrorCategoria(data.errorCode, data.error);

  return {
    ok: true,
    data: {
      radicadoId,
      endpoint: data.endpoint as EndpointAiLog,
      latenciaMs: Math.round(data.latenciaMs),
      errorPresente: Boolean(data.error || data.errorCode),
      errorCategoria,
      fallbackActivo: data.fallbackActivo === true,
      promptVersion,
    },
  };
}

function normalizarRadicadoId(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;

  const radicadoId = value.trim();
  if (!RADICADO_RE.test(radicadoId)) return undefined;
  return radicadoId.slice(0, 80);
}

function normalizarTextoCorto(value: unknown, fallback: string): string | undefined {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return undefined;

  const texto = value.trim();
  if (!TEXTO_CORTO_RE.test(texto)) return undefined;
  return texto.slice(0, 80);
}

function normalizarErrorCategoria(errorCode: unknown, error: unknown): string | null {
  const codigo = normalizarTextoCorto(errorCode, '');
  if (codigo) return codigo;
  if (!error) return null;
  return 'ERROR_REGISTRADO';
}
