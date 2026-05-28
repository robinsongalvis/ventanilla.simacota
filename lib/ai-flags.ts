export const AI_FEATURE_FLAGS = {
  ENABLE_SIMI_CHAT:       true,   // Habilita el chat flotante ciudadano SIMI
  ENABLE_AUTO_CLASSIFY:   true,   // Habilita la clasificación debounce en caliente
  ENABLE_AUTO_TAGS:       true,   // Habilita la inyección semántica de etiquetas
  ENABLE_AI_SUMMARY:      true,   // Habilita la generación de resúmenes de PQRS
  ENABLE_PREDICTIVE_MODE: false,  // Alertas preventivas avanzadas (Fase 4)
};
export type AiFeatureFlags = typeof AI_FEATURE_FLAGS;
