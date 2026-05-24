'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { markInternalSessionActive } from '@/lib/auth-session';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextUrl = useMemo(() => {
    const value = searchParams.get('next');
    return value?.startsWith('/interno/') && value !== '/interno/login'
      ? value
      : '/interno/dashboard';
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      markInternalSessionActive();
      router.replace(nextUrl);
    } catch {
      setError('Credenciales incorrectas. Verifica tu correo y contrasena.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-8 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-label text-slate-400 uppercase tracking-widest">
          Correo institucional
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="funcionario@simacota.gov.co"
          className="input-obsidian"
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-label text-slate-400 uppercase tracking-widest">
          Contrasena
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="********"
          className="input-obsidian"
          autoComplete="current-password"
        />
      </div>

      {error && (
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
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
