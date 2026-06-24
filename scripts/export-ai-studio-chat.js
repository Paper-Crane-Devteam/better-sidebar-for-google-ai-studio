// ==UserScript==
// @name         AI Studio Chat Exporter (Markdown & Code Block Support)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @author       Tokisaki Galaxy
// @match        https://aistudio.google.com/prompts/*
// @description  Export AI Studio chat history. 1. i18n support (CN/EN/DE/RU/JA). 2. Draggable button. 3. Auto system prompt detection. 4. Perfect Markdown formatting.
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// @license      AGPL-3.0
// ==/UserScript==

(function() {
    'use strict';

    // --- 🌍 i18n Configuration ---
    const MESSAGES = {
        'zh': {
            exportBtn: "导出 JSON",
            wait: "请稍候...",
            getSys: "获取系统提示词...",
            resetView: "重置视图...",
            analyzing: "分析抓取中...",
            packaging: "生成 JSON...",
            noChat: "未找到聊天区域，请确保处于对话页面。",
            sysFound: "已获取系统提示词",
            sysHidden: "展开侧边栏获取..."
        },
        'en': {
            exportBtn: "Export JSON",
            wait: "Please wait...",
            getSys: "Fetching System Prompt...",
            resetView: "Resetting View...",
            analyzing: "Analyzing...",
            packaging: "Generating JSON...",
            noChat: "Chat container not found.",
            sysFound: "System prompt captured",
            sysHidden: "Expanding sidebar..."
        },
        'de': {
            exportBtn: "JSON Exportieren",
            wait: "Bitte warten...",
            getSys: "System-Prompt abrufen...",
            resetView: "Ansicht zurücksetzen...",
            analyzing: "Analysieren...",
            packaging: "JSON erstellen...",
            noChat: "Chat-Bereich nicht gefunden.",
            sysFound: "System-Prompt erfasst",
            sysHidden: "Seitenleiste erweitern..."
        },
        'ru': {
            exportBtn: "Экспорт JSON",
            wait: "Подождите...",
            getSys: "Получение System Prompt...",
            resetView: "Сброс вида...",
            analyzing: "Анализ...",
            packaging: "Создание JSON...",
            noChat: "Область чата не найдена.",
            sysFound: "System prompt получен",
            sysHidden: "Расширение боковой панели..."
        },
        'ja': {
            exportBtn: "JSON をエクスポート",
            wait: "少々お待ちください...",
            getSys: "システムプロンプトを取得中...",
            resetView: "ビューをリセット中...",
            analyzing: "解析中...",
            packaging: "JSON を生成中...",
            noChat: "チャット領域が見つかりませんでした。",
            sysFound: "システムプロンプトを取得しました",
            sysHidden: "サイドバーを展開しています..."
        }
    };

    // Detect Browser Language
    const langCode = (navigator.language || navigator.userLanguage).slice(0, 2);
    const t = (key) => MESSAGES[langCode]?.[key] || MESSAGES['en'][key];

    // --- Config ---
    const CONFIG = {
        scrollStep: 350,
        scrollDelay: 1200,
        uiDelay: 1000,
    };

    let isExporting = false;

    // --- UI: Draggable Button ---
    function createExportButton() {
        if (document.getElementById('ai-studio-export-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'ai-studio-export-btn';
        btn.innerText = t('exportBtn');
        
        Object.assign(btn.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '99999',
            padding: '10px 16px',
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            cursor: 'move',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            fontWeight: 'bold',
            fontSize: '14px',
            fontFamily: 'sans-serif',
            transition: 'background-color 0.2s, transform 0.1s',
            userSelect: 'none'
        });

        // Draggable Logic
        let isDragging = false;
        let hasMoved = false;
        let startX, startY;

        btn.addEventListener('mousedown', function(e) {
            isDragging = true;
            hasMoved = false;
            const rect = btn.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;

            btn.style.transform = 'none';
            btn.style.left = rect.left + 'px';
            btn.style.top = rect.top + 'px';
            btn.style.opacity = '0.9';
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            hasMoved = true;
            e.preventDefault();
            btn.style.left = `${e.clientX - startX}px`;
            btn.style.top = `${e.clientY - startY}px`;
        });

        document.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                btn.style.opacity = '1';
            }
        });

        btn.addEventListener('click', function(e) {
            if (hasMoved) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            startExportProcess();
        });

        document.body.appendChild(btn);
    }

    function updateBtn(text, disabled = false) {
        const btn = document.getElementById('ai-studio-export-btn');
        if (btn) {
            btn.innerText = text;
            btn.disabled = disabled;
            btn.style.backgroundColor = disabled ? '#7f8c8d' : '#1a73e8';
            btn.style.cursor = disabled ? 'wait' : 'move';
        }
    }

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // --- Logic 1: System Instruction ---
    async function getSystemInstruction() {
        updateBtn(t('getSys'));
        
        let target = document.querySelector('ms-system-instructions-panel .subtitle');
        if (target && target.innerText.trim()) return target.innerText.trim();

        const toggleBtn = document.querySelector('.runsettings-toggle-button');
        if (toggleBtn) {
            console.log(t('sysHidden'));
            toggleBtn.click();
            await sleep(CONFIG.uiDelay);
            
            target = document.querySelector('ms-system-instructions-panel .subtitle');
            let text = target ? target.innerText.trim() : "";
            if(!text) {
                const fallback = document.querySelector('ms-system-instruction-editor textarea');
                if(fallback) text = fallback.value;
            }

            toggleBtn.click();
            await sleep(500);
            return text;
        }
        return "";
    }

    // --- Logic 2: Markdown Converter ---
    function domToMarkdown(node) {
        if (!node) return "";
        
        const skipClasses = ['author-label', 'actions-container', 'turn-footer', 'thinking-progress-icon', 'thought-collapsed-text', 'mat-icon'];
        if (node.classList && skipClasses.some(c => node.classList.contains(c))) return "";
        if (node.tagName === 'MS-THOUGHT-CHUNK' || node.tagName === 'BUTTON') return "";

        // Code Blocks
        if (node.tagName === 'MS-CODE-BLOCK') {
            let lang = "text";
            const titleSpan = node.querySelector('.title span:last-child');
            if (titleSpan) lang = titleSpan.innerText.trim();
            
            const codeEl = node.querySelector('code');
            const codeText = codeEl ? codeEl.innerText : node.innerText;
            return `\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n`;
        }

        // List
        if (node.tagName === 'LI') return `- ${parseChildren(node).trim()}\n`;

        // Heading
        if (/^H[1-6]$/.test(node.tagName)) {
            const level = parseInt(node.tagName[1]);
            return `\n${'#'.repeat(level)} ${parseChildren(node).trim()}\n`;
        }

        // Paragraph & LineBreak
        if (node.tagName === 'P') return `\n${parseChildren(node).trim()}\n\n`;
        if (node.tagName === 'BR') return "\n";

        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        
        let result = parseChildren(node);

        // Formatting
        if (['STRONG', 'B'].includes(node.tagName)) result = `**${result}**`;
        if (['EM', 'I'].includes(node.tagName)) result = `*${result}*`;
        if (node.classList && node.classList.contains('inline-code')) result = `\`${result}\``;

        return result;
    }

    function parseChildren(node) {
        let text = "";
        node.childNodes.forEach(child => {
            text += domToMarkdown(child);
        });
        return text;
    }

    function extractCleanMarkdown(turnElement) {
        const contentDiv = turnElement.querySelector('.turn-content');
        if (!contentDiv) return null;
        let md = domToMarkdown(contentDiv);
        md = md.replace(/\n{3,}/g, '\n\n').trim();
        if (!md || md === "Model" || md === "User") return null;
        return md;
    }

    // --- Logic 3: Main Flow ---
    async function startExportProcess() {
        if (isExporting) return;
        isExporting = true;

        const container = document.querySelector('ms-autoscroll-container');
        if (!container) {
            alert(t('noChat'));
            isExporting = false;
            return;
        }

        // 1. System Prompt
        const sysInstruction = await getSystemInstruction();

        // 2. Scroll & Scrape
        const messageMap = new Map();
        const idOrder = [];

        updateBtn(t('resetView'));
        container.scrollTo({ top: 0, behavior: 'instant' });
        await sleep(1500);

        let lastScrollTop = -1;
        let stuckCounter = 0;

        while (true) {
            const visibleTurns = document.querySelectorAll('ms-chat-turn');
            visibleTurns.forEach(turn => {
                const uid = turn.id;
                if (!uid) return;

                if (!idOrder.includes(uid)) idOrder.push(uid);

                let role = 'user';
                if (turn.querySelector('.model-prompt-container') || turn.getAttribute('data-turn-role') === 'Model') {
                    role = 'assistant';
                }

                const content = extractCleanMarkdown(turn);
                if (content) {
                    messageMap.set(uid, { role, content });
                }
            });

            // Stop condition
            const isBottom = Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 20;
            if (Math.abs(container.scrollTop - lastScrollTop) < 2) stuckCounter++;
            else stuckCounter = 0;

            const percent = Math.min(99, Math.floor((container.scrollTop / (container.scrollHeight - container.clientHeight)) * 100));
            updateBtn(`${t('analyzing')} ${percent}%`);

            if (isBottom || stuckCounter >= 3) break;

            lastScrollTop = container.scrollTop;
            container.scrollBy({ top: CONFIG.scrollStep, behavior: 'smooth' });
            await sleep(CONFIG.scrollDelay);
        }

        // 3. Export
        updateBtn(t('packaging'));
        const validMessages = [];
        idOrder.forEach(id => {
            if (messageMap.has(id)) {
                validMessages.push(messageMap.get(id));
            }
        });

        downloadFile({
            system_instruction: sysInstruction,
            messages: validMessages
        });

        updateBtn(t('exportBtn'), false);
        isExporting = false;
    }

    function downloadFile(data) {
        let title = "aistudio_chat";
        try {
            const h1 = document.querySelector('.page-title h1');
            if (h1) title = h1.innerText.trim().replace(/[\\/:*?"<>|]/g, '_');
        } catch(e) {}

        const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function init() {
        const observer = new MutationObserver(() => createExportButton());
        observer.observe(document.body, { childList: true, subtree: true });
        createExportButton();
    }

    window.addEventListener('load', init);
    if (document.readyState === 'complete') init();

})();