# 🤖 v2.9.0 — O AI Agent chegou

Após um período de desenvolvimento e atualizações arquitetônicas, temos o prazer de apresentar um recurso totalmente novo: **o AI Agent**. 🎉

Esperamos fornecer a você um **assistente inteligente** mais prático, em vez de apenas alguns botões de atalho. Você pode dizer o que precisa em linguagem natural, e ele tentará pesquisar em seus dados, analisá-los, executar as etapas e relatar a você. Tudo isso funciona inteiramente local no seu navegador usando a sua sessão atual do Gemini. Não são necessárias chaves de API, não são consumidos tokens extras e seus dados nunca saem do seu dispositivo, garantindo privacidade e segurança.

## 🚀 Atualização Principal: AI Agent

Basta digitar `>` na caixa de entrada do Gemini para chamá-lo.

Uma lista aparecerá onde você pode selecionar uma **habilidade predefinida**, ou você pode optar por não fazer isso e simplesmente descrever naturalmente a sua solicitação, deixando a IA determinar como executá-la.

**Preparamos as seguintes habilidades básicas para você experimentar:**

*   **🗂️ Auto-Organizar:** "Classifique minhas últimas 200 conversas em pastas e adicione tags." Ele analisará automaticamente os títulos, tentará a categorização, criará pastas e moverá os itens, ajudando a organizar seus registros de bate-papo acumulados.
*   **🔄 Completar Índice de Pesquisa:** Você pode ter notado que a pesquisa de texto completo às vezes não encontra conversas mais antigas. Isso ocorre porque chats antigos de antes da instalação da extensão possuem apenas os títulos no banco de dados por padrão. Esta habilidade ajuda a encontrar esses chats "vazios" e sincroniza seus conteúdos automaticamente. Se permanecerem vazios após a sincronização, significa que não estão mais disponíveis na nuvem, e o Agent o ajudará a limpar esses dados inválidos.
*   **📊 Consulta de Dados:** "Qual pasta teve mais conversas no mês passado?" Basta perguntar, e ele consultará os dados locais para lhe dar uma resposta.
*   **📝 Gerenciar Prompts e Snippets em Lote:** Ele auxilia na reescrita, recategorização, desduplicação ou reorganização para ajudar a arrumar sua biblioteca.
*   **🛠️ Habilidades Personalizadas:** Em **Configurações → Agent**, você pode usar suas próprias instruções para definir novas habilidades. Se você tiver fluxos de trabalho repetitivos, pode tentar ensiná-los ao Agent para poder executá-los com um único clique posteriormente.

### 🔓 Explorando Mais Possibilidades

Além das habilidades predefinidas, o Agent pode consultar diretamente o banco de dados da extensão, incluindo conversas, mensagens, pastas, tags, Prompts e Snippets. Ele pode escrever consultas automaticamente com base em suas necessidades, analisar os resultados e decidir a próxima etapa. Desde que envolva seus dados locais e possa ser descrito claramente, você pode tentar pedir ajuda.

Você pode tentar estas abordagens:

*   Digite `>` e **simplesmente pergunte**: "O que você pode fazer com meus dados?" ou "Existem áreas no meu espaço de trabalho que precisam de organização?". Veja o que ele sugere.
*   **Interaja com ele como um assistente por meio de conversas em vários turnos.** Ele mantém o contexto. Por exemplo: "Interessante, divida isso por mês, por favor." "Faça o mesmo com os chats marcados com estrela." "Na verdade, apenas junte essas duas pastas."
*   Tente solicitações para as quais não criamos predefinições: "Sobre quais tópicos eu mais falo?" "Encontre conversas sobre o bug de autenticação de março e agrupe-as." "Quais dos meus Prompts eu nunca usei?"
*   Se descobrir casos de uso interessantes, sinta-se à vontade para compartilhá-los conosco.

**Com Relação a Segurança e Controle:**

*   **🛑 Você decide.** Por padrão, qualquer ação que modifique dados pedirá sua confirmação primeiro, enquanto as operações de leitura podem ser executadas diretamente. Você pode ajustar essas políticas nas configurações a qualquer momento.
*   **⚡ Modo Extremo.** Se você estiver familiarizado e confiar nas operações, pode habilitar o Modo Extremo para que ele pare de pedir confirmação. (Todas as ações ainda podem ser desfeitas.)
*   **🎛️ Agent Dock.** A barra de status é fixada acima da caixa de entrada, para que você possa ver o progresso atual mesmo quando a barra lateral estiver fechada. Status, botões de parada e aprovações são claramente visíveis.
*   **🔌 Disjuntor Inteligente.** Se o Agent ficar preso em um loop ou progredir lentamente, o motor será interrompido automaticamente e o notificará sobre o motivo. Se for executado por muito tempo, ele pausará e solicitará sua opinião em vez de ser executado infinitamente em segundo plano.

**💚 Para todos os primeiros usuários do Powerpack — este recurso agora está desbloqueado para vocês gratuitamente.** Obrigado por sua confiança e apoio contínuos.

## ✨ Mais Melhorias

*   **⚡ Integração com Gemini Spark:** Se o Google habilitou o Spark em sua conta, a barra lateral exibirá automaticamente uma aba Spark.
*   **🎨 Atualização Visual:** A interface geral foi reajustada — o espaçamento está mais compacto e o contraste mais confortável. Também adicionamos animações de transição ao alternar temas, esperando proporcionar uma melhor experiência visual.
*   **🎛️ Acesso Rápido às Configurações:** Clicar no ícone da extensão na barra de ferramentas do navegador agora abre um painel de controle para alternar rapidamente entre plataformas ou recursos.
*   **⌨️ Suporte a `/` no AI Studio:** O atalho `/` para chamar a biblioteca de Prompts antes era limitado ao Gemini; agora também pode ser usado no AI Studio.
*   **💾 Backups Locais Automáticos:** Os dados da extensão agora oferecem suporte a backups automáticos agendados, e você pode criar instantâneos manuais a qualquer momento para melhorar a segurança dos dados.
*   **📜 Melhorias no Smart Scrollbar:** Clicar na barra de rolagem inteligente (Smart Scrollbar) a expande em uma lista de mensagens para facilitar a navegação em conversas longas.
*   **📁 Botão de Nova Pasta:** Adicionado um botão para criar novas pastas diretamente na janela modal "Mover para a pasta".

## 🐛 Correções de Bugs

*   **☁️ Lógica de Sincronização do Google Drive:** Melhoramos a lógica de mesclagem automática anterior. O Drive não sobrescreverá mais ou mesclará automaticamente em seus dados locais. Para restaurar os dados, você deve iniciar um download manualmente. Os uploads permanecem automáticos (se a sincronização estiver ativada). Isso garante que seus dados locais sejam sempre sua fonte de verdade mais confiável.
*   **🔍 Verificação de Conversas do Gemini:** Corrigido um problema em que a verificação da lista de conversas falhava ocasionalmente.
*   **😴 Problema de Desconexão por Inatividade:** Corrigido um problema em que a barra lateral deixava de responder depois que a guia era deixada inativa por muito tempo. Agora ela pode se reconectar normalmente.
*   **📐 Pulos na Página:** Resolvido o tremor de layout ocasional na interface do Gemini.
*   **⌨️ Saída ao Renomear com Espaço:** Digitar um espaço ao renomear não sairá mais acidentalmente do modo de edição.
*   **🕒 Erros na Exibição de Tempo:** Os horários de criação das conversas e os últimos momentos ativos agora são exibidos corretamente.
*   **💎 Detecção em Tempo Real de Gem/Notebook:** Novos Gems ou Notebooks agora são detectados instantaneamente pela extensão após a criação.
*   **⚪ Pixel Morto Cinza:** Corrigido um ponto não clicável que ocasionalmente aparecia no Smart Scrollbar.

***

Esta versão é uma atualização significativa para nós recentemente, e o motor do Agent continuará sendo refinado em versões futuras.

Se você estiver interessado, pode digitar `>` para abrir o painel e experimentar este novo recurso por conta própria. Se você encontrar algum problema ou tiver sugestões de melhoria, sinta-se à vontade para nos avisar pelo Discord ou por e-mail.
