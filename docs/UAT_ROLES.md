# UAT por Roles y Dependencias

## Objetivo

Preparar usuarios controlados para validar la Ventanilla Única Digital de la Alcaldía Municipal de Simacota antes del piloto institucional gradual.

## Tipos de usuario

| Tipo | Uso |
| :--- | :--- |
| `INSTITUCIONAL` | Usuario real de la Alcaldía. |
| `UAT` | Usuario temporal para prueba institucional controlada. |
| `PRUEBA` | Usuario técnico o temporal para validaciones internas. |

Los usuarios UAT o de prueba deben archivarse al terminar la validación. Archivar no borra el historial: desactiva acceso, revoca sesiones y conserva auditoría.

## Roles permitidos

| Rol | Alcance |
| :--- | :--- |
| `ADMIN` | Administra usuarios, ve todo, accede a reportes, MIPG y configuración. |
| `RECEPCIONISTA` | Recibe, clasifica y asigna radicados. No administra usuarios. |
| `FUNCIONARIO` | Gestiona y responde radicados de su dependencia. |
| `JEFE_DEPENDENCIA` | Consulta y hace seguimiento de su dependencia. Solo lectura operativa. |
| `CONTROL_INTERNO` | Audita globalmente y exporta reportes. Solo lectura. |

No crear roles por fuera de esta lista.

## Dependencias

Usar únicamente el selector oficial del sistema. No escribir dependencias manualmente. Si Control Interno no tiene tenant específico, usar `DESPACHO_ALCALDE` o el tenant definido por la Alcaldía para auditoría.

## Usuarios mínimos recomendados

| Nombre sugerido | Rol | Dependencia | Tipo |
| :--- | :--- | :--- | :--- |
| Administrador del Sistema | `ADMIN` | `DESPACHO_ALCALDE` | `INSTITUCIONAL` |
| Usuario Recepción | `RECEPCIONISTA` | `VENTANILLA_UNICA` | `UAT` |
| Funcionario Secretaría de Gobierno | `FUNCIONARIO` | `SEC_GOBIERNO` | `UAT` |
| Funcionario Secretaría de Planeación | `FUNCIONARIO` | `SEC_PLANEACION` | `UAT` |
| Funcionario Desarrollo Social | `FUNCIONARIO` | `SEC_DESARROLLO_SOCIAL` | `UAT` |
| Funcionario Inspección Yariguíes | `FUNCIONARIO` | `SUB_INSPECCION_POLICIA_RURAL` | `UAT` |
| Jefe Secretaría de Gobierno | `JEFE_DEPENDENCIA` | `SEC_GOBIERNO` | `UAT` |
| Jefe Planeación | `JEFE_DEPENDENCIA` | `SEC_PLANEACION` | `UAT` |
| Control Interno | `CONTROL_INTERNO` | `DESPACHO_ALCALDE` | `UAT` |

## Procedimiento UAT

1. Crear usuarios desde Administración.
2. Verificar que el correo corresponda a la persona que hará la prueba.
3. Asignar rol y dependencia usando selectores oficiales.
4. Marcar cuentas temporales como `UAT`.
5. Probar login en computador y celular.
6. Validar que cada rol ve solo lo que corresponde.
7. Ejecutar radicación, asignación, respuesta, consulta ciudadana y CSV MIPG.
8. Registrar hallazgos por dependencia.
9. Archivar usuarios UAT que no continuarán en operación.

## Auditoría esperada

Administración registra eventos como:

- `USUARIO_CREADO`
- `USUARIO_EDITADO`
- `USUARIO_DESACTIVADO`
- `USUARIO_REACTIVADO`
- `USUARIO_ARCHIVADO`
- `USUARIO_MARCADO_PRUEBA`
- `USUARIO_MARCADO_INSTITUCIONAL`
- `ROL_CAMBIADO`
- `DEPENDENCIA_USUARIO_CAMBIADA`
- `RESET_PASSWORD_SOLICITADO`

Cada evento debe conservar actor, usuario afectado, rol, dependencia, fecha y metadata del cambio.
