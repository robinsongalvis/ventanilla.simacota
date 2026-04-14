'use client';

import React, { useState } from 'react';
import { seedTodo } from '../../lib/seed';

export default function SeedPage() {
    const [msg, setMsg] = useState('Presiona para cargar datos de Simacota');
    const [loading, setLoading] = useState(false);

    async function ejecutar() {
        setLoading(true);
        setMsg('Sembrando datos...');
        try {
            await seedTodo();
            setMsg('✅ ¡Éxito! Datos cargados correctamente.');
        } catch (e) {
            setMsg('❌ Error de conexión.');
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ background: '#0a0a0b', color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: 'sans-serif' }}>
            <h1>🌱 Sembrador Simacota</h1>
            <p style={{ color: '#94a3b8', margin: '20px 0' }}>{msg}</p>
            <button
                onClick={ejecutar}
                disabled={loading}
                style={{ background: '#6366f1', color: 'white', padding: '15px 30px', borderRadius: '10px', cursor: 'pointer', border: 'none', fontWeight: 'bold' }}
            >
                {loading ? 'CARGANDO...' : 'CARGAR DATOS'}
            </button>
        </div>
    );
}