'use client';

import { useEffect, useState } from 'react';
import type { ProyeccionVentanilla } from '@/lib/server/proyeccion-ventanilla';
import { leerElTermino } from '@/lib/motor-expedientes/lectura-del-termino';
import { formatFechaColombia } from '@/lib/fecha-colombia';

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

   ── EL RELOJ SE LEE IGUAL EN LAS DOS PANTALLAS (9-sep-2026) ──────────────

   Hasta hoy este bloque decía «corre desde el X y vence el Y» y nada más,
   mientras la tarjeta de Planeación mostraba «39 días hábiles · día 6 de 45».
   Dos lecturas del mismo reloj, y solo una con el número que el ciudadano
   pregunta de verdad. Peor: para un expediente CON ACTA DE OBSERVACIONES,
   Planeación decía «reloj detenido» y el mostrador seguía anunciando un
   vencimiento que la norma había suspendido.

   Ahora las dos llaman a `leerElTermino`. El número y la situación salen de una
   sola aritmética: si divergieran, dos funcionarias darían dos plazos distintos
   del mismo expediente y el ciudadano se llevaría el que le tocara en suerte.

   NO SE COPIAN LAS PALABRAS DE PLANEACIÓN, y es deliberado. Allá el mensaje le
   dice al técnico qué hacer («o sale la resolución, o sale el acta»): eso es
   deliberación interna y no es del mostrador. Aquí se dicen HECHOS —cuántos
   días, hasta cuándo, si el reloj está parado—, que es lo que la funcionaria
   puede leerle al ciudadano. Lo que no puede divergir es el número.
══════════════════════════════════════════════════════════════ */

interface Respuesta {
  tieneExpediente: boolean;
  proyeccion?: ProyeccionVentanilla;
  error?: string;
}

export interface EstadoTramiteLicenciaProps {
  radicadoId: string;
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
      className="rounded-xl bg-white p-4 flex flex-col gap-3"
      style={{ border: '1px solid #D9E2D9' }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="estado-tramite-licencia" className={etiqueta} style={{ color: '#14532D' }}>
          Estado del trámite de licencia
        </h3>
        {/* Rotulado (ADR-0041): en el mostrador este número aparece junto al
            radicado que la funcionaria ya tiene en pantalla. Sin rótulo, tiene
            que adivinar cuál le está leyendo al ciudadano. */}
        {p.numeroExpediente && (
          <span className="text-xs" style={{ color: '#667085' }}>
            Expediente <span className="font-mono">{p.numeroExpediente}</span>
          </span>
        )}
      </div>

      {/* 1 · En qué va */}
      <p className="text-sm font-bold" style={{ color: '#1F2933' }}>
        {p.estadoLegible}
      </p>

      {/* 2 y 3 · El reloj: la MISMA lectura que ve Planeación */}
      <LecturaDelReloj proyeccion={p} />

      {/* 4 · Qué documentos faltan */}
      {p.completitudSinEvaluar ? (
        /* «Nadie lo ha revisado» NO es «no falta nada». Confundirlos haría que
           ventanilla le dijera al ciudadano que su solicitud está completa
           cuando nadie la miró. */
        <p className="text-sm" style={{ color: '#667085' }}>
          Los documentos todavía no han sido revisados.
        </p>
      ) : p.faltantes.length === 0 ? (
        <p className="text-sm" style={{ color: '#667085' }}>
          No falta ningún documento.
        </p>
      ) : (
        <div>
          <p className={etiqueta + ' mb-1'} style={{ color: '#94A3B8' }}>
            Documentos que faltan ({p.faltantes.length})
          </p>
          <ul className="list-disc pl-5 text-sm flex flex-col gap-0.5" style={{ color: '#667085' }}>
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

/* ── EL RELOJ ─────────────────────────────────────────────────────────────
   Cada situación dice lo suyo. Ninguna se calla y ninguna inventa: un guion
   obliga a la funcionaria a interpretar, y lo que interprete será suyo y no del
   sistema (ADR-0034 §4). */
function LecturaDelReloj({ proyeccion }: { proyeccion: ProyeccionVentanilla }) {
  const lectura = leerElTermino({
    expedienteId: 'mostrador',
    estadoJuridico: proyeccion.estadoJuridico,
    venceIso: proyeccion.venceEl,
    desdeIso: proyeccion.fechaRadicacionDebidaForma,
  });

  if (lectura.situacion === 'SIN_ANCLAR') {
    /* La frase la escribe el servidor, con las palabras exactas del ADR-0034 §4:
       la funcionaria tiene que poder leérsela al ciudadano tal cual. */
    return (
      <p className="text-sm" style={{ color: '#667085' }}>
        {proyeccion.avisoPlazo ?? 'El plazo aún no ha empezado a correr.'}
      </p>
    );
  }

  if (lectura.situacion === 'RESUELTO') {
    return (
      <p className="text-sm" style={{ color: '#667085' }}>
        La Secretaría ya decidió sobre esta solicitud: el término dejó de correr.
      </p>
    );
  }

  if (lectura.situacion === 'SUSPENDIDO') {
    /* El caso que más divergía: Planeación mostraba «reloj detenido» y el
       mostrador seguía anunciando un vencimiento que la norma suspendió. El
       fundamento va literal para que la funcionaria pueda citarlo — es la
       NORMA, no el contenido del acta, que sigue fuera de esta pantalla. */
    return (
      <div className="rounded-lg px-3 py-2 flex flex-col gap-1" style={{ background: '#F1F5F9' }}>
        <p className="text-sm font-bold" style={{ color: '#334155' }}>
          Reloj detenido — el término no está corriendo.
        </p>
        <p className="text-sm" style={{ color: '#475569' }}>
          El turno es del ciudadano. Nada corre contra la Secretaría mientras tanto.
        </p>
        {lectura.fundamento && (
          <p className="text-[11px]" style={{ color: '#64748B' }}>{lectura.fundamento}</p>
        )}
      </div>
    );
  }

  const { diasHabilesRestantes: restantes, diaTranscurrido, totalDias, vencido } = lectura;

  if (vencido) {
    const dias = Math.abs(restantes);
    return (
      <div className="rounded-lg px-3 py-2 flex flex-col gap-0.5" style={{ background: '#FEF2F2' }}>
        <p className="text-sm font-bold" style={{ color: '#B42318' }}>
          El término venció hace {dias} día{dias === 1 ? '' : 's'} hábil{dias === 1 ? '' : 'es'}.
        </p>
        {/* NI UNA PALABRA SOBRE SILENCIO ADMINISTRATIVO. Planeación sí lo lee
            —es su riesgo y su decisión—; desde el mostrador sería una
            conclusión jurídica dicha por quien no la toma (ADR-0034 §3). */}
        <p className="text-sm" style={{ color: '#667085' }}>
          Venció el <strong>{formatFechaColombia(lectura.venceIso)}</strong>. Para saber en qué
          estado va la decisión, el ciudadano debe dirigirse a la Secretaría de Planeación.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* EL NÚMERO QUE EL CIUDADANO PREGUNTA, en grande y primero. */}
      <p className="text-sm font-bold" style={{ color: '#14532D' }}>
        Quedan {restantes} día{restantes === 1 ? '' : 's'} hábil{restantes === 1 ? '' : 'es'}
        <span style={{ color: '#667085', fontWeight: 400 }}> · día {diaTranscurrido} de {totalDias}</span>
      </p>
      <p className="text-sm" style={{ color: '#667085' }}>
        Vence el <strong>{formatFechaColombia(lectura.venceIso)}</strong>
        {lectura.desdeIso && <> · corre desde el <strong>{formatFechaColombia(lectura.desdeIso)}</strong></>}.
      </p>
    </div>
  );
}
