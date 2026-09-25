# Migración de Radicación Pública

## Estado

La radicación pública nueva usa el flujo moderno `ventanilla_radicados`.

## Flujo actual

```txt
/radicacion
→ POST /api/radicacion
→ Firebase Admin SDK
→ ventanilla_radicados/{radicadoId}
→ ventanilla_radicados/{radicadoId}/trazabilidad
→ dashboard interno
→ consulta ciudadana
→ CSV MIPG
```

## Colecciones

- `ventanilla_radicados`: colección vigente para operación institucional.
- `ventanilla_radicados/{id}/trazabilidad`: historial append-only.
- `radicados`: colección legacy conservada solo para compatibilidad temporal de consulta.

## Regla operativa

No deben crearse radicados nuevos en `radicados`. Cualquier nuevo formulario público o integración externa debe usar `POST /api/radicacion`.

## Validación funcional

Para validar la transición:

1. Crear una solicitud desde `/radicacion`.
2. Confirmar que el número generado tiene formato `1-WEB-AAAA-########`.
3. Verificar en Firestore que existe en `ventanilla_radicados`.
4. Verificar que existe trazabilidad inicial en la subcolección.
5. Confirmar que aparece en el dashboard interno.
6. Consultar el estado desde `/consulta`.
7. Exportar CSV MIPG y confirmar que el registro aparece.

## Alcance no incluido

La migración masiva de históricos desde `radicados` no hace parte de este refuerzo. Se recomienda planearla como actividad separada con respaldo previo y ventana de mantenimiento.
