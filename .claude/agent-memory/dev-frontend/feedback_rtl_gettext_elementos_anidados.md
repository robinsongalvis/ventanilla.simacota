---
name: feedback-rtl-gettext-elementos-anidados
description: Testing Library getByText no concatena el texto de elementos hijos anidados (ej. <strong> dentro de un <span>) — solo une nodos de texto DIRECTOS del elemento consultado
metadata:
  type: feedback
---

`screen.getByText(regex-o-string)` de `@testing-library/dom` internamente
usa `getNodeText(node)`, que concatena SOLO los `childNodes` de tipo texto
(`nodeType === 3`) DIRECTOS del elemento — cualquier texto dentro de un
elemento hijo anidado (`<strong>`, `<em>`, un `<span>` interno, etc.) se
IGNORA para ese nodo padre. Un mensaje como
`Faltan <strong>{n}</strong> hechos` NO es encontrable con
`getByText(/Faltan \d+ hechos/)`: el número queda "invisible" para el
matcher del contenedor porque vive en un nodo de texto de otro elemento,
no uno directo del `<span>` consultado.

**Por qué:** lo descubrí escribiendo
`__tests__/panel-hechos-caso-render.test.tsx` (11-ago-2026, Bloque A3 —
ver [[project_bloque_a3_checklist_documentos]]): el aviso de "Faltan N
hechos del caso" envolvía el número en `<strong>` por énfasis visual, y el
test fallaba con "Unable to find an element with the text" aunque el
número SÍ estaba renderizado y visible en el DOM volcado por el propio
error de RTL — la falla no era de la UI sino de cómo Testing Library
recorre el árbol.

**Cómo aplicar:** si un texto que se va a verificar con `getByText`
necesita interpolar una parte con estilo distinto (negrita, color), o (a)
evaluar todo el mensaje como un solo string plano (una interpolación de
template literal dentro de un único nodo de texto, sin sub-elementos) si
el énfasis visual no es esencial, o (b) si el énfasis SÍ es necesario,
testear con un matcher a nivel del contenedor que use `node.textContent`
completo (p. ej. una función custom `(content, element) =>
element.textContent === '...'`) en vez de confiar en el matcher por
defecto. Ante la duda, preferir (a): más simple y evita que un cambio de
estilo futuro rompa el test.
