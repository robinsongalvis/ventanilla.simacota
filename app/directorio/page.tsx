import Link from 'next/link';
import { InstitucionalHeader } from '@/app/components/institucional/InstitucionalHeader';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import { INSTITUCION } from '@/lib/institucion';
import type { TenantId } from '@/src/types/radicado';

function formatCelular(value: string): string {
  return value.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
}

export default function DirectorioPage() {
  const dependencias = (Object.keys(DIRECTORIO_TENANTS) as TenantId[])
    .map((id) => DIRECTORIO_TENANTS[id])
    .filter((dep) => dep.activo);

  return (
    <main className="min-h-screen bg-obsidian-gradient text-slate-100">
      <header className="border-b border-white/[0.06] bg-[#0A0A0B]/75 backdrop-blur-[20px]">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-4">
          <InstitucionalHeader compact subtitle="Directorio de Dependencias" />
          <Link href="/" className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-300">
            Inicio
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">
            {INSTITUCION.contexto}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-50 sm:text-4xl" style={{ fontFamily: 'var(--font-manrope)' }}>
            Directorio de Dependencias
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
            Canales oficiales de contacto de la {INSTITUCION.nombre}. Use esta información para orientar solicitudes, consultas y seguimiento institucional.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dependencias.map((dep) => (
            <article key={dep.tenantId} className="rounded-2xl border border-white/[0.08] bg-slate-950/50 p-5 shadow-xl shadow-black/20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                Dependencia oficial
              </p>
              <h2 className="mt-2 text-lg font-black leading-tight text-slate-100" style={{ fontFamily: 'var(--font-manrope)' }}>
                {dep.nombreOficial}
              </h2>
              {dep.zonaExclusiva && (
                <span className="mt-3 inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                  Zona exclusiva
                </span>
              )}
              <dl className="mt-5 space-y-3">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Correo</dt>
                  <dd>
                    <a href={`mailto:${dep.emailOficial}`} className="text-sm text-indigo-300 transition-colors hover:text-indigo-200">
                      {dep.emailOficial}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Teléfono</dt>
                  <dd>
                    <a href={`tel:${dep.celularOficial}`} className="text-sm text-slate-300 transition-colors hover:text-slate-100">
                      {formatCelular(dep.celularOficial)}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Responsable</dt>
                  <dd className="text-sm text-slate-400">{dep.responsable || 'Por asignar'}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
