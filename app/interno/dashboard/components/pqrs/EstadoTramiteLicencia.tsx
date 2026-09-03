'use client';

import { useEffect, useState } from 'react';
import type { ProyeccionVentanilla } from '@/lib/server/proyeccion-ventanilla';

/* ══════════════════════════════════════════════════════════════
   VENTANILLA VE EL ESTADO DEL TRÁMITE, NO EL EXPEDIENTE (ADR-0034).

   El caso que motiva todo el módulo: el ciudadano entra por la puerta, lo
   primero que encuentra es ventanilla, pregunta ahí — y la respuesta era «suba
   a Planeación», que es justo lo que la Ventanilla Única vino a eliminar.

   CUATRO DATOS Y NINGUNO MÁS. No hay actuaciones, ni documentos, ni actas, ni
   deliberación interna. Ampliar esta pantalla exige modificar el ADR-0034:
   que un campo resulte útil no basta — la utilidad fue siempre el argumento con
   el que las proyecciones crecen hasta dejar de ser proyecciones.

   Y NINGUNA ESCRITURA. Este componente no tiene botones de acción: ventanilla
   informa, Planeación decide.
══════════════════════════════════════════════════════════════ */

interface Respuesta {
  tieneExpediente: boolean;
  proyeccion?: ProyeccionVentanilla;
  error?: string;
}

export interface EstadoTramiteLicenciaProps {
  radicadoId: string;
}

function fecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function EstadoTramiteLicencia({ radicadoId }: EstadoTramiteLicenciaProps) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/ventanilla/radicados/${encodeURIComponent(radicadoId)}/expediente`, { credentials: 'include' })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Respuesta;
        if (!vivo) return;
        if (!res.ok) setError(body.error ?? 'No fue posible consultar el estado del trámite.');
        else setDatos(body);
      })
      .catch(() => vivo && setError('Error de red al consultar el estado del trámite.'));
    return () => {
      vivo = false;
    };
  }, [radicadoId]);

  if (error) {
    return (
      <p role="alert" className="text-xs" style={{ color: 'var(--color-danger-text)' }}>
        {error}
      </p>
    );
  }
  /* La inmensa mayoría de los radicados NO son licencias: sin expediente este
     bloque no existe, en vez de ocupar sitio diciendo «no aplica». */
  if (!datos?.tieneExpediente || !datos.proyeccion) return null;

  const p = datos.proyeccion;
  const etiqueta = 'text-[10px] font-bold uppercase tracking-widest';

  return (
    <section
      aria-labelledby="estado-tramite-licencia"
      className="rounded-lg px-4 py-3 flex flex-col gap-2"
      style={{ background: 'var(--bg-surface-2)' }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 id="estado-tramite-licencia" className={etiqueta} style={{ color: '#667085' }}>
          Estado del trámite de licencia
        </h3>
        {/* Rotulado (ADR-0041): en el mostrador este número aparece junto al
            radicado que la funcionaria ya tiene en pantalla. Sin rótulo, tiene
            que adivinar cuál le está leyendo al ciudadano. */}
        {p.numeroExpediente && (
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Expediente{' '}
            <span className="font-mono">{p.numeroExpediente}</span>
          </span>
        )}
      </div>

      {/* 1 · En qué va */}
      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        {p.estadoLegible}
      </p>

      {/* 2 y 3 · Desde cuándo corre el plazo, y cuándo vence */}
      {p.avisoPlazo ? (
        /* NO UN GUION. La funcionaria tiene que poder leérselo al ciudadano tal
           cual: un guion la obliga a interpretar, y lo que interprete será suyo
           y no del sistema (ADR-0034 §4). */
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {p.avisoPlazo}
        </p>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          El plazo corre desde el <strong>{fecha(p.fechaRadicacionDebidaForma!)}</strong>
          {p.venceEl && <> y vence el <strong>{fecha(p.venceEl)}</strong></>}.
        </p>
      )}

      {/* 4 · Qué documentos faltan */}
      {p.completitudSinEvaluar ? (
        /* «Nadie lo ha revisado» NO es «no falta nada». Confundirlos haría que
           ventanilla le dijera al ciudadano que su solicitud está completa
           cuando nadie la miró. */
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Los documentos todavía no han sido revisados.
        </p>
      ) : p.faltantes.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No falta ningún documento.
        </p>
      ) : (
        <div>
          <p className={etiqueta + ' mb-1'} style={{ color: '#667085' }}>
            Documentos que faltan ({p.faltantes.length})
          </p>
          <ul className="list-disc pl-5 text-sm flex flex-col gap-0.5" style={{ color: 'var(--text-secondary)' }}>
            {p.faltantes.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px]" style={{ color: '#94A3B8' }}>
        Para el detalle del expediente —documentos aportados, actuaciones y
        observaciones— el ciudadano debe dirigirse a la Secretaría de Planeación.
      </p>
    </section>
  );
}
