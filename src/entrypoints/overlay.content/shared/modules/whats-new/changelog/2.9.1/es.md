# ✨ v2.9.1 — Carpetas predeterminadas y barra de herramientas de selección

Esta es una versión de iteración rápida basada directamente en sus comentarios. Gracias a todos los que aportaron sugerencias. 🙏

## ✨ Nuevas funciones

*   **📁 Carpetas predeterminadas para Gems y Notebooks:** Ahora puedes asignar una carpeta predeterminada a cualquier Gem o Notebook. Cuando inicies una nueva conversación utilizando ese ajuste preestablecido, se ubicará automáticamente en la carpeta asignada, ahorrándote el tener que moverla manualmente más tarde.
*   **⚡ Gestionar asociaciones predeterminadas desde las carpetas:** El panel de configuración de la carpeta ahora enumera todos los Gems y Notebooks que la usan como su carpeta predeterminada, lo que te permite vincularlos o desvincularlos directamente. Además, cuando una carpeta se establece como predeterminada, se agrega un botón de acceso directo a su barra de acción emergente, lo que te permite crear una conversación relacionada con un solo clic.
*   **🗑️ Opcional: Omitir la confirmación de eliminación:** Esta función está deshabilitada de forma predeterminada. Una vez habilitada en "Configuración → General", eliminar una sola conversación omitirá el cuadro de diálogo de confirmación. Ten en cuenta: esta acción es inmediata, permanente y no se puede deshacer; eliminará los datos tanto de la extensión como de la plataforma en la nube. Las eliminaciones masivas seguirán solicitando confirmación.
*   **🖍️ Barra de herramientas de selección de texto:** Al resaltar texto en una conversación, aparecerá una barra de herramientas compacta sobre él. Puedes pedirle a la IA que explique o resuma la selección, guardarla como un Snippet (fragmento) o simplemente copiarla. Puedes personalizar qué acciones se muestran o deshabilitar la barra de herramientas por completo en la configuración.

## 🐛 Correcciones de errores

*   **⚪ Limpieza de puntos grises no válidos en chats históricos:** En la versión 2.9.0, optimizamos la representación de nuevas conversaciones para evitar que quedaran puntos de registro no válidos. Para garantizar la seguridad absoluta de tus datos históricos, ahora proporcionamos un método de limpieza seguro: cuando existen registros residuales en una conversación, aparecerá un botón de limpieza en la parte superior del Smart Scrollbar (barra de desplazamiento inteligente). Después de hacer clic y confirmar, el sistema solo eliminará los registros no válidos y no referenciados sin afectar ningún historial normal. Si se detectan anomalías en los datos, la operación de limpieza se cancelará automáticamente.
*   **⋯ Se solucionó la desalineación del menú nativo de Gemini:** Se solucionó un problema en el que los conflictos de CSS de la extensión causaban que el menú nativo "Más acciones" de Google estuviera desalineado.
*   **📂 Se solucionaron los problemas de visualización con nombres de carpeta largos:** Se solucionó un problema en el que los nombres de carpeta largos se superponían con los botones de acción emergentes. Los nombres excesivamente largos ahora se truncan y ocultan correctamente.
*   **📝 Se solucionó la pérdida de formato Markdown en los Snippets:** Se solucionó un problema en el que se perdía el formato del texto al guardar un Snippet. Todo el formato Markdown, incluidos los encabezados, las listas y los bloques de código, ahora se conserva por completo.

***

Gracias por tu continuo apoyo y comentarios. Seguiremos escuchando tus sugerencias para optimizar la experiencia de la extensión.
