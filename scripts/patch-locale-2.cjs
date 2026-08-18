const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'locale');

const patches = {
  es: {
    agent: {
      settings: {
        skillsTitle: "Habilidades",
        skillsDescription: "Las habilidades definen instrucciones especializadas para el Agente. Las habilidades integradas no se pueden eliminar.",
        maxSkills: "Se alcanzó el máximo de 20 habilidades personalizadas.",
        mcpTitle: "Servidores MCP",
        mcpDescription: "Los servidores MCP proporcionan herramientas que el Agente puede usar.",
        mcpToolCount: "{{count}} herramientas"
      },
      mcp: {
        tools: {
          activate_skill: "Cargar instrucciones especializadas para un tipo de tarea",
          execute_sql: "Ejecutar consultas SQL en la base de datos local",
          sync_conversation_messages: "Registrar el historial de mensajes de conversaciones sin contenido",
          export: "Descargar conversaciones como archivos",
          complete_task: "Finalizar el bucle del agente y reportar resultados"
        }
      }
    }
  },
  ja: {
    agent: {
      settings: {
        skillsTitle: "スキル",
        skillsDescription: "スキルはエージェント向けの専門的なプロンプト指示を定義します。組み込みスキルは削除できません。",
        maxSkills: "カスタムスキルの上限（20個）に達しました。",
        mcpTitle: "MCP サーバー",
        mcpDescription: "MCP サーバーはエージェントが使用できるツールを提供します。",
        mcpToolCount: "{{count}} ツール"
      },
      mcp: {
        tools: {
          activate_skill: "タスクタイプに特化した指示を読み込む",
          execute_sql: "ローカルデータベースで SQL クエリを実行",
          sync_conversation_messages: "メッセージ履歴のない会話の内容を記録",
          export: "会話をファイルとしてダウンロード",
          complete_task: "エージェントループを終了して結果を報告"
        }
      }
    }
  },
  pt: {
    agent: {
      settings: {
        skillsTitle: "Habilidades",
        skillsDescription: "As habilidades definem instruções especializadas para o Agente. Habilidades integradas não podem ser excluídas.",
        maxSkills: "Limite de 20 habilidades personalizadas atingido.",
        mcpTitle: "Servidores MCP",
        mcpDescription: "Os servidores MCP fornecem ferramentas que o Agente pode usar.",
        mcpToolCount: "{{count}} ferramentas"
      },
      mcp: {
        tools: {
          activate_skill: "Carregar instruções especializadas para um tipo de tarefa",
          execute_sql: "Executar consultas SQL no banco de dados local",
          sync_conversation_messages: "Registrar histórico de mensagens de conversas sem conteúdo",
          export: "Baixar conversas como arquivos",
          complete_task: "Encerrar o loop do agente e relatar resultados"
        }
      }
    }
  },
  ru: {
    agent: {
      settings: {
        skillsTitle: "Навыки",
        skillsDescription: "Навыки определяют специализированные инструкции для Агента. Встроенные навыки нельзя удалить.",
        maxSkills: "Достигнут лимит в 20 пользовательских навыков.",
        mcpTitle: "MCP-серверы",
        mcpDescription: "MCP-серверы предоставляют инструменты, которые может использовать Агент.",
        mcpToolCount: "{{count}} инструментов"
      },
      mcp: {
        tools: {
          activate_skill: "Загрузить специализированные инструкции для типа задачи",
          execute_sql: "Выполнить SQL-запросы к локальной базе данных",
          sync_conversation_messages: "Записать историю сообщений для разговоров без содержимого",
          export: "Скачать разговоры как файлы",
          complete_task: "Завершить цикл агента и сообщить результаты"
        }
      }
    }
  },
  "zh-TW": {
    agent: {
      settings: {
        skillsTitle: "技能",
        skillsDescription: "技能為智慧體定義專門的提示詞指令。內建技能無法刪除。",
        maxSkills: "已達自訂技能上限（20 個）。",
        mcpTitle: "MCP 伺服器",
        mcpDescription: "MCP 伺服器提供智慧體可使用的工具。",
        mcpToolCount: "{{count}} 個工具"
      },
      mcp: {
        tools: {
          activate_skill: "載入特定任務類型的專門指令",
          execute_sql: "在本機資料庫執行 SQL 查詢",
          sync_conversation_messages: "為沒有訊息記錄的對話記錄訊息歷史",
          export: "將對話下載為檔案",
          complete_task: "結束智慧體迴圈並回報結果"
        }
      }
    }
  }
};

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

for (const [lang, patch] of Object.entries(patches)) {
  const filePath = path.join(dir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  deepMerge(data, patch);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`✅ Patched ${lang}.json`);
}

console.log('\nDone!');
