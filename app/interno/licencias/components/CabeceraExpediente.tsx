'use client';

import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { ChipEstadoJuridico } from './ChipEstadoJuridico';
import { describirTramiteDesdeSubtipos } from '@/lib/motor-expedientes/describir-tramite';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import { rotuloDeSerie } from '@/lib/motor-expedientes/numeros-del-expediente';

/* ══════════════════════════════════════════════════════════════
   CABECERA DEL EXPEDIENTE.

   EL PLAZO SIEMPRE VISIBLE, arriba a la derecha. Y cuando no corre, la frase
   EXACTA del ADR-0034 —«Aún no ha empezado a correr»—, no un guion: un guion
   obliga a la funcionaria a interpretar, y lo que interprete será suyo y no del
   sistema.

   La figura y la modalidad salen de `describirTramiteDesdeSubtipos`, la misma
   fuente que los papeles del ciudadano: dos redacciones del mismo hecho
   acabarían divergiendo.
══════════════════════════════════════════════════════════════ */

export interface CabeceraExpedienteProps {
  expediente: ExpedienteLicenciaDoc;
  /** ISO desde el que corre el plazo, o `null` si todavía no corre. */
  desdeCuandoCorreElPlazo: string | null;
}

export function CabeceraExpediente({ expediente, desdeCuandoCorreElPlazo }: CabeceraExpedienteProps) {
  const tramite = describirTramiteDesdeSubtipos(
    expediente.subtipos,
    expediente.modalidadesConstruccion,
  );

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-headline text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
          {expediente.solicitanteNombre}
          {expediente.solicitanteDocumento && (
            <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>
              {' — CC '}{expediente.solicitanteDocumento}
            </span>
          )}
        </h1>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          {expediente.numeroExpediente?.numero && (
            <span style={{ color: 'var(--text-secondary)' }}>
              {/* El rótulo sale de la SERIE, no está cableado (ADR-0041): un
                  expediente viejo cuyo número es un 1-110 dirá «Radicado» para
                  siempre, y uno nuevo con su 68745 dirá «Expediente», en la
                  misma pantalla y sin reescribir un solo dato. Hoy, con todo
                  en la serie `radicados`, dice exactamente lo de antes. */}
              {rotuloDeSerie(expediente.numeroExpediente.serieId)}{' '}
              <strong className="font-mono" style={{ color: 'var(--text-primary)' }}>
                {expediente.numeroExpediente.numero}
              </strong>
            </span>
          )}
          {/* `first-letter:uppercase`, NO `capitalize` (3-sep-2026, cazado por
              el propietario en el ensayo). `capitalize` mayusculiza CADA
              palabra y la cabecera decía «Licencia De Urbanización» — en
              español el «de» no lleva mayúscula, y el nombre de una figura
              jurídica no es un título que se maquille. En un trámite
              combinado era peor: «… Licencia De Construcción Y Aprobación
              De Planos».

              Quitarla del todo tampoco servía: `describirTramiteDesdeSubtipos`
              devuelve el nombre en MINÚSCULA a propósito, porque su uso
              principal es dentro de frases («recibió su solicitud de licencia
              de urbanización y…»). Aquí es una etiqueta suelta y necesita
              arrancar en mayúscula — pero solo la primera letra. */}
          <span className="first-letter:uppercase" style={{ color: 'var(--text-secondary)' }}>{tramite}</span>
          <ChipEstadoJuridico estado={expediente.estadoJuridico} />
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
          Plazo legal
        </p>
        {desdeCuandoCorreElPlazo ? (
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Corre desde el {formatFechaColombia(desdeCuandoCorreElPlazo)}
          </p>
        ) : (
          /* La frase EXACTA del ADR-0034. No es decorativa: la funcionaria
             tiene que poder leérsela al ciudadano tal cual. */
          <p className="text-sm font-bold" style={{ color: '#9A6206' }}>
            Aún no ha empezado a correr
          </p>
        )}
      </div>
    </header>
  );
}
