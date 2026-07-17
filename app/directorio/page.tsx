import Image from 'next/image';
import Link from 'next/link';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import { INSTITUCION } from '@/lib/institucion';
import type { TenantId } from '@/src/types/radicado';

/**
 * Color crema institucional para texto sobre la banda verde de cabecera
 * (mismo valor que usa el correo de alerta de vencimiento, `lib/email/
 * templates/alerta-vencimiento.ts`, para la sobrelínea del membrete).
 * No existe todavía como token en `globals.css`; se declara aquí en vez
 * de introducir una variable global para un único uso de página.
 */
const CREMA_INSTITUCIONAL = '#FDF6E3';

function formatCelular(value: string): string {
  return value.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
}

export default function DirectorioPage() {
  const dependencias = (Object.keys(DIRECTORIO_TENANTS) as TenantId[])
    .map((id) => DIRECTORIO_TENANTS[id])
    .filter((dep) => dep.activo);

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-inst-bg)' }}>
      {/* ── Cabecera — banda verde institucional (identidad, no el tema oscuro del portal) ── */}
      <header style={{ background: 'var(--color-inst-green)' }}>
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-10 w-36 shrink-0 sm:h-12 sm:w-44">
              <Image
                src={INSTITUCION.logo}
                alt={INSTITUCION.nombre}
                fill
                priority
                sizes="176px"
                className="object-contain object-left"
              />
            </div>
            <div className="min-w-0">
              <p
                className="truncate text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{ color: CREMA_INSTITUCIONAL }}
              >
                Alcaldía Municipal de Simacota
              </p>
              <p
                className="truncate text-base font-black tracking-tight text-white sm:text-lg"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Directorio de Dependencias
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="ml-auto shrink-0 rounded text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{ color: CREMA_INSTITUCIONAL }}
          >
            Inicio
          </Link>
        </div>
      </header>

      {/* ── Cuerpo — fondo claro institucional ── */}
      <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="mb-8">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.24em]"
            style={{ color: 'var(--color-inst-gold)' }}
          >
            {INSTITUCION.contexto}
          </p>
          <h1
            className="mt-2 text-3xl font-black tracking-tight sm:text-[34px]"
            style={{ fontFamily: 'var(--font-manrope)', color: 'var(--brand-forest)' }}
          >
            Directorio de Dependencias
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Canales oficiales de contacto de la {INSTITUCION.nombre}. Use esta información para orientar solicitudes, consultas y seguimiento institucional.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dependencias.map((dep) => {
            const esVentanilla = dep.tenantId === 'VENTANILLA_UNICA';
            return (
              <article
                key={dep.tenantId}
                className="card-institucional is-hoverable relative overflow-hidden p-5"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{ background: esVentanilla ? 'var(--color-inst-gold)' : 'var(--color-inst-green)' }}
                />
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-inst-green)' }} />
                  Dependencia oficial
                </p>
                <h2
                  className="mt-2 text-lg font-black leading-tight"
                  style={{ fontFamily: 'var(--font-manrope)', color: 'var(--brand-forest)' }}
                >
                  {dep.nombreOficial}
                </h2>
                {dep.zonaExclusiva && (
                  <span className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                    Zona exclusiva
                  </span>
                )}
                <dl className="mt-5 space-y-3">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Correo</dt>
                    <dd>
                      <a
                        href={`mailto:${dep.emailOficial}`}
                        className="text-sm underline underline-offset-2 transition-colors hover:text-[var(--color-inst-green-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
                        style={{ color: 'var(--color-inst-green)' }}
                      >
                        {dep.emailOficial}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Teléfono</dt>
                    <dd>
                      <a
                        href={`tel:${dep.celularOficial}`}
                        className="text-sm text-slate-700 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
                      >
                        {formatCelular(dep.celularOficial)}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Responsable</dt>
                    <dd className="text-sm text-slate-600">{dep.responsable || 'Por asignar'}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
