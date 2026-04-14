"use client";

import { useState, useEffect, useRef } from "react";
import { getDb, getFirebaseAuth } from "@/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";

// --- 1. DIRECTORIO OFICIAL — DATOS REALES DE SIMACOTA ---
const DIRECTORIO_OFICIAL: Record<string, any> = {
  VENTANILLA_UNICA: { tenantId: "VENTANILLA_UNICA", nombre: "Ventanilla Única", email: "contactenos@simacota-santander.gov.co", celular: "3502956401" },
  DESPACHO_ALCALDE: { tenantId: "DESPACHO_ALCALDE", nombre: "Despacho del Alcalde", email: "alcaldia@simacota-santander.gov.co", celular: "3502956389" },
  SEC_GOBIERNO: { tenantId: "SEC_GOBIERNO", nombre: "Secretaría de Gobierno", email: "gobierno@simacota-santander.gov.co", celular: "3502956394" },
  SEC_PLANEACION: { tenantId: "SEC_PLANEACION", nombre: "Secretaría de Planeación", email: "planeacion@simacota-santander.gov.co", celular: "3502956396" },
  SEC_DESARROLLO_SOCIAL: { tenantId: "SEC_DESARROLLO_SOCIAL", nombre: "Secretaría de Desarrollo Social", email: "desarrollosocial@simacota-santander.gov.co", celular: "3502956398" },
  SEC_HACIENDA: { tenantId: "SEC_HACIENDA", nombre: "Secretaría de Hacienda", email: "tesoreria@simacota-santander.gov.co", celular: "3502956397" },
  SEC_AGRICULTURA_UMATA: { tenantId: "SEC_AGRICULTURA_UMATA", nombre: "Secretaría de Agricultura (UMATA)", email: "umata@simacota-santander.gov.co", celular: "3502956388" },
  SUB_COMISARIA: { tenantId: "SUB_COMISARIA", nombre: "Comisaría de Familia", email: "comisariadefamilia@simacota-santander.gov.co", celular: "3502956386" },
  SUB_INSPECCION_POLICIA_URBANA: { tenantId: "SUB_INSPECCION_POLICIA_URBANA", nombre: "Inspección de Policía", email: "inspecciondepolicia@simacota-santander.gov.co", celular: "3502956387" },
  SUB_INSPECCION_POLICIA_RURAL: { tenantId: "SUB_INSPECCION_POLICIA_RURAL", nombre: "Inspección de Policía Yariguíes", email: "inspecciondepoliciarural@simacota-santander.gov.co", celular: "3502956385", zonaExclusiva: "ZONA_YARIGUIES" },
  SUB_VICTIMAS: { tenantId: "SUB_VICTIMAS", nombre: "Enlace de Víctimas", email: "enlacevictimas@simacota-santander.gov.co", celular: "3502956399" },
  SUB_SISBEN: { tenantId: "SUB_SISBEN", nombre: "SISBEN", email: "sisben@simacota-santander.gov.co", celular: "3502956393" },
  SUB_RIESGOS_GRD: { tenantId: "SUB_RIESGOS_GRD", nombre: "Gestión del Riesgo de Desastres", email: "grd@simacota-santander.gov.co", celular: "3183921847" },
  SUB_PROGRAMAS: { tenantId: "SUB_PROGRAMAS", nombre: "Programas Sociales", email: "programassociales@simacota-santander.gov.co", celular: "3502956392" },
  SUB_HACIENDA_YARIGUIES: { tenantId: "SUB_HACIENDA_YARIGUIES", nombre: "Oficina Hacienda Yariguíes", email: "haciendayariguies@simacota-santander.gov.co", celular: "3502956400", zonaExclusiva: "ZONA_YARIGUIES" },
};

const OPCIONES_TENANT = Object.values(DIRECTORIO_OFICIAL);

// --- 2. DATOS DE PRUEBA (RADICADOS) ---
const RADICADOS_PRUEBA = [
  { origen: "WEB", estadoActual: "PENDIENTE", prioridad: "ROJO", ciudadano: { nombre: "María García López", email: "maria.garcia@gmail.com", telefono: "3156789012" }, clasificacionIA: { oficinaDestino: "SEC_GOBIERNO", zonaGeografica: "CASCO_URBANO", resumenCaso: "Solicita certificado de residencia para trámite de Familias en Acción. Indica que lleva 5 años viviendo en el casco urbano.", mensajeOriginal: "Buenos días, necesito un certificado de residencia para el programa Familias en Acción. Vivo en el barrio Centro de Simacota desde hace 5 años. Mi número de cédula es 63451234. Agradezco su pronta respuesta." }, archivos: [], auditoria: [{ accion: "RADICACION", actor: "Agente IA", nota: "Radicado desde portal web." }, { accion: "CLASIFICACION_IA", actor: "Agente IA", nota: "Clasificado automáticamente. Destino: Secretaría de Gobierno. Confianza: 94%." }], diasAtras: 0 },
  { origen: "FISICO_ESCANER", estadoActual: "PENDIENTE", prioridad: "ROJO", ciudadano: { nombre: "José Rodríguez Peña", email: "", telefono: "3201234567" }, clasificacionIA: { oficinaDestino: "SUB_INSPECCION_POLICIA_RURAL", zonaGeografica: "ZONA_YARIGUIES", resumenCaso: "Denuncia conflicto de linderos con finca colindante en vereda La Rochela. Solicita inspección ocular.", mensajeOriginal: "Denuncio que mi vecino Pedro Suárez está moviendo los linderos de mi finca en la vereda La Rochela. Ya tumbó dos postes de la cerca. Necesito que la inspección de policía haga una visita urgente." }, archivos: [{ nombre: "denuncia_escrita.pdf", url: "", tipo: "application/pdf", tamanioKB: 2340 }, { nombre: "foto_cerca.jpg", url: "", tipo: "image/jpeg", tamanioKB: 1850 }], auditoria: [{ accion: "RADICACION", actor: "Recepcionista VU", nota: "Radicado por ventanilla física. Ciudadano de vereda La Rochela." }, { accion: "CLASIFICACION_IA", actor: "Agente IA", nota: "Clasificado automáticamente. Zona Yariguíes detectada (vereda La Rochela). Destino: Inspección de Policía Rural. Confianza: 97%." }], diasAtras: 1 },
  { origen: "WEB", estadoActual: "EN_REVISION", prioridad: "NARANJA", ciudadano: { nombre: "Ana Martínez Ruiz", email: "ana.martinez@yahoo.com", telefono: "3109876543" }, clasificacionIA: { oficinaDestino: "SUB_COMISARIA", zonaGeografica: "CASCO_URBANO", resumenCaso: "Reporta situación de violencia intrafamiliar. Solicita medida de protección inmediata.", mensajeOriginal: "Necesito ayuda urgente. Mi esposo me agredió físicamente anoche. Tengo dos hijos menores. Solicito medida de protección. Vivo en el barrio San Rafael de Simacota." }, archivos: [], auditoria: [{ accion: "RADICACION", actor: "Agente IA", nota: "Radicado desde portal web. Prioridad alta por tipo de caso." }, { accion: "CLASIFICACION_IA", actor: "Agente IA", nota: "Clasificado automáticamente. Destino: Comisaría de Familia. Confianza: 99%." }, { accion: "CAMBIO_ESTADO", actor: "Comisaria de Familia", nota: "Caso tomado para revisión inmediata.", metadata: { estadoAnterior: "PENDIENTE", estadoNuevo: "EN_REVISION" } }], diasAtras: 2 },
  { origen: "WEB", estadoActual: "EN_PROCESO", prioridad: "AMARILLO", ciudadano: { nombre: "Carlos Hernández Díaz", email: "", telefono: "3178765432" }, clasificacionIA: { oficinaDestino: "SEC_AGRICULTURA_UMATA", zonaGeografica: "ZONA_YARIGUIES", resumenCaso: "Solicita asistencia técnica para cultivo de cacao en vereda El Guamo. Reporta plaga en plantación.", mensajeOriginal: "Soy agricultor de la vereda El Guamo. Tengo 3 hectáreas de cacao y desde hace un mes las plantas tienen una plaga que no puedo controlar. Necesito que un técnico de la UMATA visite mi finca." }, archivos: [{ nombre: "fotos_plaga.pdf", url: "", tipo: "application/pdf", tamanioKB: 4200 }], auditoria: [{ accion: "RADICACION", actor: "Agente IA", nota: "Radicado desde portal web." }, { accion: "CLASIFICACION_IA", actor: "Agente IA", nota: "Zona Yariguíes (vereda El Guamo). Destino: UMATA. Confianza: 96%." }, { accion: "CAMBIO_ESTADO", actor: "Técnico UMATA", nota: "Visita técnica programada para el viernes.", metadata: { estadoAnterior: "PENDIENTE", estadoNuevo: "EN_REVISION" } }, { accion: "CAMBIO_ESTADO", actor: "Técnico UMATA", nota: "Técnico asignado. Visita en curso.", metadata: { estadoAnterior: "EN_REVISION", estadoNuevo: "EN_PROCESO" } }], diasAtras: 4 },
  { origen: "FISICO_ESCANER", estadoActual: "RESUELTO", prioridad: "ROJO", ciudadano: { nombre: "Luz Amparo Sánchez", email: "luz.sanchez@gmail.com", telefono: "3145678901" }, clasificacionIA: { oficinaDestino: "SEC_PLANEACION", zonaGeografica: "CASCO_URBANO", resumenCaso: "Solicita concepto de uso de suelo para construcción de vivienda en lote del barrio El Carmen.", mensajeOriginal: "Solicito concepto de uso de suelo para mi lote ubicado en el barrio El Carmen, manzana 4, lote 12. Planeo construir una vivienda de dos pisos." }, archivos: [{ nombre: "escritura_lote.pdf", url: "", tipo: "application/pdf", tamanioKB: 3100 }, { nombre: "plano_lote.pdf", url: "", tipo: "application/pdf", tamanioKB: 1500 }], auditoria: [{ accion: "RADICACION", actor: "Recepcionista VU", nota: "Radicado por ventanilla física." }, { accion: "CLASIFICACION_IA", actor: "Agente IA", nota: "Destino: Secretaría de Planeación. Confianza: 91%." }, { accion: "CAMBIO_ESTADO", actor: "Sec. Planeación", nota: "En revisión de documentos.", metadata: { estadoAnterior: "PENDIENTE", estadoNuevo: "EN_REVISION" } }, { accion: "RESPUESTA_FUNCIONARIO", actor: "Sec. Planeación", nota: "Concepto de uso de suelo emitido. Favorable para construcción residencial." }, { accion: "CAMBIO_ESTADO", actor: "Sec. Planeación", nota: "Caso resuelto. Concepto emitido.", metadata: { estadoAnterior: "EN_REVISION", estadoNuevo: "RESUELTO" } }], diasAtras: 6 },
  { origen: "WEB", estadoActual: "DEVUELTO", prioridad: "NARANJA", ciudadano: { nombre: "Pedro Torres Vargas", email: "", telefono: "3187654321" }, clasificacionIA: { oficinaDestino: "SUB_SISBEN", zonaGeografica: "CASCO_URBANO", resumenCaso: "Solicita actualización de ficha SISBEN por cambio de domicilio dentro del municipio.", mensajeOriginal: "Me mudé del barrio Centro al barrio San Rafael hace 3 meses. Necesito actualizar mi ficha del SISBEN con la nueva dirección." }, archivos: [], auditoria: [{ accion: "RADICACION", actor: "Agente IA", nota: "Radicado desde portal web." }, { accion: "CLASIFICACION_IA", actor: "Agente IA", nota: "Destino: SISBEN. Confianza: 98%." }, { accion: "CAMBIO_ESTADO", actor: "Func. SISBEN", nota: "Se requiere copia de recibo de servicios públicos de la nueva dirección.", metadata: { estadoAnterior: "PENDIENTE", estadoNuevo: "EN_REVISION" } }, { accion: "DEVOLUCION", actor: "Func. SISBEN", nota: "Devuelto al ciudadano. Falta recibo de servicios de la nueva dirección como soporte." }, { accion: "CAMBIO_ESTADO", actor: "Func. SISBEN", nota: "Devuelto por documentación incompleta.", metadata: { estadoAnterior: "EN_REVISION", estadoNuevo: "DEVUELTO" } }], diasAtras: 3 },
  { origen: "WEB", estadoActual: "PENDIENTE", prioridad: "AMARILLO", ciudadano: { nombre: "Rosa Elena Morales", email: "rosa.morales@outlook.com", telefono: "3112345678" }, clasificacionIA: { oficinaDestino: "SUB_VICTIMAS", zonaGeografica: "ZONA_YARIGUIES", resumenCaso: "Solicita atención como víctima del conflicto armado. Desplazamiento forzado desde vereda Danto Alto en 2003.", mensajeOriginal: "Soy víctima de desplazamiento forzado. Salí de la vereda Danto Alto en 2003. Estoy incluida en el Registro Único de Víctimas pero no he recibido la indemnización. Necesito orientación." }, archivos: [], auditoria: [{ accion: "RADICACION", actor: "Agente IA", nota: "Radicado desde portal web." }, { accion: "CLASIFICACION_IA", actor: "Agente IA", nota: "Zona Yariguíes (vereda Danto Alto). Destino: Enlace de Víctimas. Confianza: 95%." }], diasAtras: 1 },
  { origen: "FISICO_ESCANER", estadoActual: "EN_PROCESO", prioridad: "ROJO", ciudadano: { nombre: "Diego Ramírez Castro", email: "diego.ramirez@gmail.com", telefono: "3169012345" }, clasificacionIA: { oficinaDestino: "DESPACHO_ALCALDE", zonaGeografica: "CASCO_URBANO", resumenCaso: "Solicita audiencia con el Alcalde para gestión de mejoramiento de vía terciaria que conecta casco urbano con vereda Guayabal.", mensajeOriginal: "Como presidente de la JAC de la vereda Guayabal, solicito audiencia con el señor Alcalde para tratar el deterioro de la vía. Llevamos 2 años sin mantenimiento." }, archivos: [{ nombre: "carta_solicitud_jac.pdf", url: "", tipo: "application/pdf", tamanioKB: 890 }, { nombre: "fotos_via.pdf", url: "", tipo: "application/pdf", tamanioKB: 5600 }], auditoria: [{ accion: "RADICACION", actor: "Recepcionista VU", nota: "Radicado por ventanilla física. Presidente JAC vereda Guayabal." }, { accion: "CLASIFICACION_IA", actor: "Agente IA", nota: "Destino: Despacho del Alcalde. Confianza: 88%." }, { accion: "CAMBIO_ESTADO", actor: "Sec. Privada", nota: "Audiencia programada.", metadata: { estadoAnterior: "PENDIENTE", estadoNuevo: "EN_PROCESO" } }], diasAtras: 5 }
];

// --- 3. UTILIDADES ---
function fechaHaceXDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  fecha.setHours(7 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
  return fecha.toISOString();
}

function generarRadicadoId(): string {
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, "0");
  const dd = String(ahora.getDate()).padStart(2, "0");
  const HH = String(ahora.getHours()).padStart(2, "0");
  const min = String(ahora.getMinutes()).padStart(2, "0");
  const ss = String(ahora.getSeconds()).padStart(2, "0");
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let sufijo = "";
  for (let i = 0; i < 4; i++) sufijo += chars.charAt(Math.floor(Math.random() * chars.length));
  return `EXT-${yyyy}-${mm}-${dd}-${HH}${min}${ss}-${sufijo}`;
}

type LogType = 'info' | 'success' | 'error' | 'normal';

// --- COMPONENTE PRINCIPAL ---
export default function SeedPage() {
  const [acceso, setAcceso] = useState("");
  const [autorizado, setAutorizado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<{ msg: string, type: LogType }[]>([]);
  const [stats, setStats] = useState({ users: 0, docs: 0 });
  const logEndRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    email: "funcionario@simacota.gov.co",
    pass: "",
    nombre: "Administrador del Sistema",
    rol: "ADMIN",
    tenant: "DESPACHO_ALCALDE"
  });

  const agregarLog = (msg: string, type: LogType = 'normal') => {
    setLogs(prev => [...prev, { msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type }]);
  };

  // Scroll automático en consola
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Cargar estadísticas
  useEffect(() => {
    if (autorizado) fetchStats();
  }, [autorizado]);

  const fetchStats = async () => {
    try {
      const db = getDb();
      const uSnap = await getDocs(collection(db, "users"));
      const rSnap = await getDocs(collection(db, "radicados"));
      setStats({ users: uSnap.size, docs: rSnap.size });
    } catch (e) {
      agregarLog("Error cargando diagnóstico de BD.", "error");
    }
  };

  // Lógica de Autenticación y vinculación
  const handleAuth = async (mode: 'crear' | 'vincular') => {
    setLoading(true);
    agregarLog(`Iniciando flujo: ${mode === 'crear' ? 'Crear Nuevo Usuario' : 'Vincular Existente'}...`, "info");

    try {
      const auth = getFirebaseAuth();
      const db = getDb();
      let userCredential;

      if (mode === 'crear') {
        userCredential = await createUserWithEmailAndPassword(auth, form.email, form.pass);
        agregarLog(`Usuario creado en Firebase Auth. UID: ${userCredential.user.uid}`, "info");
      } else {
        userCredential = await signInWithEmailAndPassword(auth, form.email, form.pass);
        agregarLog(`Autenticación exitosa. UID: ${userCredential.user.uid}`, "info");
      }

      const uid = userCredential.user.uid;

      const datosUsuario = {
        uid,
        email: form.email,
        nombre: form.nombre,
        rol: form.rol,
        tenantId: form.tenant,
        activo: true,
        fechaCreacion: new Date().toISOString()
      };

      await setDoc(doc(db, "users", uid), datosUsuario);
      agregarLog(`Documento users/${uid} creado en Firestore con rol ${form.rol}`, "success");

      await signOut(auth);
      agregarLog("Sesión cerrada. El usuario ya puede ingresar por /interno/dashboard", "normal");
      fetchStats();

    } catch (error: any) {
      if (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential") {
        agregarLog("❌ Este usuario no existe en Firebase Auth. Créalo o usa 'Crear usuario nuevo'.", "error");
      } else if (error.code === "auth/wrong-password") {
        agregarLog("❌ Contraseña incorrecta.", "error");
      } else if (error.code === "auth/email-already-in-use") {
        agregarLog("❌ Este email ya existe en Auth. Usa 'Vincular usuario existente'.", "error");
      } else {
        agregarLog(`❌ Error crítico: ${error.message}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  // Lógica de Seed de Radicados
  const handleSeed = async () => {
    setLoading(true);
    agregarLog("Iniciando inyección de radicados de prueba...", "info");
    try {
      const db = getDb();
      for (const r of RADICADOS_PRUEBA) {
        const id = generarRadicadoId();
        const tenantOficial = DIRECTORIO_OFICIAL[r.clasificacionIA.oficinaDestino];

        const docRef = doc(db, "radicados", id);
        await setDoc(docRef, {
          radicadoId: id,
          fechaCreacion: fechaHaceXDias(r.diasAtras),
          estado: r.estadoActual,
          prioridad: r.prioridad,
          origen: r.origen,
          ciudadano: r.ciudadano,
          clasificacionIA: r.clasificacionIA,
          archivos: r.archivos,
          auditoria: r.auditoria,
          destino: {
            tenantId: tenantOficial.tenantId,
            nombre: tenantOficial.nombre
          }
        });
        agregarLog(`> Creado radicado ${id} → ${r.prioridad} | ${r.estadoActual} | ${tenantOficial.nombre}`, "normal");
      }
      agregarLog("✅ 8 radicados creados exitosamente.", "success");
      fetchStats();
    } catch (error: any) {
      agregarLog(`❌ Error creando radicados: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("¿Seguro que deseas eliminar TODOS los radicados?")) return;
    setLoading(true);
    try {
      const db = getDb();
      const snapshot = await getDocs(collection(db, "radicados"));
      const batchPromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(batchPromises);
      agregarLog(`🗑️ ${snapshot.size} radicados eliminados de Firestore.`, "success");
      fetchStats();
    } catch (error: any) {
      agregarLog(`❌ Error eliminando radicados: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER ACCESO ---
  if (!autorizado) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900/40 p-8 rounded-2xl border border-white/10 backdrop-blur-xl w-full max-w-md text-center">
          <span className="inline-block bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold mb-4">Uso Interno</span>
          <h1 className="text-white font-bold text-xl mb-6">Herramienta de Configuración</h1>
          <input
            type="password"
            placeholder="Código de Acceso"
            value={acceso}
            onChange={(e) => setAcceso(e.target.value)}
            className="w-full bg-slate-800/50 border border-white/10 p-3 rounded-xl text-white mb-4 outline-none focus:border-indigo-500 text-center tracking-[0.5em]"
          />
          <button
            onClick={() => acceso === "SIMACOTA2026" ? setAutorizado(true) : alert("Código incorrecto")}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all"
          >
            ACCEDER
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER DASHBOARD SEED ---
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-300 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER & DIAGNÓSTICO */}
        <div className="bg-slate-900/40 backdrop-blur-[25px] border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold mb-2 inline-block">Herramienta de Configuración</span>
            <h1 className="text-white text-2xl font-black tracking-tighter uppercase italic">Ventanilla Única Setup</h1>
          </div>
          <div className="text-sm space-y-1 bg-black/50 p-4 rounded-xl border border-white/5 w-full md:w-auto">
            <p className="font-bold text-white mb-2">📊 Diagnóstico del Sistema</p>
            <p>Firebase Auth: <span className="text-emerald-400">✅ Conectado</span></p>
            <p>Firestore DB: <span className="text-emerald-400">✅ Conectado</span></p>
            <p>Usuarios Registrados: <span className="text-indigo-400 font-bold">{stats.users}</span></p>
            <p>Radicados Existentes: <span className="text-indigo-400 font-bold">{stats.docs}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* SECCIÓN 1: VINCULAR USUARIO */}
          <section className="bg-slate-900/40 backdrop-blur-[25px] border border-white/10 p-6 rounded-2xl space-y-4">
            <h2 className="text-white font-bold flex items-center gap-2"><span className="text-indigo-500">👤</span> Sección 1: Vincular Usuario del Sistema</h2>
            <p className="text-xs text-slate-400">Resuelve el error de login conectando Auth con Firestore.</p>

            <div className="space-y-3 pt-2">
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-slate-800/50 border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-indigo-500 text-white" placeholder="Email (ej. recepcion@simacota.gov.co)" />
              <input type="password" value={form.pass} onChange={e => setForm({ ...form, pass: e.target.value })} className="w-full bg-slate-800/50 border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-indigo-500 text-white" placeholder="Contraseña" />
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full bg-slate-800/50 border border-white/10 p-3 rounded-xl text-sm outline-none focus:border-indigo-500 text-white" placeholder="Nombre completo del Funcionario" />

              <div className="grid grid-cols-2 gap-3">
                <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} className="bg-slate-800/50 border border-white/10 p-3 rounded-xl text-sm outline-none text-white">
                  <option value="ADMIN">ADMIN</option>
                  <option value="RECEPCIONISTA">RECEPCIONISTA</option>
                  <option value="FUNCIONARIO">FUNCIONARIO</option>
                </select>

                <select value={form.tenant} onChange={e => setForm({ ...form, tenant: e.target.value })} className="bg-slate-800/50 border border-white/10 p-3 rounded-xl text-sm outline-none text-white">
                  {OPCIONES_TENANT.map(t => <option key={t.tenantId} value={t.tenantId}>{t.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => handleAuth('vincular')} disabled={loading || !form.pass} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-3 rounded-xl transition-all disabled:opacity-50">
                VINCULAR EXISTENTE
              </button>
              <button onClick={() => handleAuth('crear')} disabled={loading || !form.pass} className="flex-1 bg-slate-800/50 border border-white/10 text-slate-300 hover:bg-slate-700/50 text-xs font-bold py-3 rounded-xl transition-all disabled:opacity-50">
                CREAR NUEVO
              </button>
            </div>
          </section>

          {/* SECCIÓN 2: POBLAR RADICADOS & LOGS */}
          <div className="space-y-6 flex flex-col">
            <section className="bg-slate-900/40 backdrop-blur-[25px] border border-white/10 p-6 rounded-2xl flex-1 space-y-4">
              <h2 className="text-white font-bold flex items-center gap-2"><span className="text-indigo-500">📋</span> Sección 2: Poblar Radicados de Prueba</h2>
              <p className="text-xs text-slate-400">Genera 8 radicados con datos realistas para las distintas dependencias de la Alcaldía.</p>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSeed} disabled={loading} className="flex-1 bg-white text-black hover:bg-slate-200 text-xs font-bold py-3 rounded-xl transition-all disabled:opacity-50">
                  POBLAR RADICADOS
                </button>
                <button onClick={handleClear} disabled={loading} className="flex-1 bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 text-xs font-bold py-3 rounded-xl transition-all disabled:opacity-50">
                  🗑️ LIMPIAR
                </button>
              </div>
            </section>

            {/* LOG TERMINAL */}
            <div className="bg-slate-950 rounded-xl p-4 font-mono text-sm h-48 overflow-y-auto border border-white/5 relative">
              <div className="sticky top-0 bg-slate-950 pb-2 mb-2 border-b border-white/5 text-[10px] text-slate-500 uppercase tracking-widest">
                System Logs
              </div>
              <div className="space-y-1">
                {logs.length === 0 && <span className="text-slate-700">Esperando ejecución...</span>}
                {logs.map((log, i) => (
                  <div key={i} className={`
                    ${log.type === 'error' ? 'text-rose-400' : ''}
                    ${log.type === 'success' ? 'text-emerald-400' : ''}
                    ${log.type === 'info' ? 'text-indigo-400' : ''}
                    ${log.type === 'normal' ? 'text-slate-400' : ''}
                  `}>
                    {log.msg}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>

        </div>

        {/* SECCIÓN 3: DIRECTORIO VISUAL */}
        <section className="bg-slate-900/40 backdrop-blur-[25px] border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-white font-bold flex items-center gap-2"><span className="text-indigo-500">🏛️</span> Sección 3: Directorio de Dependencias</h2>
            <p className="text-xs text-slate-400 mt-1">Referencia oficial de la Alcaldía de Simacota. (Solo lectura)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-400 uppercase bg-black/40">
                <tr>
                  <th className="px-6 py-3 font-medium">Dependencia</th>
                  <th className="px-6 py-3 font-medium">Tenant ID</th>
                  <th className="px-6 py-3 font-medium">Email Oficial</th>
                  <th className="px-6 py-3 font-medium">Celular</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {OPCIONES_TENANT.map((t, i) => (
                  <tr key={t.tenantId} className={i % 2 === 0 ? "bg-slate-800/20" : ""}>
                    <td className="px-6 py-4 font-medium text-white">{t.nombre}</td>
                    <td className="px-6 py-4 font-mono text-[10px] text-indigo-400">{t.tenantId}</td>
                    <td className="px-6 py-4">{t.email}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {t.celular.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}