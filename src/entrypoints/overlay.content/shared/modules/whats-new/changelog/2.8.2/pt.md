# 🔧 v2.8.2 — Correções e melhorias

Mais uma atualização focada em estabilidade e polimento visual.

## 🐛 Correções

*   **Ícone do Inbox não atualizava para usuários existentes:** Corrigido o problema em que o ícone do inbox não exibia o ícone exclusivo para usuários elegíveis.
*   **Botão de autorização do Notion reaparecia:** O botão de autorização do Notion não aparece mais repetidamente após a autorização ter sido concluída.
*   **Cor de fundo anormal na seção de filtros:** Corrigida a cor de fundo incorreta na seção de filtros.
*   **Estilo de favoritos ausente na aba Prompt:** Corrigida a ausência do estilo de exibição de favoritos na aba Prompt.

## 🎨 Melhorias

*   **Gerenciamento centralizado de z-index:** Unificada a hierarquia de camadas do aplicativo — popups, toasts, barras de rolagem e overlays agora se empilham corretamente sem sobreposições inesperadas.
*   **Destaque de texto nas buscas:** Os resultados de busca nas abas Library, Prompt e outras agora destacam o texto correspondente para uma visualização mais fácil.
*   **Legibilidade da busca de texto completo:** Melhorada a formatação e legibilidade dos resultados de busca de texto completo.
*   **Lógica de aviso de atualização de versão:** Otimizada a lógica para exibir as notificações de atualização de versão.

## 🗑️ Removido

*   **Quick Resend (Gemini):** Removida a função de reenvio rápido no Gemini. Você ainda pode regenerar respostas usando o botão de atualização nas respostas da IA — esta função agregava pouco valor adicional.
