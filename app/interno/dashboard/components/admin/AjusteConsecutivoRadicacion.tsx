'use client';

/**
 * Apertura única de la serie real de radicación.
 *
 * La pantalla solo propone y confirma el primer consecutivo. La autorización,
 * las colisiones, la atomicidad y el bloqueo definitivo se validan siempre en
 * el servidor.
 */

import { FormEvent, useCallback, useEffect, useState } from 'react';

interface AperturaSerie {
  estado: 'BLOQUEADA';
  primerNumero: number;
  veniaDe: number;
  fecha: string;
  fechaHoraBogota: string;
  actorNombre?: string | null;
}

interface EstadoSerie {
  anio: number;
  ultimo: number;
  proximoRadicado: string;
  openingAlreadyExists: boolean;
  primerNumeroSugerido: number;
  apertura?: AperturaSerie;
}

type RespuestaApi = Partial<EstadoSerie> & {
  ok?: boolean;
  error?: string;
  idempotente?: boolean;
};

function esEstadoSerie(data: RespuestaApi): data is RespuestaApi & EstadoSerie {
  return Number.isInteger(data.anio)
    && Number.isInteger(data.ultimo)
    && typeof data.proximoRadicado === 'string'
    && typeof data.openingAlreadyExists === 'boolean'
    && Number.isInteger(data.primerNumeroSugerido);
}

function radicadoConConsecutivo(radicadoBase: string, consecutivo: number): string {
  const prefijo = radicadoBase.match(/^(1-110-\d{6})-\d+$/)?.[1];
  return prefijo
    ? `${prefijo}-${String(consecutivo).padStart(8, '0')}`
    : String(consecutivo);
}

function mensajeError(status: number, data: RespuestaApi, accion: 'consultar' | 'abrir'): string {
  if (status === 401) return 'Su sesión venció. Inicie sesión nuevamente antes de abrir la serie.';
  if (status === 403) return 'Solo una persona con rol ADMIN puede abrir la serie de radicación.';
  if (status === 409) {
    return data.error ?? 'La serie ya fue abierta o su estado cambió. Actualice la consulta antes de continuar.';
  }
  if (status >= 500) {
    return accion === 'abrir'
      ? 'No fue posible abrir la serie. No se guardó ningún cambio; inténtelo nuevamente.'
      : 'No fue posible consultar el estado de la serie.';
  }
  return data.error ?? (accion === 'abrir'
    ? 'No fue posible abrir la serie.'
    : 'No fue posible consultar el estado de la serie.');
}

async function leerRespuesta(response: Response): Promise<RespuestaApi> {
  return response.json().catch(() => ({})) as Promise<RespuestaApi>;
}

export function AjusteConsecutivoRadicacion() {
  const [estado, setEstado] = useState<EstadoSerie | null>(null);
  const [cargando, setCargando] = useState(true);
  const [valor, setValor] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const response = await fetch('/api/interno/consecutivo-radicacion', { credentials: 'include' });
      const data = await leerRespuesta(response);
      if (!response.ok) {
        setEstado(null);
        setError(mensajeError(response.status, data, 'consultar'));
        return;
      }
      if (!esEstadoSerie(data)) {
        setEstado(null);
        setError('El servidor devolvió un estado incompleto de la serie. No se habilitó la apertura.');
        return;
      }

      setEstado(data);
      if (data.openingAlreadyExists) {
        setValor('');
        setConfirmado(false);
      } else {
        setValor(String(data.primerNumeroSugerido));
      }
    } catch {
      setEstado(null);
      setError('No fue posible consultar el estado de la serie.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const numero = Number(valor);
  const numeroValido = valor.trim() !== ''
    && Number.isInteger(numero)
    && numero > 0
    && numero <= 99_999_999;
  const superaContador = numeroValido && estado !== null && numero > estado.ultimo;
  const vistaPrevia = superaContador && estado
    ? radicadoConConsecutivo(estado.proximoRadicado, numero)
    : null;
  const apertura = estado?.openingAlreadyExists ? estado.apertura : undefined;

  async function abrirSerie(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!estado || estado.openingAlreadyExists || !superaContador || !confirmado) return;

    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      const response = await fetch('/api/interno/consecutivo-radicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ primerNumero: numero }),
      });
      const data = await leerRespuesta(response);
      if (!response.ok) {
        setError(mensajeError(response.status, data, 'abrir'));
        return;
      }
      if (!esEstadoSerie(data) || !data.openingAlreadyExists || !data.apertura) {
        setError('El servidor no confirmó el bloqueo de la apertura. Consulte el estado antes de continuar.');
        return;
      }

      setEstado(data);
      setValor('');
      setConfirmado(false);
      setExito(data.idempotente
        ? `La serie ya estaba abierta desde ${data.apertura.primerNumero}. No se realizó una segunda apertura.`
        : `Serie abierta desde ${data.apertura.primerNumero}. La configuración quedó bloqueada.`);
    } catch {
      setError('No fue posible abrir la serie. No se guardó ningún cambio; inténtelo nuevamente.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section
      className="rounded-2xl p-5"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}
      aria-labelledby="apertura-serie-titulo"
    >
      <h3 id="apertura-serie-titulo" className="font-headline text-lg font-black" style={{ color: 'var(--text-primary)' }}>
        Apertura de serie
      </h3>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Define una sola vez el primer consecutivo real de radicación. Después de confirmar, este valor no podrá editarse.
      </p>

      {cargando ? (
        <p role="status" className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}>
          Consultando el estado de la serie…
        </p>
      ) : estado ? (
        <>
          <div className="mt-4 rounded-xl px-4 py-3" style={{ background: 'var(--bg-surface-2)' }}>
            {estado.openingAlreadyExists && apertura ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#116932' }}>
                  Apertura confirmada
                </p>
                <p className="mt-1 text-base font-black" style={{ color: 'var(--text-primary)' }}>
                  Serie abierta desde {apertura.primerNumero}
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  La configuración está bloqueada y los siguientes consecutivos se asignan automáticamente.
                </p>
                <dl className="mt-3 grid gap-1 text-xs sm:grid-cols-2" style={{ color: 'var(--text-secondary)' }}>
                  <div><dt className="inline font-semibold">Contador anterior: </dt><dd className="inline">{apertura.veniaDe}</dd></div>
                  <div><dt className="inline font-semibold">Fecha de apertura: </dt><dd className="inline">{apertura.fechaHoraBogota}</dd></div>
                  {apertura.actorNombre && (
                    <div className="sm:col-span-2"><dt className="inline font-semibold">Abierta por: </dt><dd className="inline">{apertura.actorNombre}</dd></div>
                  )}
                </dl>
              </>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Último contador de prueba
                  </dt>
                  <dd className="mt-0.5 text-lg font-black" style={{ color: 'var(--text-primary)' }}>{estado.ultimo}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Primer consecutivo real sugerido
                  </dt>
                  <dd className="mt-0.5 text-lg font-black" style={{ color: 'var(--text-primary)' }}>{estado.primerNumeroSugerido}</dd>
                </div>
              </dl>
            )}
          </div>

          {!estado.openingAlreadyExists && (
            <form className="mt-4 flex flex-col gap-3" onSubmit={(event) => void abrirSerie(event)}>
              <label htmlFor="primer-consecutivo-real" className="flex flex-col gap-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Primer consecutivo real
                </span>
                <input
                  id="primer-consecutivo-real"
                  type="number"
                  inputMode="numeric"
                  min={estado.ultimo + 1}
                  max={99_999_999}
                  step={1}
                  required
                  value={valor}
                  onChange={(event) => {
                    setValor(event.target.value);
                    setConfirmado(false);
                    setError(null);
                    setExito(null);
                  }}
                  aria-describedby="primer-consecutivo-ayuda"
                  className="w-full max-w-[240px] rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', color: 'var(--text-primary)' }}
                />
                <span id="primer-consecutivo-ayuda" className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Escriba únicamente el número inicial. Debe ser superior a {estado.ultimo}.
                </span>
              </label>

              {numeroValido && !superaContador && (
                <p role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
                  <strong>El número no es válido.</strong> Debe ser superior al último contador de prueba ({estado.ultimo}).
                </p>
              )}

              {vistaPrevia && (
                <div className="rounded-xl px-4 py-3" style={{ background: '#EEF4EE', border: '1px solid #CDE9D6' }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
                    Primer radicado real
                  </p>
                  <p className="mt-0.5 break-all font-mono text-base font-black" style={{ color: '#116932' }}>
                    {vistaPrevia}
                  </p>
                </div>
              )}

              <label className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: '#FFF8E7', border: '1px solid #F4D58D', color: '#713F12' }}>
                <input
                  type="checkbox"
                  checked={confirmado}
                  onChange={(event) => setConfirmado(event.target.checked)}
                  disabled={!superaContador || guardando}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>
                  Confirmo que el sistema o libro anterior quedó congelado y que <strong>{numeroValido ? numero : 'este número'}</strong> será el primer consecutivo real. Entiendo que esta apertura es única y quedará bloqueada.
                </span>
              </label>

              <div>
                <button
                  type="submit"
                  disabled={!superaContador || !confirmado || guardando}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2"
                  style={{ background: '#14532D', color: '#fff' }}
                >
                  {guardando ? 'Abriendo serie…' : 'Abrir serie una sola vez'}
                </button>
              </div>

              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Esta acción no crea un radicado ni consume el primer número. Solo deja preparada y bloqueada la serie para el primer trámite real.
              </p>
            </form>
          )}
        </>
      ) : null}

      {error && (
        <div className="mt-4">
          <p role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
            {error}
          </p>
          {!estado && (
            <button
              type="button"
              onClick={() => void cargar()}
              className="mt-3 rounded-xl px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2"
              style={{ border: '1px solid var(--color-border)', color: 'var(--text-primary)' }}
            >
              Volver a consultar
            </button>
          )}
        </div>
      )}

      {exito && (
        <p role="status" className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: '#EEF4EE', border: '1px solid #CDE9D6', color: '#116932' }}>
          {exito}
        </p>
      )}
    </section>
  );
}
