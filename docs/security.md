# Manual de Seguridad e Higiene Digital
## Ventanilla Única Inteligente · Simacota

Este documento detalla los controles de seguridad, el modelo de autorización y las políticas de mitigación de riesgos de la plataforma de Ventanilla Única de Simacota. Garantiza el cumplimiento de estándares gubernamentales de protección de datos.

---

## 1. Modelo de Autorización y Matriz de Roles

La plataforma implementa un control de acceso basado en roles (**RBAC - Role-Based Access Control**). Los permisos se configuran de forma inmutable a nivel de servidor utilizando Reglas de Seguridad de Firestore:

| Rol | Descripción | Permisos Clave |
| :--- | :--- | :--- |
| **CIUDADANO** (No autenticado) | Público en general que ingresa al portal ciudadano. | * Crear radicados (`write` en `/radicados/*` bajo validación estricta de campos).<br>* Lectura de su propio radicado si posee el ID y código de verificación. |
| **RECEPCIONISTA** | Funcionario de correspondencia física u oficina de atención al ciudadano. | * Crear radicados manuales.<br>* Modificar metadatos de clasificación inicial.<br>* Realizar traslados físicos primarios. |
| **FUNCIONARIO** | Servidor público asignado a una secretaría o dependencia específica. | * Leer radicados asignados a su oficina.<br>* Usar copilotos especializados.<br>* Cargar respuestas y solicitar prórrogas.<br>* Generar trazabilidad en trámites bajo su custodia. |
| **ADMIN** | Alcalde, Despacho, Jefe de Control Interno o Administrador de TI. | * Acceso total de lectura a nivel municipal.<br>* Visualización del panel de supervisión de IA.<br>* Modificación de Feature Flags globales en caliente. |

---

## 2. Seguridad en Base de Datos (Reglas de Firestore)

El archivo `firestore.rules` del repositorio contiene las políticas lógicas que restringen las transacciones directamente en la base de datos:

* **Inmutabilidad de Trazabilidad**: La colección `/radicados/{radicadoId}/trazabilidad/{eventoId}` es estrictamente inmutable (`allow update, delete: if false;`). Un evento de bitácora no puede modificarse ni borrarse una vez creado, garantizando la integridad de auditorías gubernamentales.
* **Control de Modificaciones en Radicados**: Solo los funcionarios con rol verificado en `/usuarios/{uid}` pueden alterar campos transaccionales de control, estados o re-clasificar oficinas.
* **Aislamiento de Telemetría**: El ciudadano no tiene acceso de lectura ni escritura a las colecciones de gobernanza e infraestructura (`ai_logs`, `ai_auditoria`, `ai_feedback`).

---

## 3. Saneamiento de Inputs y Mitigación de XSS

Para contrarrestar ataques de inyección de código o ejecución de scripts en el navegador del funcionario (XSS - Cross-Site Scripting), la plataforma implementa una estrategia defensiva multidireccional:

1. **Escape en Radicación Pública**: Todos los datos que ingresan al formulario de radicación se limpian y escapan antes de persistir en Firestore y antes de transmitirse a la API de clasificación.
2. **Uso Seguro de React/Next.js**: Se evita categóricamente el uso de la directiva `dangerouslySetInnerHTML` en todo el código frontend del panel de funcionarios, mitigando la posibilidad de que payloads maliciosos inyectados en descripciones de radicados se ejecuten al ser renderizados en el dashboard administrativo.
3. **Control de Archivos Anexos**: Los archivos en Firebase Storage se limpian de caracteres extraños en sus nombres y se restringen por extensiones permitidas (`.pdf`, `.docx`, `.png`, `.jpg`). Además, las reglas de Storage previenen la ejecución de scripts del lado del cliente limitando los tipos MIME autorizados.
