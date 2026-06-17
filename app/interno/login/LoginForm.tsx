'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { createInternalSession } from '@/lib/auth-session';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const nextUrl = useMemo(() => {
    const value = searchParams.get('next');
    return value?.startsWith('/interno/') && value !== '/interno/login'
      ? value
      : '/interno/dashboard';
  }, [searchParams]);

  const logLogin = (step: string, details?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'development') return;
    console.info('[login]', step, details ?? {});
  };

  const resolveErrorMessage = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('Usuario interno no autorizado') || message.includes('permisos')) {
      return 'Tu usuario no tiene permisos para acceder al panel.';
    }

    if (message.includes('auth/invalid-credential') || message.includes('auth/wrong-password') || message.includes('auth/user-not-found')) {
      return 'No fue posible iniciar sesión. Verifica tus datos o intenta nuevamente.';
    }

    if (message.includes('auth/network-request-failed') || message.includes('Failed to fetch') || message.includes('The operation was aborted')) {
      return 'Revisa tu conexión a internet e intenta nuevamente.';
    }

    return 'No fue posible iniciar sesión. Verifica tus datos o intenta nuevamente.';
  };

  const redirectToPanel = (url: string) => {
    logLogin('redireccion iniciada', { nextUrl: url });
    router.replace(url);

    window.setTimeout(() => {
      const targetPath = new URL(url, window.location.origin).pathname;
      if (window.location.pathname !== targetPath) {
        logLogin('fallback navegacion dura', { nextUrl: url });
        window.location.assign(url);
      }
    }, 900);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStatus('Validando credenciales...');
    logLogin('inicio de login');

    try {
      logLogin('credenciales enviadas', { email: email.trim() ? 'presente' : 'vacio' });
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      logLogin('auth success', { uid: credential.user.uid });
      setStatus('Creando sesión segura...');
      const idToken = await credential.user.getIdToken();
      logLogin('token obtenido');
      await createInternalSession(idToken, () => credential.user.getIdToken(true));
      logLogin('cookie creada');
      setStatus('Ingresando al panel...');
      redirectToPanel(nextUrl);
    } catch (err) {
      logLogin('error detectado', { message: err instanceof Error ? err.message : String(err) });
      setError(resolveErrorMessage(err));
      setStatus('');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card-institucional p-6 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-label text-slate-600 uppercase tracking-widest">
          Correo institucional
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="funcionario@simacota.gov.co"
          className="input-internal"
          autoComplete="email"
          inputMode="email"
          disabled={loading}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-label text-slate-600 uppercase tracking-widest">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="********"
          className="input-internal"
          autoComplete="current-password"
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-300 rounded-lg px-4 py-2.5" role="alert">
          {error}
        </p>
      )}

      {status && (
        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg px-4 py-2.5" aria-live="polite">
          {status}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full mt-1 min-h-12 touch-manipulation">
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-smooth" />
            Ingresando...
          </>
        ) : (
          'Ingresar al Panel'
        )}
      </button>
    </form>
  );
}
