# ✨ v2.9.1 — Pastas padrão e Barra de seleção

Este é um lançamento de iteração rápida com base direta no seu feedback. Obrigado a todos que enviaram sugestões. 🙏

## ✨ Novos Recursos

*   **📁 Pastas Padrão para Gems e Notebooks:** Agora você pode atribuir uma pasta padrão a qualquer Gem ou Notebook. Ao iniciar uma nova conversa usando essa predefinição, ela será automaticamente colocada na pasta atribuída, evitando que você precise movê-la manualmente depois.
*   **⚡ Gerenciar Associações Padrão a partir das Pastas:** O painel de configurações da pasta agora lista todos os Gems e Notebooks que a utilizam como pasta padrão, permitindo que você os vincule ou desvincule diretamente. Além disso, quando uma pasta é definida como padrão, um botão de atalho é adicionado à sua barra de ação, permitindo que você crie uma conversa relacionada com um único clique.
*   **🗑️ Opcional: Ignorar a Confirmação de Exclusão:** Este recurso é desativado por padrão. Uma vez ativado em "Configurações → Geral", excluir uma única conversa pulará a caixa de diálogo de confirmação. Observação: esta ação é imediata, permanente e não pode ser desfeita; ela excluirá os dados da extensão e da plataforma em nuvem. As exclusões em massa ainda solicitarão confirmação.
*   **🖍️ Barra de Ferramentas de Seleção de Texto:** Ao destacar um texto em uma conversa, uma barra de ferramentas compacta aparecerá sobre ele. Você pode pedir à IA que explique ou resuma a seleção, salvá-la como um Snippet ou simplesmente copiá-la. Você pode personalizar quais ações são exibidas ou desativar a barra de ferramentas totalmente nas configurações.

## 🐛 Correções de Bugs

*   **⚪ Limpeza de Pontos Cinzas Inválidos no Histórico de Chats:** Na v2.9.0, otimizamos a renderização de novas conversas para evitar que sobrassem pontos de registro inválidos. Para garantir a segurança absoluta de seus dados históricos, agora fornecemos um método de limpeza seguro: quando existirem registros residuais em uma conversa, um botão de limpeza aparecerá na parte superior da Smart Scrollbar (barra de rolagem inteligente). Após você clicar e confirmar, o sistema excluirá apenas os registros inválidos não referenciados sem afetar o histórico normal. Se forem detectadas anomalias nos dados, a operação de limpeza será abortada automaticamente.
*   **⋯ Correção de Desalinhamento do Menu Nativo do Gemini:** Corrigido um problema em que conflitos de CSS da extensão faziam com que o menu "Mais ações" nativo do Google ficasse desalinhado.
*   **📂 Correção de Problemas de Exibição com Nomes de Pasta Longos:** Corrigido um problema em que nomes de pasta longos se sobrepunham aos botões de ação na seleção. Nomes muito longos agora são truncados e ocultos adequadamente.
*   **📝 Correção da Perda de Formatação Markdown nos Snippets:** Corrigido um problema em que a formatação de texto era perdida ao salvar um Snippet. Toda a formatação Markdown, incluindo cabeçalhos, listas e blocos de código, agora é totalmente preservada.

***

Obrigado por seu apoio contínuo e feedback. Continuaremos ouvindo suas sugestões para otimizar a experiência da extensão.
