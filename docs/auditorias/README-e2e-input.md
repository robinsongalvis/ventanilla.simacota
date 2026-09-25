# E2E de stage como input registrado de la compuerta (ADR-0013, 2D)

El E2E Playwright (`e2e/*.spec.ts`, 15 flujos) **no corre en CI**: necesita el
proyecto *stage* y credenciales (ADR-0013 §Decisión, viñeta E2E; alternativa 3
diferida a Ola 3). Por eso la compuerta de despliegue lo consume como **input
registrado**, no como paso del pipeline.

## Contrato del archivo `docs/auditorias/e2e-ultimo.json`

```json
{
  "sha": "867a49f65af01d92d324fae582da14e5b2a1ef3d",
  "fecha": "2026-07-12T15:30:00-05:00",
  "resultado": "verde",
  "corridaPor": "coordinador",
  "specs": "e2e/*.spec.ts (15 flujos Playwright)",
  "notas": "15/15 en verde contra stage"
}
```

| Campo | Obligatorio | Valores | Efecto en el informe |
|---|---|---|---|
| `sha` | sí | SHA completo del commit verificado | Se compara con el SHA candidato de CI |
| `fecha` | sí | ISO-8601 | Trazabilidad |
| `resultado` | sí | `verde` \| `rojo` | Ver reglas abajo |
| `corridaPor` | recomendado | quién corrió el E2E | Trazabilidad |
| `specs` / `notas` | opcional | texto | Trazabilidad |

## Cómo lo interpreta el informe (categoría Funcional → fuente E2E)

- `resultado: "rojo"` → 🔴 **rojo** (bloquea).
- `resultado: "verde"` **y** `sha` == SHA candidato de la corrida → 🟢 **verde**.
- `resultado: "verde"` pero `sha` != candidato (o archivo ausente / `resultado`
  desconocido) → 🟡 **amber**: *no hay corrida E2E reciente contra este SHA*.

La compuerta **nunca inventa un verde** si no hay dato contra el SHA candidato
(ADR-0013). En la práctica, un PR normal tendrá la categoría Funcional en amber
hasta que el coordinador corra el E2E contra ese SHA y actualice este archivo —
por diseño: no se despliega sin un E2E fresco.

## Procedimiento del coordinador (pre-deploy)

1. Correr el E2E contra stage: `npm run test:e2e` (con el entorno de stage —
   ver `scripts/laboratorio/dev-stage.mjs` y `VARIABLES_ENTORNO.md`).
2. Si pasa: actualizar `sha` (el SHA exacto probado), `fecha`, `resultado: "verde"`.
3. Commit del archivo actualizado. La siguiente corrida de CI sobre ese SHA
   verá la categoría Funcional en verde.
4. Con el informe en verde, el propietario da la orden de despliegue (el disparo
   sigue siendo humano — AGENTS.md / regla operativa vigente).
