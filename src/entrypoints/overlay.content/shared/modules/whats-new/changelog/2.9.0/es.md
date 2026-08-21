# 🤖 v2.9.0 — El AI Agent está aquí

Después de un período de desarrollo y ajustes arquitectónicos, nos complace presentar una función completamente nueva: **el AI Agent (Agente de IA)**. 🎉

Esperamos brindarte un **asistente inteligente** más práctico, en lugar de solo unos pocos botones de acceso rápido. Puedes decirle lo que necesitas en lenguaje natural, y él intentará buscar en tus datos, analizarlos, ejecutar los pasos y reportarte. Todo esto se ejecuta completamente de forma local en tu navegador usando tu sesión actual de Gemini. No se requieren claves de API, no se consumen tokens adicionales y tus datos nunca salen de tu dispositivo, lo que garantiza la privacidad y la seguridad.

## 🚀 Actualización principal: AI Agent

Simplemente escribe `>` en el cuadro de entrada de Gemini para abrirlo.

Aparecerá una lista donde puedes seleccionar una **habilidad preestablecida**, o puedes optar por no hacerlo y simplemente describir naturalmente tu solicitud, dejando que la IA determine cómo ejecutarla.

**Hemos preparado las siguientes habilidades básicas para que las pruebes:**

*   **🗂️ Auto-Organizar:** "Clasifica mis últimas 200 conversaciones en carpetas y ponles etiquetas". Analizará automáticamente los títulos, intentará categorizarlos, creará carpetas y moverá los elementos, ayudándote a organizar los registros de chat atrasados.
*   **🔄 Completar índice de búsqueda:** Es posible que hayas notado que la búsqueda de texto completo a veces omite conversaciones anteriores. Esto se debe a que los chats antiguos, anteriores a la instalación de la extensión, solo tienen títulos en la base de datos de forma predeterminada. Esta habilidad ayuda a encontrar estos chats "vacíos" y sincroniza sus contenidos automáticamente. Si permanecen vacíos después de la sincronización, significa que ya no están disponibles en la nube, y el Agente te ayudará a limpiar estos datos no válidos.
*   **📊 Consulta de datos:** "¿Qué carpeta tuvo la mayor cantidad de conversaciones el mes pasado?" Solo pregunta, y consultará los datos locales para darte una respuesta.
*   **📝 Gestión por lotes de Prompts y Snippets:** Ayuda con la reescritura, recategorización, deduplicación o reorganización para ayudarte a ordenar tu biblioteca.
*   **🛠️ Habilidades personalizadas:** En **Configuración → Agent**, puedes usar tus propias instrucciones para definir nuevas habilidades. Si tienes flujos de trabajo repetitivos, puedes intentar enseñárselos al Agente para que puedas ejecutarlos con un solo clic más adelante.

### 🔓 Explorando más posibilidades

Además de las habilidades preestablecidas, el Agente puede consultar directamente la base de datos de la extensión, incluidas conversaciones, mensajes, carpetas, etiquetas, Prompts y Snippets. Puede escribir automáticamente consultas según tus necesidades, analizar los resultados y decidir el siguiente paso. Siempre que se trate de tus datos locales y pueda describirse claramente, puedes intentar pedirle ayuda.

Puedes intentar estos enfoques:

*   Escribe `>` y **simplemente pregúntale**: "¿Qué puedes hacer con mis datos?" o "¿Hay áreas en mi espacio de trabajo que necesiten organización?". Mira lo que sugiere.
*   **Interactúa con él como un asistente a través de conversaciones de múltiples turnos.** Mantiene el contexto. Por ejemplo: "Interesante, desglosa eso por mes, por favor". "Haz lo mismo para los chats destacados". "En realidad, simplemente fusiona esas dos carpetas".
*   Prueba solicitudes para las que no hemos creado preajustes: "¿De qué temas hablo más?" "Encuentra conversaciones sobre el error de autenticación de marzo y agrúpalas". "¿Cuáles de mis Prompts nunca he usado?"
*   Si descubres casos de uso interesantes, te invitamos a compartirlos con nosotros.

**Con respecto a la seguridad y el control:**

*   **🛑 Tú decides.** De forma predeterminada, cualquier acción que modifique los datos solicitará primero tu confirmación, mientras que las operaciones de lectura pueden ejecutarse directamente. Puedes ajustar estas políticas en la configuración en cualquier momento.
*   **⚡ Modo Extremo.** Si estás familiarizado y confías en sus operaciones, puedes habilitar el Modo Extremo para que deje de pedir confirmación. (Todas las acciones aún se pueden deshacer).
*   **🎛️ Agent Dock.** La barra de estado está fijada sobre el cuadro de entrada, por lo que puedes ver el progreso actual incluso cuando la barra lateral está cerrada. El estado, los botones de parada y las aprobaciones son claramente visibles.
*   **🔌 Cortacircuito inteligente.** Si el Agente se queda atascado en un bucle o progresa lentamente, el motor se interrumpirá automáticamente y te notificará el motivo. Si se ejecuta durante demasiado tiempo, se pausará y solicitará tu opinión en lugar de ejecutarse sin fin en segundo plano.

**💚 Para todos los primeros usuarios de Powerpack, esta función ahora está desbloqueada para ustedes de forma gratuita.** Gracias por tu continua confianza y apoyo.

## ✨ Más mejoras

*   **⚡ Integración con Gemini Spark:** Si Google ha habilitado Spark en tu cuenta, la barra lateral mostrará automáticamente una pestaña Spark.
*   **🎨 Actualización visual:** La interfaz general se ha reajustado: el espaciado es más compacto y el contraste es más cómodo. También agregamos animaciones de transición al cambiar de tema, con la esperanza de brindar una mejor experiencia visual.
*   **🎛️ Acceso rápido a la configuración:** Al hacer clic en el icono de la extensión en la barra de herramientas del navegador, ahora se abre un panel de control para cambiar rápidamente de plataforma o activar/desactivar funciones.
*   **⌨️ Soporte `/` en AI Studio:** El atajo `/` para abrir la biblioteca de Prompt estaba limitado anteriormente a Gemini; ahora también se puede usar en AI Studio.
*   **💾 Copias de seguridad locales automáticas:** Los datos de la extensión ahora admiten copias de seguridad automáticas programadas, y puedes crear instantáneas manuales en cualquier momento para mejorar la seguridad de los datos.
*   **📜 Mejoras en Smart Scrollbar:** Al hacer clic en la barra de desplazamiento inteligente, se expande a una lista de mensajes para facilitar la navegación en conversaciones largas.
*   **📁 Botón de nueva carpeta:** Se agregó un botón para crear nuevas carpetas directamente dentro del modal "Mover a la carpeta".

## 🐛 Correcciones de errores

*   **☁️ Lógica de sincronización de Google Drive:** Se mejoró la lógica de combinación automática anterior. Drive ya no sobrescribirá ni se combinará automáticamente con tus datos locales. Para restaurar datos, debes iniciar manualmente una descarga. Las cargas siguen siendo automáticas (si la sincronización está habilitada). Esto garantiza que tus datos locales sean siempre tu fuente de verdad más confiable.
*   **🔍 Escaneo de conversaciones de Gemini:** Se solucionó un problema por el cual el escaneo de la lista de conversaciones fallaba ocasionalmente.
*   **😴 Problema de desconexión por suspensión:** Se solucionó un problema por el cual la barra lateral dejaba de responder después de dejar la pestaña inactiva durante mucho tiempo. Ahora puede volver a conectarse normalmente.
*   **📐 Saltos de página:** Se resolvió la fluctuación ocasional del diseño en la interfaz de Gemini.
*   **⌨️ Salida al renombrar con barra espaciadora:** Escribir un espacio al cambiar el nombre ya no saldrá accidentalmente del modo de edición.
*   **🕒 Errores de visualización de tiempo:** Las horas de creación de conversaciones y las últimas horas activas ahora se muestran correctamente.
*   **💎 Detección en tiempo real de Gem/Notebook:** Los nuevos Gems o Notebooks ahora son detectados instantáneamente por la extensión después de la creación.
*   **⚪ Píxel muerto gris:** Se corrigió un punto en el que no se podía hacer clic que ocasionalmente aparecía en el Smart Scrollbar.

***

Esta versión es una actualización importante para nosotros recientemente, y el motor del Agente se seguirá perfeccionando en versiones futuras.

Si estás interesado, te invitamos a escribir `>` para abrir el panel y experimentar esta nueva función por ti mismo. Si encuentras algún problema o tienes sugerencias de mejora, no dudes en hacérnoslo saber a través de Discord o por correo electrónico.
