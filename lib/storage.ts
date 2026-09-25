/* ══════════════════════════════════════════════════════════════
   Aquí vivía `subirArchivos` — la subida DIRECTA de cliente a Storage.

   Se extirpó en el PT-3 (24-ago-2026): quedó sin un solo llamador tras el
   cutover (la pública sube por /api/radicacion, la interna por
   /api/radicacion/interna, la resolución por su endpoint), y las reglas de
   Storage cerraron el bucket entero a Admin-SDK-only — invocarla habría
   fallado contra las reglas. Un camino muerto que parece vivo es peor que
   ninguno. Queda el tipo de progreso, que la página pública consume.
══════════════════════════════════════════════════════════════ */
export interface UploadProgress {
  archivo:    string;
  porcentaje: number;   // 0–100
  estado:     'subiendo' | 'completado' | 'error';
  error?:     string;
}
