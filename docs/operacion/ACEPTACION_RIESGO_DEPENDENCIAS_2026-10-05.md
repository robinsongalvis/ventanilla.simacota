# Aceptación temporal de riesgo — Firebase/Firestore/gRPC y tooling

- **Fecha de decisión:** 2026-10-05
- **Responsable de la aceptación:** Robinson Galvis (propietario)
- **Próxima revisión obligatoria:** 2026-10-26
- **Mecanismo de gobierno:** ADR-0028 y `audit-allowlist.json`
- **Estado:** riesgo aceptado temporalmente; remediación pendiente de upstream

## Decisión

Se acepta temporalmente el riesgo residual que `npm audit` reporta sobre la rama
cliente de Firebase/Firestore y el hallazgo exclusivo del tooling de desarrollo.
La aceptación evita forzar una combinación fuera de los rangos soportados, pero
no declara las dependencias seguras ni convierte el resultado crudo de
`npm audit` en verde.

Esta aceptación **no autoriza un despliegue a Production**, no autoriza cambios
en Firebase real y no modifica secretos, datos ni consecutivos. La salida a
Production conserva sus demás compuertas y requiere una autorización separada.

## Evidencia medida en el candidato

Candidato evaluado: `7adb21043001434b7ee6d814aab7844a6665a34e`.

| Dimensión | Resultado |
|---|---:|
| HIGH totales reportados | 10 |
| HIGH en dependencias de Production | 4 |
| CRITICAL totales | 0 |

Los cuatro HIGH de Production son propagaciones en el árbol de dependencias de
la misma rama vulnerable; no representan cuatro vulnerabilidades independientes.

### Rama cliente pendiente de upstream

```text
firebase@12.18.0
└── @firebase/firestore@4.17.1
    └── @grpc/grpc-js@1.9.16  (rango declarado por Firestore: ~1.9.0)
```

- `GHSA-m9gg-hp2v-232j` — severidad **HIGH**. La primera versión corregida
  identificada es `@grpc/grpc-js@1.13.6`.
- `GHSA-f596-whhp-79r4` — severidad **LOW**. También queda corregida desde
  `@grpc/grpc-js@1.13.6`; se documenta, pero no se agrega a la allowlist porque
  ADR-0028 gobierna únicamente HIGH/CRITICAL.
- `1.13.6` queda fuera del rango `~1.9.0` declarado por Firestore. Por tanto,
  **no se aplicará un override no autorizado** ni se romperá semver para obtener
  un audit verde artificial.

No se encontraron imports directos de `@grpc/grpc-js`, creación de servidores
gRPC, llamadas a `getAuthContext` ni validación de certificados de clientes en
el código de la aplicación. La instancia vulnerable se consume indirectamente
por Firestore como cliente saliente. Esto reduce la alcanzabilidad observada de
las rutas vulnerables, pero no elimina el riesgo de cadena de suministro.

### Rama administrativa ya corregida

```text
firebase-admin@14.4.0
└── @google-cloud/firestore@9.3.0
    ├── google-gax@6.10.0
    │   └── @grpc/grpc-js@1.14.5
    └── @google-cloud/firestore-api@0.2.0
        └── google-gax@5.0.8
            └── @grpc/grpc-js@1.14.5
```

Las dos rutas transitivas de la rama Firebase Admin/Google Cloud usan `1.14.5`,
fuera de los rangos afectados por los dos advisories anteriores. La excepción
no cubre ni modifica esta rama.

## Hallazgo exclusivo de desarrollo y pruebas

```text
eslint-config-next@16.3.3
└── @next/eslint-plugin-next@16.3.3
    └── fast-glob@3.3.1
        └── micromatch@4.0.8
            └── braces@3.0.3
```

`GHSA-vfj7-8cjw-p6xm` se mantiene como seguimiento pasivo temporal. La cadena
está marcada `dev=true` en el lockfile, se usa en lint/CI y no se empaqueta como
runtime de Production. No procesa patrones aportados por ciudadanos; el riesgo
residual identificado es agotamiento de recursos del runner de tooling.

No se degradará Next.js `16.3.6`, no se introducirán overrides y no se
modificará la cadena solo para que `npm audit` muestre cero hallazgos.

## Controles compensatorios

1. Excepciones por advisory exacto, con responsable y caducidad, según ADR-0028.
2. Cualquier advisory HIGH/CRITICAL nueva sigue bloqueando el pipeline.
3. La caducidad `2026-10-26` mantiene la excepción vigente ese día; el gate
   bloqueará desde `2026-10-27` si no se renueva o retira tras nueva evaluación.
4. Revisión semanal automática de releases estables de `firebase` y
   `@firebase/firestore`, además del seguimiento de Dependabot.
5. No se modifican las versiones ni el lockfile en esta aceptación.

## Revisión y criterios de cierre

La revisión se adelanta si aparece una release estable nueva relevante de
Firebase/Firestore o una advisory adicional. A más tardar el 2026-10-26 se debe:

1. comprobar si Firestore amplió el rango de `@grpc/grpc-js` o actualizó la
   transitiva a `>=1.13.6`;
2. actualizar sin override y repetir audit, pruebas Firestore/Firebase Admin,
   transacciones, Rules/emulador, build y Node 24;
3. retirar las excepciones si el árbol queda corregido; o
4. renovar la aceptación mediante una decisión explícita, con evidencia de
   alcanzabilidad actualizada y nueva fecha de caducidad.

Referencias:

- [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j)
- [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4)
- [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [ADR-0028](../adr/0028-gate-de-auditoria-gobernado.md)
