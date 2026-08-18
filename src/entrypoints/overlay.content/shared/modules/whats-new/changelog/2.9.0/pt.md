# 🤖 v2.9.0 — O Agent chegou

Lembram do que eu prometi na v2.8.0? *"O Agent ainda está no forno."* Pois é, o timer disparou. 🔔

Dois meses e meio. Muito café. Um motor reescrito mais vezes do que eu gostaria de admitir publicamente. **O AI Agent está oficialmente no ar.**

O que preciso que vocês entendam sobre essa versão: as outras extensões de sidebar dão *botões* — clica, faz uma coisa. Essa aqui dá um **operador**. Você descreve o que quer em linguagem natural e a IA vai lá e faz — lê seus dados, toma decisões, executa trabalho multi-etapa e volta com o relatório. Tudo no seu próprio navegador, usando sua própria sessão do Gemini. Sem API key, sem tokens extras, sem dados saindo da sua máquina.

## 🚀 O destaque: AI Agent

Digite `>` na caixa de entrada do Gemini. Só isso. Essa é toda a interface.

Aparece uma lista: escolha uma **Skill** ou selecione a primeira opção e deixe a IA decidir. Depois descreva sua tarefa como descreveria para um colega competente e assista.

**Já vem com algumas Skills para você começar:**

*   **🗂️ Auto-Organizar:** "Organize meus últimos 200 chats em pastas e coloque tags." Lê os títulos, monta uma taxonomia, cria as pastas, move tudo. Seis meses de caos acumulado, resolvido em uma passada.
*   **🔄 Preencher o índice de busca:** Algo que você provavelmente não sabia: as mensagens de uma conversa só são gravadas enquanto ela está aberta. Todos os chats que você teve *antes* de instalar a extensão estão no banco só como título sem conteúdo — por isso a busca full-text às vezes não encontra nada. Essa skill encontra conversas vazias e sincroniza o conteúdo real. Se depois de sincronizar ainda estiver vazia, é porque não existe mais no Google — entrada fantasma. Manda o Agent apagar.
*   **📊 Consultar seus próprios dados:** Faça perguntas sobre seu histórico de conversas como se fosse um banco de dados — porque é. "Qual pasta teve mais chats mês passado?" Ele responde.
*   **📝 Gerenciar Prompts e Snippets em lote:** Reescrever, reorganizar, deduplicar e reestruturar sua biblioteca. Transformar uma bagunça em algo utilizável.
*   **🛠️ Escreva suas próprias Skills:** Vá em **Configurações → Agent** e defina Skills personalizadas com suas instruções. Se você consegue descrever um fluxo repetível, pode ensinar ao Agent — e vira um card permanente de um clique.

### 🔓 Mas não ache que é só isso

Essas Skills são **presets, não limites**. Preciso ser muito claro nisso, porque esse é o ponto todo.

Por baixo, o Agent tem acesso real de consulta ao banco de dados da extensão — cada conversa, mensagem, pasta, tag, prompt e snippet, tudo consultável. Ele não escolhe de um menu de cinco ações fixas. Ele escreve suas próprias queries contra seus dados reais, olha o resultado e decide o próximo passo. A resposta real para "o que ele pode fazer?" é: **qualquer coisa que você consiga descrever sobre seus próprios dados.**

Como encontrar o teto:

*   Digite `>` e **pergunte direto**. "O que você pode fazer com meus dados?" "O que está bagunçado aqui que eu não percebi?" Ele sabe que tabelas vê e que ferramentas tem — deixe ele te vender.
*   **Converse como com um colega, não como com uma caixa de busca.** É uma conversa real de vários turnos — ele reporta, você pede mais. "Interessante, quebra por mês." "Faz o mesmo com os que eu marquei com estrela." "Na verdade, junta essas duas pastas." Cada rodada já tem o contexto da anterior.
*   Pergunte coisas que nenhuma feature que eu pudesse criar cobriria: "Que assuntos eu fico voltando?" "Acha os chats sobre o bug de auth de março e junta numa pasta." "Quais dos meus prompts eu nunca usei?" "Resume no que eu trabalhei no trimestre passado."

Honestamente, os usos mais criativos vão ser os que eu nunca imaginei. Vai lá explorar e me conta o que descobriu.

**A parte de segurança, da qual me orgulho:**

*   **🛑 Você sempre decide.** Qualquer coisa que *escreve* nos seus dados pede aprovação primeiro. Leituras são livres. Política é você quem define e pode mudar por sessão.
*   **⚡ Modo Velocidade** se você confia. Um toggle e ele para de perguntar. (Com undo, não sou um monstro.)
*   **🎛️ Agent Dock** fica logo acima da caixa de entrada — te acompanha mesmo com a sidebar fechada. Status, botão stop, aprovações, tudo num lugar só.
*   **🔌 Circuit breakers por todo lado.** Se entrar em loop, repetir ou parar de progredir, o motor mata a execução e explica por quê. Também faz check-in com você após períodos longos sem supervisão, em vez de ficar rodando em silêncio.

**💚 Se você comprou o Powerpack no preço Early Bird — essa feature é sua de graça, agora.** Você apostou quando isso ainda não existia. Obrigado. Vai lá digitar `>` e ver pelo que pagou.

## ✨ Também nessa versão

*   **⚡ Integração Gemini Spark:** Se o Google já liberou Spark na sua conta, aparece como aba nativa na sidebar. Nada pra configurar — se tem, tá lá.
*   **🎨 Interface mais limpa e calma:** Passei por toda a UI e abaixei o ruído. Ritmo de espaçamento mais justo, contraste melhor, temas refinados. Visualmente menos carregada. Mais uma **transição animada ao trocar de tema**, porque detalhezinhos importam.
*   **🎛️ Clique no ícone da extensão para configurações:** O ícone na barra de ferramentas agora abre um painel de controle real — liga/desliga plataformas e funcionalidades sem navegar menus.
*   **⌨️ Slash commands no AI Studio:** O atalho `/` para a Biblioteca de Prompts era só do Gemini. Agora AI Studio também tem.
*   **💾 Backups locais automáticos:** Os dados da extensão agora fazem backup automaticamente por cronograma — e você pode disparar um snapshot manual a qualquer hora. Se algo der errado, volta pra um estado anterior. Paz de espírito finalmente entregue.
*   **📜 Smart Scrollbar expansível:** Clique para expandir numa lista completa de mensagens. Conversas longas ficaram finalmente navegáveis.
*   **📁 Criar pastas sem sair do diálogo:** O diálogo "Mover para pasta" agora tem um botão **Nova Pasta**. Pequeno, mas resolve um beco sem saída genuinamente irritante.

## 🐛 Correções — E uma importante

*   **☁️ Sincronização com Google Drive não come mais seus dados.** A grande. Vou ser direto: a lógica antiga de auto-merge podia sobrescrever dados locais de forma ruim. **Foi removida.** O Drive nunca mais vai sobrescrever ou fazer merge nos seus dados locais silenciosamente — restaurar agora é um download manual que você inicia. Uploads continuam automáticos se a sincronia está ativa. Seus dados locais são a fonte da verdade, ponto final.
*   **🔍 Escaneamento de conversas Gemini corrigido.** Funciona de forma confiável de novo.
*   **😴 Não mais "acordar morto".** Deixou a aba aberta por horas e voltou com sidebar zumbi? Corrigido, reconecta direito agora.
*   **📐 Página do Gemini não pula mais pra cima aleatoriamente.** Aquele salto intermitente de layout sumiu.
*   **⌨️ Espaço não cancela mais o renomear.** Digitar espaço ao renomear não te joga fora do modo edição.
*   **🕒 Timestamps corretos.** Data de criação e última atividade agora exibem corretamente.
*   **💎 Gems e Notebooks detectados na criação.** Aparecem imediatamente sem o ritual de recarregar.
*   **⚪ Chega de pontos cinzas mortos.** Corrigido o Smart Scrollbar renderizando ocasionalmente pontos não-clicáveis.

***

Essa versão demorou, e é a maior coisa que construí pra essa extensão. O Agent não é demo — é o motor que vou empilhando nas próximas versões, e vai ficar afiado rápido.

Então por favor: vai quebrar. Aponta pro sua pasta mais bagunçada. Escreve uma Skill maluca. E me conta o que aconteceu — Discord, email, onde for. Cada report de bug de vocês fez essa versão melhor do que eu conseguiria sozinho.

Agora vai digitar `>` e deixa ele trabalhar. 🚀
