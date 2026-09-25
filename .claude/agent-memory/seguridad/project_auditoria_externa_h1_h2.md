---
name: auditoria-externa-h1-h2
description: Auditoría externa 2026-07-13 (5 hallazgos); a seguridad le tocaron H1 (identidad reservada) y H2 (multi-tenant = dependencias); protocolo de refutación por fases y veredictos emitidos
metadata:
  type: project
---

Auditoría externa (jul 2026), protocolo por fases: fase 1-2 = intentar REFUTAR hallazgos, sin recomendar soluciones aún, código congelado, todo con archivo:línea.

**Why:** el coordinador exige refutación activa (no confirmación complaciente) y separa diagnóstico de remediación en fases.

**How to apply:** en encargos de esta auditoría, no proponer fixes hasta que la fase lo pida; verificar siempre contra el código actual.

Veredictos emitidos (2026-07-13):
- H1 (identidad RESERVADA en claro en doc principal, enmascarado cliente): PARCIALMENTE CONFIRMADO, ALTA. Núcleo cierto (nombre+email+tel+dirección en claro; onSnapshot entrega doc completo; reglas no filtran campos), pero "solo en presentación" es impreciso: hay enmascarado server-side en búsqueda avanzada, consulta pública, Excel MIPG, SIMI, planillas, PDF, notificaciones bloqueadas. Además es riesgo aceptado por el propietario (ADR-0006 variante A + R10 en docs/REGISTRO_RIESGOS.md, 2026-07-13).
- H2 (tenant = dependencia de UNA alcaldía, sin dimensión municipio): CONFIRMADO como hecho, ALTA — pero no explotable hoy (no existe segundo municipio en los datos; brecha de escalabilidad, no fuga actual). Cero hits de municipioId/entidadId; INSTITUCION hardcodeada en lib/institucion.ts.

Hallazgos propios detectados en la misma pasada (para fases siguientes): magic bytes solo en /api/radicacion (subida interna directa a Storage valida solo contentType, storage.rules); counters read/write cliente para ADMIN/RECEPCIONISTA; create de ventanilla_radicados cliente solo valida id (firestore.rules:143-144); sanitizarPiiTextoSimi no cubre nombres en texto libre (trade-off declarado).
