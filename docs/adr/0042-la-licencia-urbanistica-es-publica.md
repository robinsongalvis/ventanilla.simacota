# ADR-0042 — La licencia urbanística es pública: la reserva de identidad no aplica en Planeación

- **Estado:** ACEPTADO — decidido por el propietario el 1-sep-2026.
- **Excepción declarada a:** ADR-0006 (enmascaramiento de identidad reservada),
  que hasta hoy se declaraba **transversal** a todas las vistas internas.
- **Relacionado:** ADR-0012 / R9 (anti-inferencia en la búsqueda), ADR-0034
  (ventanilla ve el estado), issue #320.

## 1. La decisión

> **En el módulo de Licencias, el nombre y el documento del solicitante se
> muestran y se buscan en claro. La reserva de identidad no aplica.**

Palabras del propietario: *«la identidad reservada dentro de la Secretaría de
Planeación a través de la licencia de construcción no tiene que ser reservada;
todo es público, todo se ve quién viene»*.

El fundamento es del trámite, no del sistema: **una licencia urbanística exige
acreditar la titularidad del predio**, el acto que la concede identifica al
titular, y queda en el expediente público del inmueble. Un permiso de obra
anónimo no tiene figura jurídica.

## 2. Por qué esto necesita estar escrito

Porque hasta hoy **no era una decisión: era un olvido**. El módulo de Licencias
copia el nombre y el documento del radicado sin mirar los marcadores de reserva
(`lib/server/expedientes-licencias.ts:1093-1094`), los muestra en claro en la
bandeja y la cabecera, y los deja buscables en el Libro — que es la única
superficie de búsqueda del sistema **sin guarda de identidad**.

Se descubrió el 1-sep-2026 al unificar el predicado de búsqueda (PR #319):
comparando las guardas de las tres implementaciones apareció una cuarta
superficie que no tenía ninguna.

Sin este ADR, el próximo que lo encuentre lo reportará otra vez como defecto —
o peor, lo «arreglará» rompiendo una decisión deliberada.

## 3. El alcance, medido

La excepción está **contenida en Planeación**, y eso se verificó:

- La proyección hacia ventanilla (`lib/server/proyeccion-ventanilla.ts`) **no
  expone el nombre ni el documento** — solo número, estado, fechas y plazo. La
  identidad no cruza a otra dependencia.
- El aislamiento por `tenantId` sigue gobernando quién ve el expediente.
- El resto del sistema **no cambia**: en PQRSD, ventanilla, el Tablero, la
  búsqueda avanzada y el oficio al ciudadano, la reserva se sigue respetando
  exactamente igual (ADR-0006 y ADR-0012 intactos fuera de licencias).

## 4. El caso que esta excepción NO bendice

Un radicado con reserva que **no es una solicitud de licencia** —por ejemplo la
denuncia de una obra irregular, presentada con reserva justamente para
protegerse— no debería convertirse en expediente de licencias. Si eso ocurre,
la identidad del denunciante quedaría visible en Planeación.

Eso es un **error operativo**, no un caso de diseño: quien crea el expediente
está clasificando mal. Esta excepción cubre al **solicitante de una licencia**,
que se identifica por necesidad del trámite; no convierte en pública la
identidad de quien pidió reserva para otra cosa.

Queda anotado como riesgo operativo. Si alguna vez se materializa, la respuesta
es un aviso en el momento de crear el expediente desde un radicado reservado —
no retirar esta decisión.

## 5. Consecuencias

- El issue #320 se cierra **como decidido**, no como corregido.
- No se construye enmascaramiento en Licencias, ni guarda de identidad en el
  Libro consecutivo.
- El sitio del código donde se copian nombre y documento lleva un comentario
  que apunta aquí, para que no vuelva a leerse como descuido.
- Si Jurídica llegara a sostener lo contrario, este ADR se revisa con su
  concepto **escrito** — el mismo estándar que se aplicó a la contradicción
  sobre subsanación (RN-5).
