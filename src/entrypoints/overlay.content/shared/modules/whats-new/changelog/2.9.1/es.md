# ✨ v2.9.1 — Carpetas predeterminadas y barra de selección

Una actualización rápida después de la 2.9.0, construida casi por completo a partir de vuestros comentarios. Gracias por los reportes. 🙏

## ✨ Novedades

*   **📁 Carpeta predeterminada para Gems y Notebooks:** Asigna una carpeta predeterminada a cualquier Gem o Notebook. Al iniciar un chat nuevo desde ahí, la conversación va directamente a esa carpeta, sin tener que arrastrarla después.
*   **🖍️ Barra de herramientas al seleccionar texto:** Selecciona cualquier texto en una conversación y aparecerá una pequeña barra justo encima. Puedes pedirle a la IA que explique o resuma la selección, guardarla como snippet o copiarla. Configurable en los ajustes: elige qué acciones se muestran o desactívala por completo.

## 🐛 Correcciones

*   **⚪ Los puntos grises en conversaciones antiguas ya se pueden limpiar.** La v2.9.0 evitó que los chats nuevos dejaran puntos inservibles, pero los hilos existentes conservaban los suyos. No hice un script de limpieza entonces porque no quería arriesgar el historial de nadie. Esta es la versión segura: cuando una conversación tiene registros residuales, aparece un botón de limpieza en la parte superior de la Smart Scrollbar. Un clic para armarlo, otro para confirmar, listo. Solo elimina registros que la propia conversación ya no referencia, nunca toca historial que no haya verificado, y se detiene por completo si algo no cuadra.
*   **⋯ El menú nativo de 3 puntos de Gemini estaba mal posicionado.** Tenías razón, esto era culpa mía: parte del CSS de la extensión se filtraba al menú de acciones de Google y le movía la posición. Corregido.
*   **📂 Los botones de acción de carpeta se mezclaban con nombres largos.** Antes, los nombres de carpeta largos se transparentaban por debajo de los botones flotantes y quedaba todo ilegible. Ahora el nombre se recorta limpiamente detrás de ellos.
*   **📝 Los snippets perdían el formato Markdown.** Al guardar un snippet se conservaba el texto pero se perdía el formato. Localizado y corregido: los encabezados, las listas, los bloques de código y todo lo demás sobreviven al guardado.

***

Versión pequeña, respuesta rápida. Seguid enviando reportes: esta versión existe gracias a ellos.
