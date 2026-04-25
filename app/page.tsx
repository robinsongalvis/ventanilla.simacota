import Link from 'next/link';

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
    <div className="bg-obsidian-gradient min-h-screen flex flex-col">

      {/* ── Navbar ── */}
      <header className="border-b border-white/[0.06] sticky top-0 z-50 backdrop-blur-[20px] bg-[#0A0A0B]/70">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v5c0 5.25-3.5 10.15-8 11.5C7.5 22.15 4 17.25 4 12V7l8-4z" />
              </svg>
            </div>
            <div>
              <p className="font-label text-indigo-400 text-[10px]">Alcaldía Municipal</p>
              <p className="text-slate-100 font-semibold text-sm leading-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
                Simacota, Santander
              </p>
            </div>
          </div>
          <Link
            href="/interno/dashboard"
            className="font-label text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
          >
            Acceso funcionarios →
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 mb-8 animate-fade-in-up">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse-glow" />
          <span className="font-label text-indigo-400 text-[11px]">Sistema activo — Cuentas Claras</span>
        </div>

        {/* Headline */}
        <h1
          className="font-headline text-5xl md:text-7xl text-slate-50 max-w-4xl mb-6 animate-fade-in-up"
          style={{ animationDelay: '0.1s', opacity: 0 }}
        >
          Ventanilla Única{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            Digital
          </span>
        </h1>

        {/* Subtítulo */}
        <p
          className="text-slate-400 text-lg md:text-xl max-w-2xl leading-relaxed mb-12 animate-fade-in-up"
          style={{ animationDelay: '0.2s', opacity: 0 }}
        >
          Radica tu solicitud desde cualquier lugar. La inteligencia artificial la clasifica
          y la envía a la dependencia correcta en segundos.{' '}
          <span className="text-slate-300 font-medium">Trazabilidad total, cuentas claras.</span>
        </p>

        {/* CTAs */}
        <div
          className="flex flex-col sm:flex-row gap-4 items-center animate-fade-in-up"
          style={{ animationDelay: '0.3s', opacity: 0 }}
        >
          <Link href="/radicacion" className="btn-primary text-base px-8 py-4 rounded-xl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Radicar mi Solicitud
          </Link>
          <a
            href="#como-funciona"
            className="text-slate-400 hover:text-slate-200 transition-colors font-medium text-base px-6 py-4"
          >
            ¿Cómo funciona?
          </a>
        </div>

        {/* Stats */}
        <div
          className="grid grid-cols-3 gap-8 mt-20 animate-fade-in-up"
          style={{ animationDelay: '0.4s', opacity: 0 }}
        >
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-headline text-3xl text-slate-50 mb-1">{s.value}</p>
              <p className="font-label text-slate-500 text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ── Cómo funciona ── */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-6 pb-24 w-full">
        <div className="text-center mb-12">
          <p className="font-label text-indigo-400 mb-3">Proceso</p>
          <h2 className="font-headline text-3xl md:text-4xl text-slate-100">Cómo funciona</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="glass-card p-8 relative overflow-hidden group">
              <span className="absolute top-4 right-5 font-headline text-6xl text-white/[0.04] select-none">
                {i + 1}
              </span>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 mb-5 group-hover:bg-indigo-500/25 transition-colors">
                {f.icon}
              </div>
              <h3 className="font-headline text-xl text-slate-100 mb-3">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Zona Yariguíes */}
        <div className="mt-8 glass-card p-6 border-l-2 border-l-rose-500/60 flex gap-4 items-start">
          <div className="w-10 h-10 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <div>
            <p className="font-label text-rose-400 mb-1 text-[10px]">Zona Especial</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Las solicitudes de las veredas de la{' '}
              <span className="text-rose-300 font-medium">Zona Yariguíes</span> (Bajo Simacota)
              se enrutan automáticamente a la{' '}
              <span className="text-slate-200 font-medium">Subinspección de Policía Rural</span>{' '}
              y la Subhacienda Yariguíes, garantizando atención especializada para tu territorio.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-8 text-center">
        <p className="font-label text-slate-600 text-[10px]">
          Alcaldía Municipal de Simacota · Santander, Colombia · Sistema de Ventanilla Única Digital
        </p>
      </footer>
    </div>
  );
}
