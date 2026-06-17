import Link from 'next/link';
import { InstitucionalHeader } from '@/app/components/institucional/InstitucionalHeader';
import { INSTITUCION } from '@/lib/institucion';

const STATS = [
  { value: '16', label: 'Dependencias conectadas' },
  { value: '24/7', label: 'Disponibilidad digital' },
  { value: '100%', label: 'Trazabilidad de casos' },
];

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Radicación Inmediata',
    desc: 'Tu solicitud recibe un número de radicado único al instante, con confirmación digital.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: 'Clasificación con IA',
    desc: 'Inteligencia artificial dirige tu caso a la dependencia exacta, incluyendo zonas rurales Yariguíes.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
    title: 'Respuesta por WhatsApp',
    desc: 'Recibe actualizaciones y la resolución de tu caso directamente en tu celular.',
  },
];

export default function HomePage() {
  return (
    <div className="bg-institucional-light min-h-screen flex flex-col" style={{ color: '#1F2933' }}>

      {/* ── Navbar ── */}
      <header className="border-b border-[var(--color-border)] sticky top-0 z-50 backdrop-blur-[20px] bg-white/85" role="banner">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <InstitucionalHeader compact theme="light" />
          {/* Navegación principal */}
          <nav aria-label="Navegación principal" className="flex items-center gap-4">
            <Link
              href="/directorio"
              className="font-label text-slate-600 hover:text-emerald-700 transition-colors text-[11px]"
            >
              Directorio
            </Link>
            <Link
              href="/consulta"
              className="font-label text-slate-600 hover:text-emerald-700 transition-colors text-[11px]"
              aria-label="Consultar estado de un radicado por su número"
            >
              Consultar radicado
            </Link>
            <Link
              href="/interno/dashboard"
              className="font-label text-slate-700 hover:text-emerald-800 transition-colors text-[11px]"
              aria-label="Acceso al panel interno para funcionarios de la Alcaldía"
            >
              Acceso funcionarios →
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center" aria-label="Contenido principal">

        {/* Badge — estado del sistema en tiempo real */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-600/25 bg-emerald-50 mb-8 animate-fade-in-up"
          aria-live="polite"
          aria-label="Estado del sistema: activo"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse-glow" aria-hidden="true" />
          <span className="font-label text-emerald-800 text-[11px]">{INSTITUCION.contexto} — Sistema activo</span>
        </div>

        {/* Headline — degradado institucional verde→dorado en "Digital" */}
        <h1
          className="font-headline text-5xl md:text-7xl max-w-4xl mb-6 animate-fade-in-up"
          style={{ animationDelay: '0.1s', opacity: 0, color: '#1F2933' }}
        >
          Ventanilla Única{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-500">
            Digital
          </span>
        </h1>

        {/* Subtítulo */}
        <p
          className="text-slate-600 text-lg md:text-xl max-w-2xl leading-relaxed mb-12 animate-fade-in-up"
          style={{ animationDelay: '0.2s', opacity: 0 }}
        >
          Radica tu solicitud desde cualquier lugar. La inteligencia artificial la clasifica
          y la envía a la dependencia correcta en segundos.{' '}
          <span className="text-slate-800 font-medium">Trazabilidad total, cuentas claras.</span>
        </p>

        {/* CTAs */}
        <div
          className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center animate-fade-in-up w-full sm:w-auto"
          style={{ animationDelay: '0.3s', opacity: 0 }}
        >
          <Link
            href="/radicacion"
            className="btn-primary text-base px-8 py-4 rounded-xl w-full sm:w-auto justify-center"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Radicar mi Solicitud
          </Link>
          <Link
            href="/consulta"
            className="inline-flex items-center justify-center gap-2 text-base px-8 py-4 rounded-xl border border-emerald-700/30 bg-white text-emerald-800 hover:bg-emerald-50 hover:border-emerald-700/50 transition-colors w-full sm:w-auto shadow-sm"
            aria-label="Consultar el estado de un radicado"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Consultar radicado
          </Link>
          <a
            href="#como-funciona"
            className="text-slate-600 hover:text-emerald-800 transition-colors font-medium text-base px-6 py-4 text-center"
          >
            ¿Cómo funciona?
          </a>
        </div>

        {/* Stats — datos clave de la plataforma */}
        <dl
          className="grid grid-cols-3 gap-3 sm:gap-4 mt-16 sm:mt-20 animate-fade-in-up max-w-3xl w-full"
          style={{ animationDelay: '0.4s', opacity: 0 }}
          aria-label="Estadísticas de la plataforma"
        >
          {STATS.map((s) => (
            <div
              key={s.label}
              className="card-institucional text-center px-3 py-5 sm:px-5 sm:py-6"
            >
              <dd className="font-headline text-2xl sm:text-3xl text-emerald-800 mb-1">{s.value}</dd>
              <dt className="font-label text-slate-500 text-[10px] leading-snug">{s.label}</dt>
            </div>
          ))}
        </dl>
      </main>

      {/* ── Cómo funciona ── */}
      <section
        id="como-funciona"
        className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 w-full"
        aria-labelledby="como-funciona-titulo"
      >
        <div className="text-center mb-12">
          <p className="font-label text-emerald-700 mb-3" aria-hidden="true">Proceso</p>
          <h2 id="como-funciona-titulo" className="font-headline text-3xl md:text-4xl" style={{ color: '#1F2933' }}>Cómo funciona</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6" role="list" aria-label="Características del sistema">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="card-institucional p-8 relative overflow-hidden group" role="listitem">
              <span className="absolute top-4 right-5 font-headline text-6xl text-emerald-900/[0.06] select-none" aria-hidden="true">
                {i + 1}
              </span>
              <div
                className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-700/20 flex items-center justify-center text-emerald-700 mb-5 group-hover:bg-emerald-100 transition-colors"
                aria-hidden="true"
              >
                {f.icon}
              </div>
              <h3 className="font-headline text-xl mb-3" style={{ color: '#1F2933' }}>{f.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
            </article>
          ))}
        </div>

        {/* Zona Yariguíes */}
        <div className="mt-8 card-institucional p-6 border-l-4 border-l-amber-500 flex gap-4 items-start">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-500/30 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <div>
            <p className="font-label text-amber-700 mb-1 text-[10px]">Zona Especial</p>
            <p className="text-slate-700 text-sm leading-relaxed">
              Las solicitudes de las veredas de la{' '}
              <span className="text-amber-800 font-medium">Zona Yariguíes</span> (Bajo Simacota)
              se enrutan automáticamente a la{' '}
              <span className="text-slate-900 font-medium">Subinspección de Policía Rural</span>{' '}
              y la Subhacienda Yariguíes, garantizando atención especializada para tu territorio.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--color-border)] py-8 text-center bg-white/40" role="contentinfo">
        <p className="font-label text-slate-500 text-[10px]">
          {INSTITUCION.nombre} · {INSTITUCION.departamento}, {INSTITUCION.pais} · {INSTITUCION.sistema}
        </p>
      </footer>
    </div>
  );
}
