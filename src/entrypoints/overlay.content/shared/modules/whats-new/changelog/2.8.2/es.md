# 🔧 v2.8.2 — Correcciones y mejoras

Otro parche enfocado en estabilidad y pulido visual.

## 🐛 Correcciones

*   **Icono de Inbox no se actualizaba para usuarios existentes:** Se corrigió el problema donde el icono de inbox no se mostraba como el icono exclusivo para usuarios elegibles.
*   **Botón de autorización de Notion reaparecía:** El botón de autorización de Notion ya no se muestra repetidamente después de haber autorizado.
*   **Color de fondo anormal en la sección de filtros:** Se corrigió el color de fondo incorrecto en la sección de filtros.
*   **Estilo de favoritos faltante en la pestaña Prompt:** Se corrigió la ausencia del estilo de favoritos en la pestaña Prompt.

## 🎨 Mejoras

*   **Gestión centralizada de z-index:** Se unificó la jerarquía de capas en la aplicación — los popups, toasts, barras de desplazamiento y overlays ahora se apilan correctamente sin superposiciones inesperadas.
*   **Resaltado de texto en búsquedas:** Los resultados de búsqueda en Library, Prompt y otras pestañas ahora resaltan el texto coincidente para una exploración más fácil.
*   **Legibilidad de búsqueda de texto completo:** Se mejoró el formato y la legibilidad de los resultados de búsqueda de texto completo.
*   **Lógica de aviso de actualización de versión:** Se optimizó la lógica para mostrar las notificaciones de actualización de versión.

## 🗑️ Eliminado

*   **Quick Resend (Gemini):** Se eliminó la función de reenvío rápido en Gemini. Aún puedes regenerar respuestas usando el botón de actualización en las respuestas de la IA — esta función aportaba poco valor adicional.
