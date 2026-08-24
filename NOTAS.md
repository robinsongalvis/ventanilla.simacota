# NOTAS — turno nocturno autónomo · 24-ago-2026

**Rama:** `feat/nocturno-go-live` · **Base:** `main` (`b5f6b88`) · **Sin push a main, sin deploys, sin escrituras en datos reales.**

---

## 0. La decisión que tomé antes de empezar (lea esto primero)

Su encargo decía *«trabaja … hasta terminar [tarea]»* — **el corchete llegó
sin llenar**. Apliqué su propia regla («si algo queda ambiguo, elige lo
conservador y anótalo») y elegí el subconjunto del `PLAN_GO_LIVE` que:

- no requiere ninguna decisión de producto suya,
- no toca datos reales, credenciales ni despliegues,
- y ya estaba clasificado 🟠/🟡 con solución conocida en la auditoría.

Si su intención era otra tarea concreta, nada de lo hecho estorba: son 12
commits acotados en rama aparte, y cada uno se puede descartar solo.

---

## 1. Lo hecho (12 commits, todos con test)

### Operación — el sistema deja de mentir sobre su propio estado
| Commit | Qué cambia | Por qué importa |
|---|---|---|
| A | **El cron de alertas responde 500** cuando hubo alertas y el 100% de los envíos falló | Con el SMTP vacío el cron se veía «sano» en Vercel mientras CERO avisos de vencimiento (Ley 1755) llegaban a nadie |
| B | **6 rutas de Control Interno**: `logError` + mensaje genérico | Fallaban mudas (ni consola ni Sentry) y 5 filtraban `err.message` crudo al cliente |
| C | **5 catch vacíos de bitácoras probatorias** (auditoría de descargas de PII, trazabilidad de notificación) ahora registran | Si Firestore rechazara esas escrituras, la bitácora se agujereaba sin señal: se descubriría en auditoría externa, no por el control |
| D | **`auth/session`** registra la causa real del 401 | El 18-ago una credencial ilegible del servidor se mostró como «contraseña incorrecta» y costó un diagnóstico entero |

### CI/CD — dos huecos de la auditoría, cerrados
| Commit | Qué añade |
|---|---|
| E | **Smoke-test post-deploy** (G3/G4 del SEV-1): tras cada deploy a Production golpea 4 superficies reales con GET; si alguna no responde 200, abre incidencia con instrucción de rollback. *El SEV-1 estuvo 14 h en 500 porque nada comprobaba esto.* |
| F | **Deploy de reglas gobernado + vigía semanal de deriva** (remata PT-5): deploy solo manual con confirmación escrita y desde `main`; los lunes verifica que las reglas vivas sigan siendo las del repo y abre incidencia si no |

### Producto — dos promesas que el sistema no cumplía
| Commit | Qué cambia |
|---|---|
| G | Los **4 «interruptores» de IA** eran decorativos (solo movían estado local): un ADMIN que «apagaba» el chat SIMI creía haberlo apagado. Ahora son **indicadores de solo lectura** con la verdad al pie |
| H | El **radicado de origen del expediente es un enlace** al tablero — antes la funcionaria debía ir a Ventanilla y buscarlo a mano para ver los anexos del ciudadano |
| I | **ADR-0032 (BORRADOR)**: documenta el sistema de diseño que entró sin ADR, con sus deudas reconocidas |

### Correcciones de mi propio trabajo (revisión adversarial)
| Commit | Qué corrige |
|---|---|
| J | El **vigía confundía «no pude comprobar» con «hay deriva»**: un secret revocado o un parpadeo de red habrían abierto una incidencia FALSA con el cuerpo vacío. Y `npx firebase-tools` iba **sin versión** en el paso que despliega reglas de producción con la credencial en disco — fijado a 15.19.0 |
| K | El **enlace del commit H se pudre a los 180 días** (ventana del tablero) y un expediente se consulta durante años: ahora el mensaje dice la causa real y la salida, y la promesa del panel está acotada |
| L | **Inyección de shell** vía inputs de workflow en el job que porta la SA de producción; la **SA estaba en el entorno de `npm ci`**; falta de `concurrency`; y mi `logError` en `auth/session` habría mandado a Sentry **cada token expirado** de un endpoint público, inundando la bandeja el día del estreno |

---

## 2. Lo pendiente (nada de esto lo hice, y por qué)

### Requiere decisión suya
1. **El radicado crítico del tablero** (PT-7): el refactor de UI lo quitó
   con argumento propio. Restaurar, adaptar o aceptar es decisión de
   producto — no la tomé por usted.
2. **Ratificar el ADR-0032** (o decidir revertir el enfoque del sistema de
   diseño). Está en BORRADOR a propósito.
3. **`--text-muted` (#94A3B8) rinde 2,5:1 en ~236 usos** — deuda de
   accesibilidad **preexistente**, no del refactor. Tocarlo mueve toda la
   interfaz: merece su visto bueno.
4. **Ventana del tablero (180 días)**: si quiere que el enlace al radicado
   funcione siempre, hay que cargar el radicado puntualmente fuera del
   stream — toca el presupuesto de rendimiento (ADR-0010/R11).

### Requiere una gestión externa suya
5. **Secret `FIREBASE_SA_RULES`** para que el workflow de reglas funcione
   (la misma admin-sdk de producción sirve; ya demostró poder desplegar).
   Sin él **falla cerrado con instrucción**, nunca finge.
6. **DSN de Sentry**, **buzón SMTP**, **dominio `simacota.gov.co` caído**
   (DNS, SERVFAIL global) — los tres siguen igual que anoche.
7. **Captura de proveedores de Auth** (sin auto-registro ni anónimo) para
   el expediente del PT-3.

### Trabajo técnico que queda
8. **PT-4 — respaldo de los adjuntos de Storage**: sigue siendo el hueco
   real de continuidad (el export de Firestore **no** incluye archivos).
   No lo hice porque crear buckets/versioning es infraestructura viva.
9. **Tests propios de los 9 componentes** del sistema de diseño.
10. **El cron 500 solo tiene guardas de forma** — un test de
    comportamiento con el mailer caído sería más fuerte.

---

## 3. Decisiones que tomé (y su porqué)

1. **Elegí el alcance yo** por el corchete vacío — conservador, sin datos,
   sin despliegues. *(§0)*
2. **Toggles de IA: eliminar el engaño, no inventar el mecanismo.**
   Cablearlos de verdad (flags en Firestore + consulta en runtime) es
   diseño con decisiones suyas; fingir control era el daño inmediato.
3. **Enlace del expediente: acotar la promesa en vez de ampliar la
   ventana.** Ampliarla toca rendimiento gobernado por ADR.
4. **`firebase-tools` fijado a 15.19.0** — la versión que ya desplegó con
   éxito hoy, no la última del registro.
5. **Ruido ≠ avería en `auth/session`**: un token expirado es esperable en
   un endpoint público; solo las averías del servidor van a Sentry.
6. **ADR-0032 en BORRADOR, no ACEPTADO.** Documentar tarde es mejor que no
   documentar, pero yo no ratifico decisiones de arquitectura suyas.
7. **El deploy de reglas quedó MANUAL** (con confirmación escrita y solo
   desde `main`): cambiar reglas vivas debe ser una decisión, nunca un
   efecto colateral de un merge.

---

## 4. Verificación

- `tsc --noEmit` limpio y `eslint` sin errores nuevos tras **cada** commit.
- Ambos workflows: YAML parsea y `bash -n` limpio en todos sus pasos.
- **Revisión adversarial** de mi propio diff con 3 lentes (contratos,
  workflows, tests) — encontró **3 defectos serios y 2 de seguridad en mi
  trabajo**, todos corregidos en J, K y L. Sin esa revisión, este turno le
  habría entregado una inyección de shell y una alarma que miente.
- Suite completa sobre la rama: el único fallo recurrente es
  `radicacion-interna-staging-falla` (familia conocida de *timeouts* de 5 s
  bajo carga) — **verde al re-correr aislado**.

## 5. Cómo revisar esto

```bash
git fetch origin && git log --oneline origin/main..origin/feat/nocturno-go-live
git diff origin/main...origin/feat/nocturno-go-live
```

**No abrí PR**: usted dijo rama aparte sin push a main, y abrir el PR es
suyo. Los 12 commits son independientes — puede tomar unos y descartar
otros con `git cherry-pick`.
