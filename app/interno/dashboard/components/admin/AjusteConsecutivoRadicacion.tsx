'use client';

/**
 * Ajuste del consecutivo de radicación — relevo del software anterior.
 *
 * La Alcaldía viene de otro sistema que sigue emitiendo radicados hasta el día
 * del corte. Cuál será el último NO se sabe por adelantado: hay días en que no
 * llega nada y días en que el número salta decenas. El dato lo tiene la
 * funcionaria de ventanilla, en su libro, el día del relevo.
 *
 * Por eso esta pantalla existe: para que quien administra lo declare cuando lo
 * sepa, sin depender de nadie técnico. La decisión la valida SIEMPRE el
 * servidor — aquí solo se ayuda a verla venir.
 */

import { useCallback, useEffect, useState } from 'react';
import { formatearRadicadoInstitucional } from '@/lib/radicado-institucional';

interface Estado {
  anio: number;
  ultimo: number;
  proximoRadicado: string;
}

export function AjusteConsecutivoRadicacion() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/interno/consecutivo-radicacion', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setEstado(data);
      else setError(data.error ?? 'No fue posible consultar el consecutivo.');
    } catch {
      setError('No fue posible consultar el consecutivo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const numero = Number(valor);
  const valorValido = valor.trim() !== '' && Number.isInteger(numero) && numero >= 0;
  /* Vista previa EN VIVO: quien ajusta tiene que ver el identificador completo
     antes de aceptar — es la única forma de cazar un dedazo antes de que se
     convierta en la identidad legal de un trámite. */
  const vistaPrevia = valorValido ? formatearRadicadoInstitucional(numero + 1) : null;
  const retrocede = valorValido && estado != null && numero < estado.ultimo;

  async function guardar() {
    if (!valorValido || !estado) return;
    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      const res = await fetch('/api/interno/consecutivo-radicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ultimoDelSistemaAnterior: numero, motivo: motivo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'No fue posible ajustar el consecutivo.'); return; }
      setExito(`Listo. El próximo radicado será ${data.proximoRadicado}`);
      setValor('');
      setMotivo('');
      await cargar();
    } catch {
      setError('No fue posible ajustar el consecutivo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section
      className="rounded-2xl p-5"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}
      aria-label="Consecutivo de radicación"
    >
      <h3 className="font-headline text-lg font-black" style={{ color: 'var(--text-primary)' }}>
        Consecutivo de radicación
      </h3>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Úselo el día del relevo del software anterior: escriba el <strong>último radicado</strong> que
        quedó allí y este sistema continuará desde el siguiente, sin huecos y sin repetir.
      </p>

      {/* Estado actual */}
      <div className="mt-4 rounded-xl px-4 py-3" style={{ background: 'var(--bg-surface-2)' }}>
        {cargando ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Consultando…</p>
        ) : estado ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Ahora mismo
            </p>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Último emitido: <strong style={{ color: 'var(--text-primary)' }}>{estado.ultimo}</strong>
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              El próximo radicado sería{' '}
              <strong className="font-mono" style={{ color: 'var(--text-primary)' }}>{estado.proximoRadicado}</strong>
            </p>
          </>
        ) : null}
      </div>

      {/* Formulario */}
      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Último radicado del sistema anterior
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={valor}
            onChange={(e) => { setValor(e.target.value); setError(null); setExito(null); }}
            placeholder="Ej.: 1779"
            className="w-full max-w-[220px] rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', color: 'var(--text-primary)' }}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Solo el número, sin el prefijo. Escriba el <em>último</em> que ya se usó, no el siguiente.
          </span>
        </label>

        {/* Vista previa — lo que de verdad se va a emitir */}
        {vistaPrevia && !retrocede && (
          <div className="rounded-xl px-4 py-3" style={{ background: '#EEF4EE', border: '1px solid #CDE9D6' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
              El próximo radicado será
            </p>
            <p className="mt-0.5 break-all font-mono text-base font-black" style={{ color: '#116932' }}>
              {vistaPrevia}
            </p>
          </div>
        )}

        {/* Aviso de retroceso — se explica ANTES de enviar, no después del rechazo */}
        {retrocede && estado && (
          <p role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
            <strong>No se puede retroceder.</strong> El consecutivo va en {estado.ultimo}: volver a {numero} repetiría
            radicados ya entregados a ciudadanos. Solo puede avanzar.
          </p>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Motivo</span>
          <input
            type="text"
            value={motivo}
            onChange={(e) => { setMotivo(e.target.value); setError(null); }}
            placeholder="Ej.: relevo del software anterior, último del libro 1779"
            className="w-full rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', color: 'var(--text-primary)' }}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Queda registrado con su nombre y la fecha. Es lo que explicará el cambio a quien audite el libro después.
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
            {error}
          </p>
        )}
        {exito && (
          <p role="status" className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: '#EEF4EE', border: '1px solid #CDE9D6', color: '#116932' }}>
            {exito}
          </p>
        )}

        <div>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={!valorValido || retrocede || motivo.trim().length < 10 || guardando}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2"
            style={{ background: '#14532D', color: '#fff' }}
          >
            {guardando ? 'Guardando…' : 'Fijar consecutivo'}
          </button>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          El consecutivo <strong>solo puede avanzar</strong>. Un hueco se explica en el acta; un número repetido
          significa dos trámites con la misma identidad legal, y no se puede deshacer.
        </p>
      </div>
    </section>
  );
}
