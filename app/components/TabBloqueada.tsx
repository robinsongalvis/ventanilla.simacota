'use client';

interface TabBloqueadaProps {
  onTomarControl: () => void;
  onRevisarYContinuar: () => Promise<boolean>;
  segundosDesdeHeartbeat: number | null;
}

export function TabBloqueada({
  onTomarControl,
  onRevisarYContinuar,
  segundosDesdeHeartbeat,
}: TabBloqueadaProps) {
  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Icono y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>

          <h1 className="font-headline text-xl text-slate-50 mb-2">
            Panel abierto en otra pestaña
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
            Para evitar doble operación sobre los mismos radicados, solo una pestaña
            puede controlar el panel interno a la vez.
          </p>
        </div>

        {/* Tarjeta de acciones */}
        <div className="glass-card p-6 flex flex-col gap-3">

          {/* Indicador de sesión activa */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 mb-1">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs text-emerald-400 font-medium">
              {segundosDesdeHeartbeat === null
                ? 'Verificando pestaña activa'
                : segundosDesdeHeartbeat < 8
                  ? 'La otra pestaña parece activa'
                  : 'La otra pestaña no responde hace unos segundos'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void onRevisarYContinuar()}
            className="btn-primary w-full min-h-12 touch-manipulation"
          >
            Revisar y continuar aquí
          </button>

          <button
            type="button"
            onClick={onTomarControl}
            className="w-full min-h-11 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm font-semibold
                       hover:bg-amber-500/15 transition-colors touch-manipulation"
          >
            Tomar control de todos modos
          </button>

          {/* Acción secundaria: cerrar esta pestaña */}
          <button
            type="button"
            onClick={() => window.close()}
            className="w-full min-h-11 rounded-xl border border-slate-700 bg-transparent text-slate-400 text-sm font-medium
                       hover:border-slate-600 hover:text-slate-300 transition-colors touch-manipulation"
          >
            Cerrar esta pestaña
          </button>
        </div>

        {/* Nota informativa */}
        <p className="text-center text-xs text-slate-600 mt-5 leading-relaxed">
          Esto no crea otra sesión ni duplica el inicio de sesión.
          <br />Solo mueve el control del panel a una pestaña del mismo navegador.
        </p>

      </div>
    </div>
  );
}
