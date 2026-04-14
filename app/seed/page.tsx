'use client';

import React, { useState } from 'react';
import { seedTodo } from '../../lib/seed';

export default function SeedPage() {
    const [msg, setMsg] = useState('Presiona el botón para cargar los datos de Simacota');
    const [loading, setLoading] = useState(false);

    const ejecutar = async () => {
        setLoading(true);
        setMsg('Sembrando datos en Firebase...');
        try {
            await seedTodo();
            setMsg('✅ ¡Éxito! 8 radicados creados. Ya puedes ir al Dashboard.');
        } catch (e) {
            setMsg('❌ Error de conexión. Revisa las variables de entorno en Vercel.');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            background: '#0a0a0b',
            color: 'white',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            fontFamily: 'sans-serif',
            textAlign: 'center',
            padding: '20px'
        }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '20px', fontWeight: '800', letterSpacing: '-1px' }}>
                🌱 Sembrador de Simacota
            </h1>
            <p style={{ marginBottom: '30px', color: '#94a3b8', maxWidth: '400px' }}>
                {msg}
            </p>
            <button
                onClick={ejecutar}
                disabled={loading}
                style={{
                    background: loading ? '#333' : '#6366f1',
                    color: 'white',
                    padding: '15px 30px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease'
                }}
            >
                {loading ? 'CARGANDO...' : 'CARGAR DATOS AHORA'}
            </button>
        </div>
    );
}