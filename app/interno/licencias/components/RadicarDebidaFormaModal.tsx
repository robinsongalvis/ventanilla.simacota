'use client';

import { useState } from 'react';
import { formatFechaColombia } from '@/lib/fecha-colombia';

/* ══════════════════════════════════════════════════════════════
   EL ACTO DE RADICAR, DESDE LA PANTALLA.

   El acto existía desde #248 —transaccional, idempotente, probado contra el
   emulador— y NO TENÍA UN SOLO LLAMADOR EN LA INTERFAZ. Estaba construido y era
   inalcanzable desde el mostrador. Esto es ese llamador.

   LO QUE ESTA PANTALLA NO HACE, Y ES DELIBERADO:

   · NO calcula el ancla. La fecha desde la que corre el plazo la decide el
     servidor y viaja en la vista previa; aquí solo se muestra. Un campo de
     fecha libre sería la puerta trasera exacta al «clic de verificación» que
     el ADR-0033 §4.3 prohíbe.
   · NO inventa el número. El operario TRANSCRIBE el que sale del libro de
     ventanilla; el servidor lo valida y lo normaliza. Si al normalizar cambió
     el texto, la pantalla se lo enseña — escribió una cosa y quedó grabada
     otra, aunque sean la misma.
   · NO traduce los errores del servidor. Se muestran tal cual llegan: el
     servidor sabe por qué rechazó, y reescribirlo aquí es la forma más común
     de convertir un motivo preciso en un «algo salió mal».

   EL ANCLA VIAJA DE VUELTA (`anclaEsperada`). Si entre que la funcionaria mira
   y pulsa alguien tocó la evidencia, el acto se rechaza en vez de afirmar una
   fecha que ella no vio.
══════════════════════════════════════════════════════════════ */

/** La vista previa tal como la devuelve `GET /api/licencias/expedientes/[id]`. */
export interface VistaPreviaDebidaForma {
  procede: boolean;
  yaRadicada: boolean;
  motivo?: string;
  numeroExpediente?: string | null;
  desdeCuandoCorreElPlazo?: string;
  anclaPropuesta?: string;
  anclaIso?: string;
  baseDelAncla?: 'MOMENTO_REGISTRADO_DE_COMPLETITUD' | 'PRIMERA_VERSION_DEL_ULTIMO_DOCUMENTO';
  requisitosAplicables?: number;
  /** `1-110-AAAAMM-` con el año y el mes DEL SERVIDOR — sugerencia de formato, no el número. */
  prefijoRadicadoSugerido?: string;
  venceraEl?: string;
  naceVencido?: boolean;
}

export interface RadicarDebidaFormaModalProps {
  expedienteId: string;
  previa: VistaPreviaDebidaForma;
  onCerrar: () => void;
  /** Se invoca tras un acto exitoso para que el detalle se recargue. */
  onRadicado: () => void;
}

interface Exito {
  numeroExpediente: string;
  desdeCuandoCorreElPlazo?: string;
  transcrito?: string;
  seNormalizo?: boolean;
  yaEstaba?: boolean;
  mensaje?: string;
}

/** De dónde sale la fecha, dicho en palabras que la funcionaria pueda repetir. */
const EXPLICACION_BASE: Record<NonNullable<VistaPreviaDebidaForma['baseDelAncla']>, string> = {
  MOMENTO_REGISTRADO_DE_COMPLETITUD:
    'Es el instante que el sistema registró cuando la solicitud quedó completa.',
  PRIMERA_VERSION_DEL_ULTIMO_DOCUMENTO:
    'El expediente no tenía registrado ese instante, así que se deduce de la fecha del último documento aportado.',
};

export function RadicarDebidaFormaModal({
  expedienteId,
  previa,
  onCerrar,
  onRadicado,
}: RadicarDebidaFormaModalProps) {
  /* EL RADICADO YA ESCRITO HASTA EL GUION FINAL — solo faltan los dígitos.

     Decisión del propietario (29-ago-2026), con su motivo: si la funcionaria
     no se sabe el formato de memoria, averiguarlo le cuesta más que escribir el
     número entero, y el ahorro se vuelve estorbo.

     EL AÑO Y EL MES VIENEN DEL SERVIDOR (`prefijoRadicadoSugerido`), NO del
     reloj del navegador. Un equipo con la fecha corrida propondría un mes que
     no existe en el libro. Y así esta ventana sigue sin calcular fechas por su
     cuenta, que es lo que vigila `acto-radicar-alcanzable.test.ts`.

     SIGUE SIENDO UNA SUGERENCIA DE FORMATO, NO EL NÚMERO: el consecutivo —el
     dato— lo escribe ella, y el mes queda editable porque el radicado puede ser
     de un mes anterior. La ayuda debajo lo dice con esas palabras. */
  const PREFIJO_SERIE = previa.prefijoRadicadoSugerido ?? '1-110-';
  const [numero, setNumero] = useState(PREFIJO_SERIE);
  const [observacion, setObservacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<Exito | null>(null);

  async function radicar() {
    setError(null);
    /* NO BASTA CON «NO ESTÁ VACÍO»: desde que el campo nace con el prefijo
       puesto, `1-110-` a secas pasaría por número escrito. Se exige que haya
       algo DESPUÉS del prefijo — el consecutivo, que es el dato real y el único
       que el sistema no pone. */
    if (numero.trim().replace(PREFIJO_SERIE, '').trim().length === 0) {
      setError('Escriba el número de radicado tal como aparece en el libro de ventanilla.');
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(
        `/api/licencias/expedientes/${encodeURIComponent(expedienteId)}/radicar`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            confirmo: true,
            /* El día civil que ELLA vio. Control optimista legible por un
               auditor: si la evidencia cambió, el servidor rechaza. */
            anclaEsperada: previa.anclaPropuesta,
            numeroRadicado: numero.trim(),
            observacion: observacion.trim() || undefined,
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Tal cual llega. El servidor sabe por qué rechazó.
        setError(body.error ?? 'No fue posible radicar el expediente.');
        return;
      }
      setExito({
        numeroExpediente: body.numeroExpediente,
        desdeCuandoCorreElPlazo: body.desdeCuandoCorreElPlazo,
        transcrito: body.transcrito,
        seNormalizo: body.seNormalizo,
        yaEstaba: body.yaEstaba,
        mensaje: body.mensaje,
      });
      onRadicado();
    } catch {
      setError('Error de red al radicar. Vuelva a intentarlo; el acto no se ejecuta dos veces.');
    } finally {
      setEnviando(false);
    }
  }

  const etiqueta = 'mb-1 block text-[10px] font-bold uppercase tracking-widest';

  return (
    /* EL FONDO NO SE APAGA. Estaba al 55 % de tinta oscura, que deja el
       expediente detrás legible a medias y parece desenfoque. Baja al 22 %: se
       sigue viendo QUÉ expediente se está radicando —el nombre, los documentos,
       el camino— mientras se confirma el acto. Es un acto sobre algo concreto,
       no un formulario suelto, y ver ese algo mientras se firma importa. */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,.22)' }}>
      {/* Con el fondo claro, la ventana necesita elevación PROPIA para no
          confundirse con lo de atrás: sombra marcada y un filo verde. */}
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-radicar"
           className="w-full max-w-lg rounded-2xl overflow-hidden"
           style={{
             background: 'var(--bg-surface)',
             boxShadow: '0 24px 60px rgba(15,23,42,.34), 0 4px 12px rgba(15,23,42,.18)',
             border: '1px solid rgba(20,83,45,.22)',
           }}>
        <div className="px-5 py-4" style={{ background: '#14532D' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#FDF6E3' }}>
            Secretaría de Planeación
          </p>
          <h2 id="titulo-radicar" className="text-lg font-extrabold" style={{ color: '#fff' }}>
            Radicar en legal y debida forma
          </h2>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {exito ? (
            <div role="status" className="flex flex-col gap-2">
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {exito.yaEstaba
                  ? exito.mensaje
                  : 'El expediente quedó radicado en legal y debida forma.'}
              </p>
              <p className="font-mono text-lg font-extrabold" style={{ color: '#14532D' }}>
                {exito.numeroExpediente}
              </p>
              {exito.seNormalizo && exito.transcrito && (
                /* Escribió una cosa y quedó grabada otra —la misma, con el
                   formato canónico—. Callarlo la dejaría creyendo que en el
                   expediente está exactamente lo que tecleó. */
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Usted escribió <strong>{exito.transcrito}</strong> y se guardó en el formato
                  oficial completo. Es el mismo número.
                </p>
              )}
              {exito.desdeCuandoCorreElPlazo && (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  El plazo corre desde el {formatFechaColombia(exito.desdeCuandoCorreElPlazo)}.
                </p>
              )}
            </div>
          ) : previa.yaRadicada ? (
            <div role="status" className="flex flex-col gap-1">
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{previa.motivo}</p>
              {previa.numeroExpediente && (
                <p className="font-mono text-base font-extrabold" style={{ color: '#14532D' }}>
                  {previa.numeroExpediente}
                </p>
              )}
            </div>
          ) : !previa.procede ? (
            /* NO PROCEDE: se dice el motivo del servidor, entero. Hoy el motivo
               más frecuente es que el expediente es de demostración — el
               candado que protege la serie legal. */
            <p role="alert" className="text-sm" style={{ color: 'var(--color-danger-text)' }}>
              {previa.motivo ?? 'La radicación no procede todavía.'}
            </p>
          ) : (
            <>
              <div className="rounded-lg px-3 py-2 flex flex-col gap-1" style={{ background: 'var(--bg-surface-2)' }}>
                <p className={etiqueta} style={{ color: '#3F6B4E' }}>El plazo empezará a correr el</p>
                {/* ES EL DATO DEL ACTO, no una línea más: desde esta fecha
                    corren los 45 días hábiles. Se lee de lejos. */}
                <p className="font-headline text-3xl font-black leading-tight" style={{ color: '#14532D' }}>
                  {previa.anclaPropuesta ? formatFechaColombia(previa.anclaPropuesta) : '—'}
                </p>
                {previa.baseDelAncla && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {EXPLICACION_BASE[previa.baseDelAncla]}
                  </p>
                )}
                {typeof previa.requisitosAplicables === 'number' && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {previa.requisitosAplicables} requisitos verificados.
                  </p>
                )}
                {previa.venceraEl && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Vencerá el {formatFechaColombia(previa.venceraEl)}.
                  </p>
                )}
              </div>

              {previa.naceVencido && (
                /* EL CASO DURO, DICHO ANTES Y NO DESPUÉS. El acto procede —es un
                   hecho verdadero— pero nadie debería enterarse al pulsar. */
                <p role="alert" className="rounded-lg px-3 py-2 text-sm"
                   style={{ background: 'var(--color-warning)', color: '#4A2E02' }}>
                  <strong>Atención:</strong> el término ya está vencido en el momento de radicar,
                  porque el último documento se aportó hace más de 45 días hábiles. La radicación
                  procede igual —es lo que realmente ocurrió—, pero el expediente nacerá vencido.
                </p>
              )}

              <div>
                <label htmlFor="numero-radicado" className={etiqueta} style={{ color: '#667085' }}>
                  Número de radicado del libro de ventanilla
                </label>
                <input
                  id="numero-radicado"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                  onKeyDown={(e) => {
                    /* TAB DEVUELVE EL PREFIJO, y solo si el campo quedó vacío.
                       Con el campo relleno —el caso normal— Tab hace lo de
                       siempre y pasa al campo siguiente: secuestrar el tabulador
                       dejaría atrapado a quien navegue con teclado. */
                    if (e.key === 'Tab' && !e.shiftKey && numero.trim().length === 0) {
                      e.preventDefault();
                      setNumero(PREFIJO_SERIE);
                      requestAnimationFrame(() => {
                        const el = e.target as HTMLInputElement;
                        el.setSelectionRange(PREFIJO_SERIE.length, PREFIJO_SERIE.length);
                      });
                    }
                  }}
                  placeholder="1-110-202608-00000123"
                  autoComplete="off"
                  inputMode="numeric"
                  className="w-full rounded-lg px-3.5 py-3 text-base font-mono tracking-wide"
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '2px solid #14532D' }}
                />
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Escriba solo los <strong>ocho dígitos finales</strong>. El año y el mes vienen puestos
                  con la fecha de hoy — <strong>si el radicado es de otro mes, corríjalos</strong>: el sistema
                  sugiere el formato, no el número.
                </p>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                  Escríbalo tal como aparece en el libro. El sistema lo completa al formato oficial
                  si hace falta; no lo inventa ni lo corrige.
                </p>
              </div>

              <div>
                <label htmlFor="observacion-radicar" className={etiqueta} style={{ color: '#667085' }}>
                  Observación (opcional)
                </label>
                <input
                  id="observacion-radicar"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--bg-surface-2)', color: 'var(--text-primary)', border: '1px solid #D9E2D9' }}
                />
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm" style={{ color: 'var(--color-danger-text)' }}>{error}</p>
          )}
        </div>

        <div className="px-5 py-3 flex justify-end gap-2" style={{ background: 'var(--bg-surface-2)' }}>
          <button type="button" onClick={onCerrar} className="text-sm font-semibold px-3 py-2 rounded-lg"
                  style={{ color: 'var(--text-secondary)' }}>
            {exito ? 'Cerrar' : 'Cancelar'}
          </button>
          {!exito && previa.procede && !previa.yaRadicada && (
            <button type="button" onClick={radicar} disabled={enviando}
                    className="text-sm font-bold px-4 py-2 rounded-lg"
                    style={{ background: '#14532D', color: '#fff', opacity: enviando ? 0.6 : 1 }}>
              {enviando ? 'Radicando…' : 'Radicar en debida forma'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
