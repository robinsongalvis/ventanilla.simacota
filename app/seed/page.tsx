'use client'
import { seedTodo } from '@/lib/seed'; // Si da error, prueba con '@/app/lib/seed'
import { useState } from 'react';

export default function SeedPage() {
    const [msg, setMsg] = useState('Presiona el botón para cargar los datos de Simacota');

    const ejecutar = async () => {
        setMsg('Sembrando datos...');
        try {
            await seedTodo();
            setMsg('✅ ¡Éxito! 8 radicados creados. Ya puedes ir al Dashboard.');
        } catch (e) {
            setMsg('❌ Error. Revisa la consola (F12).');
            console.error(e);
        }
    }

    return (
        <div style={{ background: '#0a0a0b', color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: 'sans-serif' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>🌱 Sembrador de Simacota</h1>
            <p style={{ marginBottom: '30px', color: '#94a3b8' }}>{msg}</p>
            <button onClick={ejecutar} style={{ background: '#6366f1', color: 'white', padding: '15px 30px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                CARGAR DATOS AHORA
            </button>
        </div>
    );
}