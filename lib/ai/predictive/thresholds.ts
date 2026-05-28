export const PREDICTIVE_THRESHOLDS = {
  RIESGO_CRITICO: 0.80,         // Probabilidad de vencimiento >= 80%
  RIESGO_MEDIO: 0.45,           // Probabilidad de vencimiento >= 45%
  SATURACION_ALTA: 0.75,        // Índice de saturación de secretaría >= 75%
  SATURACION_MEDIA: 0.40,       // Índice de saturación de secretaría >= 40%
  DERIVA_SEMANTICA: 0.30,       // Desviación del 30% en frecuencia de etiquetas (frecuencia delta)
  VENTANA_TENDENCIAS_DIAS: 15,  // Días de rango móvil para delta de tags
};

// Capacidad diaria estimada de resolución de PQRS por dependencia
export const CAPACIDAD_DIARIA_DEPENDENCIAS: Record<string, number> = {
  VENTANILLA_UNICA: 10,
  DESPACHO_ALCALDE: 3,
  SEC_GOBIERNO: 5,
  SEC_PLANEACION: 4,
  SEC_DESARROLLO_SOCIAL: 4,
  SEC_HACIENDA: 6,
  SEC_AGRICULTURA_UMATA: 3,
  SUB_COMISARIA: 2,
  SUB_INSPECCION_POLICIA_URBANA: 3,
  SUB_INSPECCION_POLICIA_RURAL: 3,
  SUB_SISBEN: 8,
  SUB_VICTIMAS: 3,
  SUB_RIESGOS_GRD: 2,
  SUB_PROGRAMAS: 6,
  SUB_HACIENDA_YARIGUIES: 3,
};
