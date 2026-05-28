# Registro y Gobernanza de Prompts
## Ventanilla Única Inteligente · Simacota

Este registro técnico centraliza, describe e ilustra la estructura de las plantillas de prompts de Inteligencia Artificial que dirigen la clasificación, el asistente de atención ciudadana y los copilotos de secretaría de la plataforma.

---

## 1. Filosofía de Centralización de Prompts

Para evitar que las instrucciones algorítmicas queden dispersas en el código de la aplicación (generando problemas de mantenimiento o inconsistencias de estilo), toda la lógica de prompts está estrictamente centralizada en archivos de TypeScript bajo las siguientes rutas:

1. **`lib/ai/prompts/classifier.ts`**: Prompt estructurado y JSON Schema estricto para el clasificador de radicación.
2. **`lib/ai/prompts/simi.ts`**: Reglas de personalidad, tono institucional, restricciones de seguridad e historial del Asistente SIMI.
3. **`lib/ai/agents/shared/prompts.ts`**: Instrucciones base de comportamiento administrativo y directrices especializadas por secretaría para los copilotos.

---

## 2. Inventario de Prompts del Sistema

### 2.1. Clasificador de Radicados (`classifier.ts`)
* **Propósito**: Analizar el texto del ciudadano para sugerir enrutamiento y prioridades.
* **Técnica**: Inferencia Estructurada (*Structured Outputs*). Fuerza al modelo a responder estrictamente con un objeto JSON coincidente con el esquema TypeScript de la plataforma.
* **Instrucciones Clave**:
  * Evaluar urgencia en base a palabras de riesgo (ej. *"peligro", "inundación", "riesgo"* -> Prioridad **Rojo**).
  * Asignar oficina destino pertinente (ej. *Planeación e Infraestructura*, *Secretaría de Gobierno*, *Desarrollo Social*).
  * Proveer un "resumen ejecutivo" de máximo dos líneas sin juicios de valor.

### 2.2. Asistente Conversacional "SIMI" (`simi.ts`)
* **Propósito**: Interactuar empáticamente con los ciudadanos, resolver dudas generales de trámites y guiar la radicación.
* **Tono**: Institucional, servicial, claro, respetuoso y profundamente simacotero.
* **Directrices de Seguridad**:
  * No adivinar ni prometer soluciones de trámites.
  * No emitir opiniones políticas ni representaciones legales en nombre del alcalde.
  * Si el ciudadano solicita iniciar radicación, capturar la esencia del asunto e invitarlo a completar el formulario.

### 2.3. Copilotos Especializados (`lib/ai/agents/shared/prompts.ts`)
* **Propósito**: Asistir al funcionario público en la atención de trámites específicos.
* **Prompts Específicos por Dependencia**:
  * **Secretaría de Planeación**: Enfocado en revisión de linderos, normas de ordenamiento territorial (EOT) del municipio, especificaciones de construcción y saneamiento básico.
  * **Secretaría de Gobierno**: Enfocado en sana convivencia, código nacional de policía, mediación de conflictos comunitarios y seguridad rural.
  * **Desarrollo Social**: Enfocado en atención de población vulnerable, SISBEN, programas del Adulto Mayor, infancia y adolescencia.

---

## 3. Control de Versiones y Pruebas A/B

Cualquier cambio en las instrucciones de los agentes debe seguir el flujo estándar de desarrollo de software:
1. **Modificación**: Cambiar la plantilla de texto únicamente en el archivo centralizado correspondiente en `lib/ai/`.
2. **Pruebas de Regresión**: Validar localmente que la respuesta del modelo siga cumpliendo el JSON Schema del sistema.
3. **Estadística de Impacto**: Monitorear el panel de supervisión en producción durante 7 días posteriores para certificar que la tasa de desvío (*overrides*) de la secretaría afectada no se haya degradado.
