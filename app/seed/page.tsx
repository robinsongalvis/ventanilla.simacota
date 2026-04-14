'use client';

import React, { useState } from 'react';
import { seedTodo } from '../../lib/seed';

export default function SeedPage() {
  const [msg, setMsg] = useState('Presiona para cargar datos de Simacota');
  const [loading, setLoading] = useState(false);

  async function ejecutar() {
    setLoading(true);
    setMsg('Sembrando datos en Firebase...');
    try {
      await seedTodo();
      setMsg('✅ ¡Éxito! Datos cargados. Ya puedes ir al Dashboard.');
    } catch (e) {
      setMsg('❌ Error de conexión. Revisa tus variables en Vercel.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: '#0a0a0b', color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <h1 style={{ marginBottom: '10px' }}>🌱 Sembrador Simacota</h1>
      <p style={{ color: '#94a3b8', marginBottom: '30px' }}>{msg}</p>
      <button
        onClick={ejecutar}
        disabled={loading}
        style={{ background: loading ? '#333' : '#6366f1', color: 'white', padding: '15px 30px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
      >
        {loading ? 'CARGANDO...' : 'CARGAR DATOS AHORA'}
      </button>
    </div>
  );
}
