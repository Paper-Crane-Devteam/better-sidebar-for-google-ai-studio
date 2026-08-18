# 🤖 v2.9.0 — El Agent ha llegado

¿Recuerdas lo que prometí en v2.8.0? *"El Agent todavía está en el horno."* Bueno, sonó el temporizador. 🔔

Dos meses y medio. Mucho café. Un motor reescrito más veces de las que me gustaría admitir. **El AI Agent está oficialmente en vivo.**

Quiero que entiendas algo sobre esta versión: las demás extensiones de sidebar te dan *botones* — haces clic, pasa una cosa. Esta te da un **operador**. Le describes lo que quieres en lenguaje natural, y la IA va y lo hace de verdad — lee tus datos, toma decisiones, ejecuta trabajo de varios pasos y te reporta el resultado. Todo dentro de tu navegador, usando tu propia sesión de Gemini. Sin API keys, sin tokens extra, sin datos saliendo de tu máquina.

## 🚀 Lo principal: AI Agent

Escribe `>` en el cuadro de entrada de Gemini. Eso es todo.

Aparece una lista: elige un **Skill**, o selecciona la primera opción y deja que la IA decida cuál usar. Luego describe tu tarea como se la describirías a un colega competente, y mira cómo trabaja.

**Vienen varios Skills incluidos para empezar:**

*   **🗂️ Auto-Organizar:** "Ordena mis últimos 200 chats en carpetas y ponles etiquetas." Lee los títulos, arma una taxonomía, crea las carpetas y mueve todo. Seis meses de caos sin nombre, resueltos de una pasada.
*   **🔄 Rellenar tu índice de búsqueda:** Algo que probablemente no sabías: los mensajes de una conversación solo se graban mientras la tienes abierta. Todos los chats que tuviste *antes* de instalar la extensión están en la base de datos solo como un título sin contenido — por eso la búsqueda de texto completo a veces no encuentra nada. Este skill encuentra esas conversaciones vacías y sincroniza el contenido real. Si después de sincronizar alguna sigue vacía, significa que ya no existe en Google — es una entrada fantasma. Dile al Agent que la borre.
*   **📊 Consultar tus propios datos:** Pregunta cosas sobre tu historial de conversaciones como si fuera una base de datos — porque lo es. "¿Qué carpeta tuvo más chats el mes pasado?" Te lo dice.
*   **📝 Gestionar Prompts y Snippets:** Reescribir, reorganizar, deduplicar y reestructurar tu biblioteca de Prompts y Snippets en lote. Convierte un desorden en una biblioteca real.
*   **🛠️ Escribe tus propios Skills:** Ve a **Ajustes → Agent** y define Skills personalizados con tus propias instrucciones. Si puedes describir un flujo de trabajo repetible, puedes enseñárselo al Agent — y se convierte en una tarjeta permanente de un clic.

### 🔓 Pero no te quedes con esa lista

Esos Skills son **presets, no límites**. Quiero ser muy claro con esto, porque es todo el punto.

Por debajo, el Agent tiene acceso real de consulta a la base de datos de la extensión — cada conversación, mensaje, carpeta, etiqueta, prompt y snippet, todo consultable. No elige de un menú de cinco acciones fijas. Escribe sus propias consultas contra tus datos reales, mira los resultados y decide qué hacer después. La respuesta real a "¿qué puede hacer?" es: **lo que puedas describir sobre tus propios datos.**

Así que la mejor forma de encontrar el techo es ir a buscarlo:

*   Escribe `>` y **pregúntale**. "¿Qué puedes hacer con mis datos?" "¿Qué tengo desordenado que no he notado?" Sabe qué tablas ve y qué herramientas tiene, deja que te convenza.
*   **Háblale como a un colega, no como a un buscador.** Es una conversación real de varias rondas — te reporta, tú pides más. "Interesante, desglósalo por mes." "Ahora haz lo mismo con los que marqué con estrella." "Mejor fusiona esas dos carpetas." Cada ronda tiene el contexto de la anterior.
*   Pregúntale cosas que ninguna función que yo pudiera diseñar cubriría: "¿A qué temas vuelvo una y otra vez?" "Encuentra los chats sobre el bug de auth de marzo y ponlos en una carpeta." "¿Cuáles de mis prompts no he usado nunca?" "Resume en qué trabajé el trimestre pasado."

Honestamente, los usos más creativos van a ser los que yo nunca imaginé. Ve a explorar y cuéntame qué descubres.

**La parte de seguridad, de la que estoy orgulloso:**

*   **🛑 Siempre decides tú.** Todo lo que *escribe* en tus datos pide permiso primero. Las lecturas van libres. Tú defines la política y puedes cambiarla por sesión.
*   **⚡ Modo Velocidad** si confías en él. Un toggle y deja de preguntar. (Con deshacer, no soy un monstruo.)
*   **🎛️ El Agent Dock** vive justo encima de tu caja de entrada — te sigue incluso con la sidebar cerrada. Estado, botón de parar, aprobaciones, todo en un sitio.
*   **🔌 Circuit breakers por todas partes.** Si entra en bucle, se repite o deja de avanzar, el motor mata la ejecución y te dice por qué. También hace check-in contigo después de ratos largos sin atención, en vez de moler en silencio.

**💚 Si compraste el Powerpack al precio Early Bird — esto es tuyo, gratis, ahora mismo.** Apostaste cuando todavía no existía. Gracias. Ve a escribir `>` y mira lo que compraste.

## ✨ También en esta versión

*   **⚡ Integración con Gemini Spark:** Si Google activó Spark en tu cuenta, aparece como una pestaña nativa en la sidebar. Nada que configurar — si lo tienes, está ahí.
*   **🎨 Interfaz más limpia y tranquila:** Repasé toda la UI y bajé el ruido. Ritmo de espaciado más ajustado, mejor contraste, temas refinados. Se siente menos cargada. Además, una **transición animada al cambiar de tema**, porque los detalles importan.
*   **🎛️ Clic en el icono de la extensión para ajustes:** El icono de la barra de herramientas ahora abre un panel de control real — activa/desactiva plataformas y funciones sin navegar menús.
*   **⌨️ Slash commands en AI Studio:** El atajo `/` para la Biblioteca de Prompts era solo de Gemini. Ahora AI Studio también lo tiene.
*   **💾 Backups locales automáticos:** Los datos de la extensión se respaldan automáticamente según un horario — y puedes disparar un snapshot manual en cualquier momento. Si algo sale mal, puedes volver atrás. Tranquilidad, por fin.
*   **📜 Smart Scrollbar expandible:** Clic para expandir la barra en una lista completa de mensajes. Las conversaciones largas por fin son navegables.
*   **📁 Crear carpetas sin salir del diálogo:** El diálogo "Mover a carpeta" ahora tiene un botón **Nueva Carpeta**. Poca cosa, pero soluciona un callejón sin salida molesto de verdad.

## 🐛 Correcciones — Y una importante

*   **☁️ La sincronización con Google Drive ya no se come tus datos.** Esta es la grande, y quiero ser directo: la vieja lógica de auto-merge podía sobrescribir datos locales de mala manera. **Se fue.** Drive nunca más sobrescribirá ni hará merge en tus datos locales de forma silenciosa — restaurar es ahora una descarga manual que tú inicias. Las subidas siguen siendo automáticas si tienes la sincronización activada. Tus datos locales son la fuente de verdad, punto.
*   **🔍 Escaneo de conversaciones Gemini arreglado.** Vuelve a funcionar de forma fiable.
*   **😴 No más "despertar muerto".** Si dejaste una pestaña abierta horas y volviste a una sidebar zombie — arreglado. Se reconecta correctamente.
*   **📐 La página de Gemini ya no salta hacia arriba aleatoriamente.** Ese salto intermitente de layout desapareció.
*   **⌨️ Los espacios ya no cancelan el renombrado.** Escribir un espacio al renombrar ya no te saca del modo edición.
*   **🕒 Timestamps correctos.** La fecha de creación y última actividad ahora se muestran con precisión.
*   **💎 Gems y Notebooks detectados al crearlos.** Aparecen inmediatamente sin necesidad del ritual de recargar.
*   **⚪ No más puntos grises muertos.** Arreglado el Smart Scrollbar renderizando ocasionalmente puntos que no se podían clicar.

***

Esta versión tardó lo suyo, y es lo más grande que he construido para esta extensión. El Agent no es un demo — es el motor sobre el que voy a construir las próximas versiones, y va a mejorar rápido.

Así que por favor: ve a romperlo. Apúntalo a tu carpeta más desordenada. Escribe un Skill raro. Y luego cuéntame qué pasó — Discord, email, donde sea. Cada reporte de bugs de ustedes hizo esta versión mejor de lo que yo podría haber logrado solo.

Ahora ve a escribir `>` y déjalo cocinar. 🚀
