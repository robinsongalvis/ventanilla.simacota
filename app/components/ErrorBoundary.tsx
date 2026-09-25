'use client';

/**
 * ErrorBoundary institucional — Ventanilla Única de Simacota.
 *
 * Captura errores de React en componentes hijo y muestra un
 * fallback claro en lugar de pantalla blanca.
 *
 * Uso:
 *   <DashboardErrorBoundary>
 *     {children}
 *   </DashboardErrorBoundary>
 */

import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Mensaje personalizado (opcional) */
  mensaje?: string;
}

interface State {
  hasError: boolean;
  errorId:  string | null;
}

export class DashboardErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
      errorId:  `ERR-${Date.now().toString(36).toUpperCase()}`,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Solo loguear en desarrollo o si Sentry está disponible.
    // Nunca mostrar el stack al usuario final.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary]', error.message, info.componentStack?.slice(0, 300));
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/interno/dashboard';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const mensaje =
      this.props.mensaje ??
      'Ocurrió un error al cargar el panel. Intenta recargar la página o vuelve a iniciar sesión.';

    return (
      <div
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: '#F8FAF7', minHeight: '400px' }}
      >
        <div
          className="w-full max-w-md rounded-2xl p-8 text-center bg-white"
          style={{ border: '1px solid #D9E2D9', boxShadow: '0 4px 16px rgba(20,83,45,0.08)' }}
        >
          {/* Ícono */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
          >
            <svg
              className="w-7 h-7"
              style={{ color: '#DC2626' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          {/* Texto */}
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-2"
            style={{ color: '#DC2626' }}
          >
            Error del sistema
          </p>
          <h2
            className="text-base font-black mb-3"
            style={{ color: '#1F2933', fontFamily: 'var(--font-manrope)' }}
          >
            Panel temporalmente no disponible
          </h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: '#667085' }}>
            {mensaje}
          </p>

          {/* Código de error — útil para soporte técnico */}
          {this.state.errorId && (
            <p className="text-[10px] font-mono mb-6" style={{ color: '#94A3B8' }}>
              Código: {this.state.errorId}
            </p>
          )}

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: '#14532D' }}
            >
              Recargar página
            </button>
            <button
              onClick={this.handleGoHome}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
              style={{ border: '1px solid #D9E2D9', color: '#667085' }}
            >
              Ir al inicio
            </button>
          </div>

          {/* Nota institucional */}
          <p className="text-[10px] mt-6 leading-snug" style={{ color: '#94A3B8' }}>
            Si el problema persiste, comuníquese con el administrador del sistema.
            <br />
            Alcaldía Municipal de Simacota — Ventanilla Única Digital
          </p>
        </div>
      </div>
    );
  }
}
