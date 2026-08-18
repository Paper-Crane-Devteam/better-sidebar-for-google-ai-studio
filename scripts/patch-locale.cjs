const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'locale');

// The 60 missing keys translated for each language
const patches = {
  es: {
    agent: {
      launcher: {
        newChatHint: "Se ejecuta en el chat que tienes abierto. Abre uno nuevo para mantenerlo limpio.",
        triggerHint: "Escribir > en el campo del chat también inicia el agente desde ahí."
      },
      dock: {
        speedOff: "Aprobando todo para esta tarea — haz clic para detenerlo",
        settings: "Lo que puede hacer",
        collapse: "Colapsar",
        expand: "Expandir"
      },
      tool: {
        waiting: "Esperándote",
        running: "Ejecutando",
        notRun: "No ejecutado",
        rejected: "Rechazado",
        rejectedTitle: "Rechazaste esta acción",
        done: "Listo",
        failed: "Falló",
        output: "Resultado",
        streaming: "Escribiendo...",
        streamDone: "Listo",
        viewResult: "Haz clic para ver el resultado completo",
        viewPrompt: "Haz clic para ver el prompt completo",
        systemPrompt: "Prompt del sistema",
        resultsTitle: "Resultados de herramientas",
        promptTitle: "Contenido del prompt"
      },
      overlay: {
        emptyTitle: "Vista del agente",
        emptyHint: "Escribe abajo o elige un prompt de agente para empezar",
        scrollToBottom: "Ir al final"
      },
      summary: {
        keepChanges: "Conservar cambios"
      },
      undo: {
        aiUnaware: "La IA no sabe de esto — díselo antes de continuar la conversación.",
        reverted: "Cambios revertidos",
        toastPrompt: "El agente modificó tus datos.",
        expired: "No queda nada que deshacer — se inició una nueva tarea o los cambios se conservaron."
      },
      settings: {
        newSkill: "Nueva habilidad",
        editSkill: "Editar habilidad",
        skillTitle: "Título",
        skillTitlePlaceholder: "p. ej. Organizar por tema",
        skillDescription: "Descripción",
        skillDescriptionPlaceholder: "Breve descripción de lo que hace esta habilidad",
        skillPrompt: "Contenido del prompt",
        skillPromptPlaceholder: "## Tarea: Nombre de tu tarea\n\nDescribe qué hace esta habilidad y cómo debe abordarla la IA.\n\nConsejos:\n- Empieza entendiendo el estado actual\n- Explica tu plan antes de ejecutar",
        titleRequired: "El título es obligatorio",
        descriptionRequired: "La descripción es obligatoria",
        promptRequired: "El contenido del prompt es obligatorio",
        discardTitle: "¿Descartar cambios sin guardar?",
        discardContent: "Se perderán tus ediciones a esta habilidad.",
        discard: "Descartar",
        deleteSkillTitle: "Eliminar habilidad",
        deleteSkillContent: "\"{{title}}\" se eliminará permanentemente. Esto no se puede deshacer.",
        alwaysOn: "Siempre activa"
      },
      skills: {
        autoClassify: {
          title: "Clasificar conversaciones automáticamente",
          description: "Organiza conversaciones en carpetas y etiquetas según sus títulos"
        },
        syncMessages: {
          title: "Sincronizar mensajes faltantes",
          description: "Busca conversaciones sin mensajes registrados y sincroniza su contenido"
        },
        export: {
          title: "Exportar conversaciones",
          description: "Consulta y muestra datos de conversaciones para el usuario"
        },
        managePrompts: {
          title: "Gestionar biblioteca de prompts",
          description: "Crea, refactoriza y organiza prompts reutilizables — incluyendo variables e importaciones"
        },
        manageSnippets: {
          title: "Gestionar snippets",
          description: "Organiza, deduplica y busca snippets guardados — incluyendo su texto completo"
        }
      },
      mcp: {
        builtin: {
          name: "Better Sidebar",
          description: "Herramientas principales para gestionar conversaciones, datos y tareas"
        }
      },
      entry: {
        autoTitle: "Agente Better Sidebar",
        autoDescription: "Describe una tarea y deja que el agente elija las herramientas adecuadas"
      }
    }
  },
  ja: {
    agent: {
      launcher: {
        newChatHint: "開いているチャットで実行されます。きれいに保つには新しいチャットを開いてください。",
        triggerHint: "チャット入力欄で > と入力してもエージェントを起動できます。"
      },
      dock: {
        speedOff: "このタスクではすべて自動承認中 — クリックで停止",
        settings: "できること",
        collapse: "折りたたむ",
        expand: "展開"
      },
      tool: {
        waiting: "あなたの操作を待っています",
        running: "実行中",
        notRun: "未実行",
        rejected: "拒否済み",
        rejectedTitle: "この操作を拒否しました",
        done: "完了",
        failed: "失敗",
        output: "出力",
        streaming: "書き出し中...",
        streamDone: "準備完了",
        viewResult: "クリックして結果を表示",
        viewPrompt: "クリックしてプロンプトを表示",
        systemPrompt: "システムプロンプト",
        resultsTitle: "ツール結果",
        promptTitle: "プロンプト内容"
      },
      overlay: {
        emptyTitle: "エージェントビュー",
        emptyHint: "下に入力するか、エージェントプロンプトを選んで開始",
        scrollToBottom: "一番下へ"
      },
      summary: {
        keepChanges: "変更を保持"
      },
      undo: {
        aiUnaware: "AIはこの操作を知りません — 会話を続ける前に伝えてください。",
        reverted: "変更を元に戻しました",
        toastPrompt: "エージェントがデータを変更しました。",
        expired: "元に戻すものがありません — 新しいタスクが開始されたか、変更が保持されました。"
      },
      settings: {
        newSkill: "新規スキル",
        editSkill: "スキルを編集",
        skillTitle: "タイトル",
        skillTitlePlaceholder: "例：トピック別に整理",
        skillDescription: "説明",
        skillDescriptionPlaceholder: "このスキルの機能を簡潔に説明",
        skillPrompt: "プロンプト内容",
        skillPromptPlaceholder: "## タスク: タスク名\n\nこのスキルの機能とAIのアプローチ方法を記述してください。\n\nヒント:\n- まず現在の状態を理解する\n- 実行前に計画を説明する",
        titleRequired: "タイトルは必須です",
        descriptionRequired: "説明は必須です",
        promptRequired: "プロンプト内容は必須です",
        discardTitle: "未保存の変更を破棄しますか？",
        discardContent: "このスキルへの編集内容が失われます。",
        discard: "破棄",
        deleteSkillTitle: "スキルを削除",
        deleteSkillContent: "「{{title}}」は完全に削除されます。この操作は元に戻せません。",
        alwaysOn: "常にオン"
      },
      skills: {
        autoClassify: {
          title: "会話を自動分類",
          description: "タイトルに基づいて会話をフォルダとタグに自動整理"
        },
        syncMessages: {
          title: "不足メッセージを同期",
          description: "メッセージが記録されていない会話を見つけて内容を同期"
        },
        export: {
          title: "会話をエクスポート",
          description: "ユーザー向けに会話データを検索・表示"
        },
        managePrompts: {
          title: "プロンプトライブラリを管理",
          description: "再利用可能なプロンプトの作成・リファクタリング・整理 — 変数やインポートを含む"
        },
        manageSnippets: {
          title: "スニペットを管理",
          description: "保存済みスニペットの整理・重複排除・検索 — 全文を含む"
        }
      },
      mcp: {
        builtin: {
          name: "Better Sidebar",
          description: "会話・データ・タスクを管理するコアツール"
        }
      },
      entry: {
        autoTitle: "Better Sidebar エージェント",
        autoDescription: "タスクを説明すると、エージェントが適切なツールを選びます"
      }
    }
  },
  pt: {
    agent: {
      launcher: {
        newChatHint: "Executa no chat que você tem aberto. Abra um novo para mantê-lo limpo.",
        triggerHint: "Digitar > no campo de entrada também inicia o agente de lá."
      },
      dock: {
        speedOff: "Aprovando tudo para esta tarefa — clique para parar",
        settings: "O que pode fazer",
        collapse: "Recolher",
        expand: "Expandir"
      },
      tool: {
        waiting: "Aguardando você",
        running: "Executando",
        notRun: "Não executado",
        rejected: "Rejeitado",
        rejectedTitle: "Você rejeitou esta ação",
        done: "Concluído",
        failed: "Falhou",
        output: "Resultado",
        streaming: "Escrevendo...",
        streamDone: "Pronto",
        viewResult: "Clique para ver o resultado completo",
        viewPrompt: "Clique para ver o prompt completo",
        systemPrompt: "Prompt do sistema",
        resultsTitle: "Resultados das ferramentas",
        promptTitle: "Conteúdo do prompt"
      },
      overlay: {
        emptyTitle: "Visão do agente",
        emptyHint: "Digite abaixo ou escolha um prompt de agente para começar",
        scrollToBottom: "Voltar ao final"
      },
      summary: {
        keepChanges: "Manter alterações"
      },
      undo: {
        aiUnaware: "A IA não sabe disso — avise antes de continuar a conversa.",
        reverted: "Alterações revertidas",
        toastPrompt: "O agente alterou seus dados.",
        expired: "Não há nada para desfazer — uma nova tarefa foi iniciada ou as alterações foram mantidas."
      },
      settings: {
        newSkill: "Nova habilidade",
        editSkill: "Editar habilidade",
        skillTitle: "Título",
        skillTitlePlaceholder: "ex: Organizar por tópico",
        skillDescription: "Descrição",
        skillDescriptionPlaceholder: "Breve descrição do que esta habilidade faz",
        skillPrompt: "Conteúdo do prompt",
        skillPromptPlaceholder: "## Tarefa: Nome da tarefa\n\nDescreva o que esta habilidade faz e como a IA deve abordá-la.\n\nDicas:\n- Comece entendendo o estado atual\n- Explique seu plano antes de executar",
        titleRequired: "O título é obrigatório",
        descriptionRequired: "A descrição é obrigatória",
        promptRequired: "O conteúdo do prompt é obrigatório",
        discardTitle: "Descartar alterações não salvas?",
        discardContent: "Suas edições nesta habilidade serão perdidas.",
        discard: "Descartar",
        deleteSkillTitle: "Excluir habilidade",
        deleteSkillContent: "\"{{title}}\" será removido permanentemente. Isso não pode ser desfeito.",
        alwaysOn: "Sempre ativa"
      },
      skills: {
        autoClassify: {
          title: "Classificar conversas automaticamente",
          description: "Organiza conversas em pastas e tags com base nos títulos"
        },
        syncMessages: {
          title: "Sincronizar mensagens faltantes",
          description: "Encontra conversas sem mensagens registradas e sincroniza seu conteúdo"
        },
        export: {
          title: "Exportar conversas",
          description: "Consulta e exibe dados de conversas para o usuário"
        },
        managePrompts: {
          title: "Gerenciar biblioteca de prompts",
          description: "Crie, refatore e organize prompts reutilizáveis — incluindo variáveis e importações"
        },
        manageSnippets: {
          title: "Gerenciar snippets",
          description: "Organize, remova duplicatas e pesquise snippets salvos — incluindo texto completo"
        }
      },
      mcp: {
        builtin: {
          name: "Better Sidebar",
          description: "Ferramentas principais para gerenciar conversas, dados e tarefas"
        }
      },
      entry: {
        autoTitle: "Agente Better Sidebar",
        autoDescription: "Descreva uma tarefa e deixe o agente escolher as ferramentas certas"
      }
    }
  },
  ru: {
    agent: {
      launcher: {
        newChatHint: "Работает в открытом чате. Начните новый, чтобы не засорять.",
        triggerHint: "Ввод > в поле чата тоже запускает агента."
      },
      dock: {
        speedOff: "Одобряю всё для этой задачи — нажмите, чтобы остановить",
        settings: "Что может делать",
        collapse: "Свернуть",
        expand: "Развернуть"
      },
      tool: {
        waiting: "Ждёт вас",
        running: "Выполняется",
        notRun: "Не выполнено",
        rejected: "Отклонено",
        rejectedTitle: "Вы отклонили это действие",
        done: "Готово",
        failed: "Ошибка",
        output: "Результат",
        streaming: "Пишет...",
        streamDone: "Готово",
        viewResult: "Нажмите, чтобы увидеть полный результат",
        viewPrompt: "Нажмите, чтобы увидеть полный промпт",
        systemPrompt: "Системный промпт",
        resultsTitle: "Результаты инструментов",
        promptTitle: "Содержимое промпта"
      },
      overlay: {
        emptyTitle: "Вид агента",
        emptyHint: "Введите ниже или выберите промпт агента, чтобы начать",
        scrollToBottom: "Вернуться вниз"
      },
      summary: {
        keepChanges: "Сохранить изменения"
      },
      undo: {
        aiUnaware: "ИИ не знает об этом — сообщите ему перед продолжением разговора.",
        reverted: "Изменения отменены",
        toastPrompt: "Агент изменил ваши данные.",
        expired: "Нечего отменять — началась новая задача или изменения были сохранены."
      },
      settings: {
        newSkill: "Новый навык",
        editSkill: "Редактировать навык",
        skillTitle: "Название",
        skillTitlePlaceholder: "напр. Организовать по теме",
        skillDescription: "Описание",
        skillDescriptionPlaceholder: "Краткое описание того, что делает этот навык",
        skillPrompt: "Содержимое промпта",
        skillPromptPlaceholder: "## Задача: Название задачи\n\nОпишите, что делает этот навык и как ИИ должен к нему подойти.\n\nСоветы:\n- Начните с понимания текущего состояния\n- Объясните план перед выполнением",
        titleRequired: "Название обязательно",
        descriptionRequired: "Описание обязательно",
        promptRequired: "Содержимое промпта обязательно",
        discardTitle: "Отменить несохранённые изменения?",
        discardContent: "Ваши правки этого навыка будут потеряны.",
        discard: "Отменить",
        deleteSkillTitle: "Удалить навык",
        deleteSkillContent: "\"{{title}}\" будет удалён навсегда. Это нельзя отменить.",
        alwaysOn: "Всегда включён"
      },
      skills: {
        autoClassify: {
          title: "Автоклассификация разговоров",
          description: "Автоматически распределяет разговоры по папкам и тегам на основе заголовков"
        },
        syncMessages: {
          title: "Синхронизация недостающих сообщений",
          description: "Находит разговоры без записанных сообщений и синхронизирует их содержимое"
        },
        export: {
          title: "Экспорт разговоров",
          description: "Запрашивает и отображает данные разговоров для пользователя"
        },
        managePrompts: {
          title: "Управление библиотекой промптов",
          description: "Создание, рефакторинг и организация переиспользуемых промптов — включая переменные и импорт"
        },
        manageSnippets: {
          title: "Управление сниппетами",
          description: "Организация, дедупликация и поиск сохранённых сниппетов — включая полный текст"
        }
      },
      mcp: {
        builtin: {
          name: "Better Sidebar",
          description: "Основные инструменты для управления разговорами, данными и задачами"
        }
      },
      entry: {
        autoTitle: "Агент Better Sidebar",
        autoDescription: "Опишите задачу, и агент выберет нужные инструменты"
      }
    }
  },
  "zh-CN": {
    agent: {
      launcher: {
        newChatHint: "在你打开的聊天中运行。开个新聊天可以保持整洁。",
        triggerHint: "在聊天输入框输入 > 也能从那里启动智能体。"
      },
      dock: {
        speedOff: "本次任务自动批准所有操作 — 点击停止",
        settings: "可以做什么",
        collapse: "收起",
        expand: "展开"
      },
      tool: {
        waiting: "等待你的操作",
        running: "执行中",
        notRun: "未执行",
        rejected: "已拒绝",
        rejectedTitle: "你拒绝了此操作",
        done: "已完成",
        failed: "失败",
        output: "输出",
        streaming: "正在输出...",
        streamDone: "就绪",
        viewResult: "点击查看完整结果",
        viewPrompt: "点击查看完整提示词",
        systemPrompt: "系统提示词",
        resultsTitle: "工具结果",
        promptTitle: "提示词内容"
      },
      overlay: {
        emptyTitle: "智能体视图",
        emptyHint: "在下方输入，或选择一个智能体提示词开始",
        scrollToBottom: "回到底部"
      },
      summary: {
        keepChanges: "保留更改"
      },
      undo: {
        aiUnaware: "AI 不知道这个操作 — 继续对话前请告知它。",
        reverted: "更改已撤销",
        toastPrompt: "智能体修改了你的数据。",
        expired: "没有可撤销的内容 — 新任务已开始，或更改已被保留。"
      },
      settings: {
        newSkill: "新建技能",
        editSkill: "编辑技能",
        skillTitle: "标题",
        skillTitlePlaceholder: "例如：按主题整理",
        skillDescription: "描述",
        skillDescriptionPlaceholder: "简要描述这个技能的功能",
        skillPrompt: "提示词内容",
        skillPromptPlaceholder: "## 任务：你的任务名称\n\n描述这个技能的作用以及 AI 应该如何执行。\n\n提示：\n- 先了解当前状态\n- 执行前说明你的计划",
        titleRequired: "标题为必填项",
        descriptionRequired: "描述为必填项",
        promptRequired: "提示词内容为必填项",
        discardTitle: "放弃未保存的更改？",
        discardContent: "你对此技能的编辑将丢失。",
        discard: "放弃",
        deleteSkillTitle: "删除技能",
        deleteSkillContent: "「{{title}}」将被永久删除，此操作不可撤销。",
        alwaysOn: "始终启用"
      },
      skills: {
        autoClassify: {
          title: "自动分类对话",
          description: "根据标题将对话自动整理到文件夹和标签中"
        },
        syncMessages: {
          title: "同步缺失消息",
          description: "查找未记录消息的对话并同步其内容"
        },
        export: {
          title: "导出对话",
          description: "为用户查询和展示对话数据"
        },
        managePrompts: {
          title: "管理提示词库",
          description: "创建、重构和整理可复用的提示词 — 包括变量和引用"
        },
        manageSnippets: {
          title: "管理片段",
          description: "整理、去重和搜索已保存的片段 — 包括全文内容"
        }
      },
      mcp: {
        builtin: {
          name: "Better Sidebar",
          description: "管理对话、数据和任务的核心工具"
        }
      },
      entry: {
        autoTitle: "Better Sidebar 智能体",
        autoDescription: "描述一个任务，让智能体选择合适的工具"
      }
    }
  },
  "zh-TW": {
    agent: {
      launcher: {
        newChatHint: "在你開啟的聊天中執行。開個新聊天可以保持整潔。",
        triggerHint: "在聊天輸入框輸入 > 也能從那裡啟動智慧體。"
      },
      dock: {
        speedOff: "本次任務自動批准所有操作 — 點擊停止",
        settings: "可以做什麼",
        collapse: "收合",
        expand: "展開"
      },
      tool: {
        waiting: "等待你的操作",
        running: "執行中",
        notRun: "未執行",
        rejected: "已拒絕",
        rejectedTitle: "你拒絕了此操作",
        done: "已完成",
        failed: "失敗",
        output: "輸出",
        streaming: "正在輸出...",
        streamDone: "就緒",
        viewResult: "點擊查看完整結果",
        viewPrompt: "點擊查看完整提示詞",
        systemPrompt: "系統提示詞",
        resultsTitle: "工具結果",
        promptTitle: "提示詞內容"
      },
      overlay: {
        emptyTitle: "智慧體視圖",
        emptyHint: "在下方輸入，或選擇一個智慧體提示詞開始",
        scrollToBottom: "回到底部"
      },
      summary: {
        keepChanges: "保留變更"
      },
      undo: {
        aiUnaware: "AI 不知道這個操作 — 繼續對話前請告知它。",
        reverted: "變更已撤銷",
        toastPrompt: "智慧體修改了你的資料。",
        expired: "沒有可撤銷的內容 — 新任務已開始，或變更已被保留。"
      },
      settings: {
        newSkill: "新增技能",
        editSkill: "編輯技能",
        skillTitle: "標題",
        skillTitlePlaceholder: "例如：按主題整理",
        skillDescription: "描述",
        skillDescriptionPlaceholder: "簡要描述這個技能的功能",
        skillPrompt: "提示詞內容",
        skillPromptPlaceholder: "## 任務：你的任務名稱\n\n描述這個技能的作用以及 AI 應該如何執行。\n\n提示：\n- 先了解目前狀態\n- 執行前說明你的計畫",
        titleRequired: "標題為必填欄位",
        descriptionRequired: "描述為必填欄位",
        promptRequired: "提示詞內容為必填欄位",
        discardTitle: "捨棄未儲存的變更？",
        discardContent: "你對此技能的編輯將遺失。",
        discard: "捨棄",
        deleteSkillTitle: "刪除技能",
        deleteSkillContent: "「{{title}}」將被永久刪除，此操作無法復原。",
        alwaysOn: "始終啟用"
      },
      skills: {
        autoClassify: {
          title: "自動分類對話",
          description: "根據標題將對話自動整理到資料夾和標籤中"
        },
        syncMessages: {
          title: "同步缺失訊息",
          description: "尋找未記錄訊息的對話並同步其內容"
        },
        export: {
          title: "匯出對話",
          description: "為使用者查詢和展示對話資料"
        },
        managePrompts: {
          title: "管理提示詞庫",
          description: "建立、重構和整理可重複使用的提示詞 — 包括變數和匯入"
        },
        manageSnippets: {
          title: "管理片段",
          description: "整理、去重和搜尋已儲存的片段 — 包括全文內容"
        }
      },
      mcp: {
        builtin: {
          name: "Better Sidebar",
          description: "管理對話、資料和任務的核心工具"
        }
      },
      entry: {
        autoTitle: "Better Sidebar 智慧體",
        autoDescription: "描述一個任務，讓智慧體選擇合適的工具"
      }
    }
  }
};

// Deep merge helper
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Apply patches
for (const [lang, patch] of Object.entries(patches)) {
  const filePath = path.join(dir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  deepMerge(data, patch);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`✅ Patched ${lang}.json`);
}

console.log('\nDone! All 60 missing keys added to all languages.');
