# Checklist oficial — Licencia de Construcción · Modalidad Obra Nueva (Simacota)

> Insumo real entregado por el propietario (levantamiento con Secretaría de Planeación). Es la **parametrización de la primera "Definición de Trámite"** del motor genérico de expedientes (no código: dato configurable desde administración).
> ⚠️ **Es "Página 1 de 2" — falta la página 2.** Pendiente de recibir para completar el catálogo.

## Requisitos (marcar tipo: OBLIGATORIO / CONDICIONAL / con regla)

| # | Requisito | Tipo | Regla / condición | Norma / nota |
|---|---|---|---|---|
| 1 | Solicitud escrita del titular o apoderado + copia cédula + celular + cuadro de áreas | Obligatorio | — | — |
| 2 | Formulario Único Nacional de solicitud de licencias, diligenciado en su totalidad | Obligatorio | — | Adoptado por MinAmbiente/Vivienda |
| 3 | Poder o autorización + presentación personal de quien lo otorga + copia cédula apoderado | **Condicional** | Solo si la solicitud la presenta un apoderado/autorizado | — |
| 4 | Certificado de Tradición y Libertad del inmueble | Obligatorio | **Vigencia ≤ 30 días** antes de la solicitud | — |
| 5 | Copia de la escritura pública del predio | Obligatorio | — | — |
| 6 | Documento de identidad del solicitante (persona natural) **o** certificado de existencia y representación legal (persona jurídica, ≤ 1 mes) | Obligatorio | Según tipo de persona | — |
| 7 | Declaración/impuesto predial del último año (o certificación de acuerdo de pago de Hacienda) | Obligatorio | Variante si hay acuerdo de pago | — |
| 8 | Paz y salvo municipal del titular/propietario | Obligatorio | — | — |
| 9 | Relación de direcciones de predios colindantes (en el Formulario Único) | **Condicional** | **NO exigible** si el predio está rodeado completamente por espacio público o en zona rural no suburbana | Def. colindante = lindero común |
| 10 | Acta de colindancia de los predios colindantes | **Condicional** | Ligado al #9 | — |
| 11 | Certificación REDAM (Registro de Deudores Alimentarios Morosos) de los propietarios | Obligatorio | — | — |
| 12 | Planos hidráulicos y sanitarios (conexión a red matriz) + planos estructurales firmados/rotulados por Ingeniero Civil | **Condicional** | Para categorías **Baja** y **Media Complejidad** | — |
| 13 | Estudio de suelos y geotécnico + memorias de cálculo estructural | **Condicional** | Proyectos **NO sujetos al Título E de la NSR-10** | NSR-10 |
| 14 | Proyecto arquitectónico impreso, rotulado y firmado por arquitecto con matrícula (contenido mínimo: localización, plantas, alzados/cortes, fachadas, cubiertas con red pluvial, cuadro de áreas, corte con cableado eléctrico/RETIE). **2 copias impresas + digital** | Obligatorio | Contenido mínimo detallado | Art. 2.2.6.1.2.3.5 / **Decreto 1203 de 2017**; RETIE vigente |
| 15 | Certificación de disponibilidad inmediata de servicios públicos + soporte de acceso directo a vía pública vehicular | Obligatorio | — | — |
| 16 | Copia de matrícula profesional + certificaciones de experiencia (Ing. Civil y Arquitecto) | **Condicional** | "Para trámites que así lo requieran" | — |
| 17 | Memorial de responsabilidad firmado por los profesionales | Obligatorio | — | — |
| 18 | Valla de citación a vecinos colindantes (se hacen parte en 5 días hábiles desde fijación en Planeación) | Obligatorio | Actuación de **publicidad** con ventana de 5 días | Confirma el hallazgo normativo v1 |
| 19 | Cancelación de expensas por la licencia | Obligatorio | Pago | — |

## Hallazgo de diseño que este checklist confirma (para el motor)

**El checklist parametrizable DEBE soportar requisitos CONDICIONALES, no solo obligatorio/opcional.** Varios requisitos dependen de reglas del caso (apoderado sí/no, categoría de complejidad, Título E NSR-10, predio rodeado de espacio público, tipo de persona). Un motor que solo distinga "obligatorio/opcional" no cubre este trámite real → la "Definición de Trámite" necesita **requisitos con condición evaluable**. (Se traslada a la síntesis del blueprint del motor.)

También confirma, del análisis normativo: **citación a colindantes con 5 días hábiles** (#18), **expensas** (#19), y **Decreto 1203 de 2017** como norma vigente del contenido de la licencia (además del Decreto 1077).

**Pendiente:** página 2 del checklist + validación del listado completo con la Secretaría de Planeación.
