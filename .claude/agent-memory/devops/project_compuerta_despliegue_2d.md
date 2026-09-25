---
name: compuerta-despliegue-2d
description: Compuerta de despliegue (ADR-0013, 2D) implementada; branch protection de main PENDIENTE de activación por el propietario (acción humana, requiere admin)
metadata:
  type: project
---

Frente 2D (Ola 2) implementado: orquestador `scripts/laboratorio/informe-despliegue.mjs`
+ job final `informe-despliegue` en `.github/workflows/ci.yml` que agrega los controles
en un informe con semáforo por categoría (funcional/normativo/seguridad/rendimiento/
observabilidad) + veredicto global (verde/amber/rojo). Artefacto `informe/` + step summary.
E2E de stage entra como input registrado en `docs/auditorias/e2e-ultimo.json`.

**Estado PENDIENTE (acción del propietario, no automatizable desde aquí):** la
precondición dura de `main` (branch protection exigiendo los checks `validate`,
`laboratorio-emulador`, `informe-despliegue`) NO está activada. Requiere permisos de
admin en `robinsongalvis/ventanilla.simacota`; en el entorno del agente no hay `gh` ni
token. Hasta que el propietario la active, la compuerta REPORTA (informe rojo/verde) pero
no BLOQUEA el merge por sí sola.

**Why:** ADR-0013 exige gobernanza (ningún deploy sin informe verde) + regla operativa
vigente (ningún deploy a prod sin orden explícita del propietario).
**How to apply:** si en una sesión futura el propietario pregunta por qué un merge en rojo
no se bloqueó, o pide "activar la compuerta", es esto: falta correr el `gh api` de branch
protection (comando en el handoff de la sesión que implementó 2D / en el ADR-0013).
Verificar con `gh api repos/robinsongalvis/ventanilla.simacota/branches/main/protection`.
Relacionado: [[stage_y_presupuesto]] (el E2E corre contra stage, no en CI).
