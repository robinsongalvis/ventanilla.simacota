/**
 * Número legal (expediente o radicado) en tipografía monoespaciada.
 *
 * `font-mono` es el stack monoespaciado de Tailwind ya usado en el panel
 * para números legales (ver `TarjetaMIPGGrande`, columna del radicado
 * crítico) — no se agrega una fuente nueva (`@fontsource/roboto-mono`) para
 * esto: el proyecto ya resuelve "la mono ya disponible" con la genérica del
 * sistema, sin dependencia de red adicional en build.
 *
 * Variantes (spec C.2): `expediente` es el protagonista — fondo suave
 * (`--bg-surface-2`, ya existente) y radio 8 (`rounded-lg`). `radicado` es
 * secundario — sin fondo, color `--text-secondary`. Nunca se mezclan en la
 * misma columna de una tabla.
 */
export function NumeroLegal({
  value,
  variant,
  size = 'md',
  className = '',
}: {
  value: string;
  variant: 'expediente' | 'radicado';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const tamano = size === 'lg' ? 'text-[18px]' : size === 'sm' ? 'text-[13px]' : 'text-sm';

  if (variant === 'expediente') {
    return (
      <span
        className={`font-mono ${tamano} font-bold rounded-lg px-2 py-0.5 inline-block ${className}`}
        style={{ background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}
      >
        {value}
      </span>
    );
  }

  return (
    <span
      className={`font-mono ${tamano} inline-block ${className}`}
      style={{ color: 'var(--text-secondary)' }}
    >
      {value}
    </span>
  );
}
