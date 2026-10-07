# Retrospectiva — cierre de autenticación y autorización de endpoints

Fecha: 30-sep-2026. Decisión: ADR-0047.

- **Salió bien:** separar identidad de autorización permitió comprobar los
  mismos contratos 401/403/500 en handlers reales, sin sustituir los roles ni
  las reglas de Firebase. La revisión cruzada encontró fallos de pertenencia
  que una sustitución textual de guards habría dejado intactos.
- **Qué mejorar:** al modificar archivos compartidos es necesario congelar
  una instantánea antes de la suite final. Una corrida interrumpida por el
  entorno, aunque tenga miles de casos aprobados, no equivale a un gate verde.
- **Deuda aparecida:** Copilot conserva un lector SDK cliente en servidor;
  faltan índices SIMI declarados en el repositorio; los avisos de cron con
  tenant `TODOS` no coinciden con el filtro existente de la bandeja; persiste
  el cálculo por zona del host en emisores compartidos de consecutivos. No se
  modificaron configuraciones remotas ni se ocultaron estos límites.
- **Qué automatizar:** contratos de autenticación al añadir cada endpoint;
  pruebas de permiso de recurso antes de lectura/escritura; fallo de commit
  para verificar que auditoría y operación de negocio son atómicas.
- **Qué aprendimos:** Firebase Admin puede clasificar fallos de certificados
  como `auth/argument-error`. La taxonomía documentada debe reconocer ese
  límite, sin intentar autenticar una credencial que no pudo verificarse.
- **Patrón reutilizable:** adaptador HTTP de sesión + autorización explícita
  del recurso + transacción/batch cuando un éxito requiere varias escrituras.
- **Regla que estorbó:** ninguna. La revisión cruzada aportó evidencia
  concreta; se evitó ampliar a refactor general, configuración de despliegue
  o modificaciones de datos reales para obtener un resultado aparente.

La extracción de utilidades de `route.ts` reduce deuda de contrato Next; no
se presenta retrospectivamente como un fallo reproducido del build del usuario.
