# ✨ v2.9.1 — Pastas predefinidas e barra de seleção

Uma atualização rápida depois da 2.9.0, construída quase inteiramente a partir dos vossos comentários. Obrigado pelos relatos. 🙏

## ✨ Novidades

*   **📁 Pasta predefinida para Gems e Notebooks:** Atribui uma pasta predefinida a qualquer Gem ou Notebook. Ao iniciar uma nova conversa a partir dele, a conversa vai automaticamente para essa pasta — sem precisares de arrastar depois.
*   **⚡ Gere as pastas padrão pelo lado da pasta:** As definições de pasta agora listam todos os Gems e Notebooks que a usam como destino padrão, para poderes ligá-los ou desligá-los ali mesmo. E quando uma pasta é o destino de algum, a linha ganha um botão extra ao passar o rato para começar essa conversa diretamente.
*   **🗑️ Opcional: apagar conversas sem confirmação:** Desligado por predefinição. Ativa em Definições → Geral e apagar uma conversa individual salta o diálogo por completo — imediato, permanente, sem desfazer, removido aqui e na plataforma. A eliminação em lote continua a pedir confirmação.
*   **🖍️ Barra de ferramentas ao selecionar texto:** Seleciona qualquer texto numa conversa e aparece uma pequena barra logo acima. Podes pedir à IA para explicar ou resumir a seleção, guardá-la como snippet ou copiá-la. Configurável nas definições — escolhe que ações aparecem ou desliga tudo.

## 🐛 Correções

*   **⚪ Os pontos cinzentos em conversas antigas já podem ser limpos.** A v2.9.0 impediu que novas conversas deixassem pontos inúteis atrás, mas os tópicos existentes mantiveram os seus. Na altura não fiz um script de limpeza porque não queria arriscar o histórico de ninguém. Esta é a versão segura: quando uma conversa tem registos residuais, aparece um botão de limpeza no topo da Smart Scrollbar. Um clique para armar, outro para confirmar, e está feito. Só remove registos que a própria conversa já não referencia, nunca toca em histórico que não tenha verificado, e recua totalmente se algo não bater certo.
*   **⋯ O menu nativo de 3 pontos do Gemini estava mal posicionado.** Tinhas razão, esta foi minha — parte do CSS da extensão estava a interferir com o menu de ações do próprio Google e a empurrá-lo para fora do lugar. Corrigido.
*   **📂 Botões de ação da pasta a misturar-se com nomes longos.** Antes, nomes de pasta longos transpareciam por baixo dos botões e ficava tudo confuso. Agora o nome é truncado de forma limpa por trás deles.
*   **📝 Snippets a perder a formatação Markdown.** Ao guardar um snippet, o texto ficava mas a formatação desaparecia. Já foi localizado e corrigido — títulos, listas, blocos de código e o resto sobrevivem ao guardar.

***

Versão pequena, resposta rápida. Continuem a enviar relatos — esta versão existe por causa deles.
