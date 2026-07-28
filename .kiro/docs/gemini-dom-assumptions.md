# Gemini DOM 假设待确认清单

这份清单列出 agent loop 依赖的所有 Gemini DOM 假设，标注每一条的**可信度来源**：
是代码里长期跑通的、还是我为了修 bug 推测出来的。

**怎么用**：在 Gemini 页面打开 DevTools Console，逐条跑「验证脚本」，把结果贴回来，
我按结果改代码。优先确认 🔴 项 —— 它们是这轮改动的支点，猜错就会继续丢轮次。

| 标记 | 含义 |
|------|------|
| 🔴 | 我推测的，**未验证**，且链路正确性依赖它 |
| 🟡 | 沿用已有代码，但这轮给了它更重的职责，值得复核 |
| 🟢 | 已有代码长期在跑，大概率没问题，顺带确认 |

---

## 🔴 A. 发送 / 停止按钮的状态识别

`quill-editor.ts` → `getSendButtonState()`

这是最关键的一条。你反馈「点击没发送消息，而是 stop generate 了」，说明发送和停止
是同一个按钮位。我据此写了三种识别方式，但**没有一种是我确认过的**，纯粹是按 Angular
Material 的常见写法推的。

### A1. `mat-icon` 的文本内容 🔴

代码假设按钮内有 `mat-icon`，其 `textContent` 在两种状态下分别是 `send` 和 `stop`。

```js
// 空闲状态下运行
const btn = document.querySelector('.text-input-field .send-button-container>gem-icon-button>button');
console.log('按钮存在:', !!btn);
console.log('outerHTML:', btn?.outerHTML);
console.log('mat-icon 文本:', btn?.querySelector('mat-icon')?.textContent?.trim());
```

**需要你做**：先在空闲状态跑一次，再发一条消息、**在生成过程中**跑同一段，把两次
`outerHTML` 都贴回来。我要看的是两个状态之间到底哪个属性/文本在变。

如果 Gemini 用的不是 `mat-icon` 而是内联 `<svg>` 或 `.material-symbols-outlined` span，
那 A1 整条失效，需要换判据。

### A2. `aria-label` / `mattooltip` 文案 🔴

代码用正则匹配 `stop|停止|停止生成|中止` 和 `send|发送|傳送`。

```js
const btn = document.querySelector('.text-input-field .send-button-container>gem-icon-button>button');
console.log('aria-label:', btn?.getAttribute('aria-label'));
console.log('mattooltip:', btn?.getAttribute('mattooltip'));
// 生成中再跑一次对比
```

**风险**：你的界面语言决定实际文案。如果是中文界面且文案是「停止回答」之类我没覆盖的
说法，正则会漏。请把两个状态下的实际文案贴回来。

### A3. 容器 class 切换 🔴

代码兜底判断 `.stop-button-container` / `.send-button-container`。

```js
const btn = document.querySelector('.text-input-field .send-button-container>gem-icon-button>button');
console.log('祖先链:', btn && [...(function*(e){while(e){yield e.tagName+'.'+e.className;e=e.parentElement}})(btn)].slice(0,6));
// 生成中再跑一次，看 send-button-container 是否变成 stop-button-container
```

**注意**：如果生成中 class 依然是 `send-button-container`，那 A3 是错的，而且更糟 ——
`findSendButton()` 的主选择器写死了 `.send-button-container`，生成中可能根本找不到按钮。
这种情况下选择器需要放宽。

### A4. 是否真的是同一个 DOM 节点 🔴

我假设 send / stop 是同一个按钮换皮。也可能是两个并存的按钮，靠 `hidden` 切换。

```js
// 生成中运行
document.querySelectorAll('.text-input-field button').forEach((b,i) => {
  console.log(i, b.className, '| hidden:', b.hasAttribute('hidden'),
              '| aria-label:', b.getAttribute('aria-label'),
              '| icon:', b.querySelector('mat-icon')?.textContent?.trim());
});
```

如果是两个按钮，识别逻辑要改成「找那个可见的」，现在的实现会一直命中第一个。

---

## 🟡 B. 判断回复是否生成完毕

`gemini-adapter.ts` → `isStreaming()` / `observeAIResponseComplete()`

原来的实现全页面查 `mat-progress-bar`、`message-actions[hidden]` 这类选择器，会误命中
无关元素，导致循环一直等到 60s 超时。我改成了限定在当前 `model-response` 内，并加了
「文本连续 3 次采样一致」的稳定性判断。判据本身沿用旧代码，但作用域是我改的。

### B1. `message-actions[hidden]` 🟡

假设：Gemini 在回复生成完成前隐藏该轮的操作栏（复制 / 点赞按钮）。

```js
// 生成中运行
const turn = [...document.querySelectorAll('model-response')].pop();
console.log('message-actions 存在:', !!turn?.querySelector('message-actions'));
console.log('有 hidden 属性:', turn?.querySelector('message-actions')?.hasAttribute('hidden'));
// 生成结束后再跑一次，hidden 应该消失
```

**已知问题**：一轮回复刚开始时 `message-actions` 可能**根本还不存在**，此时
`querySelector` 返回 null，`hasAttribute` 判断走不到，会被误判为「已完成」。
这正是「第一轮就 Task finished」的原因之一。请确认元素在生成早期是否存在。

### B2. `aria-busy` 🟡

```js
const turn = [...document.querySelectorAll('model-response')].pop();
console.log('turn aria-busy:', turn?.getAttribute('aria-busy'));
console.log('markdown aria-busy:',
  turn?.querySelector('.markdown, .model-response-text')?.getAttribute('aria-busy'));
// 生成中 / 生成后各跑一次
```

`useConversationMessages.ts` 里也用了 `aria-busy` 判断 streaming，如果这个属性可靠，
它比 B1 干净得多，我可以把 B1 降级为兜底。

### B3. `.loading-indicator` / `.streaming-indicator` / `.response-streaming` 🟡

这三个 class 是从旧代码继承的，我没找到它们真实存在的证据。

```js
['loading-indicator','streaming-indicator','response-streaming'].forEach(c =>
  console.log(c, document.querySelectorAll('.'+c).length));
// 生成中运行
```

全是 0 的话说明是死代码，可以删掉，减少误判面。

### B4. 采样参数是否合适 🟡

现在的设定：每 400ms 采样，文本连续 3 次一致（≈1.2s 静默）才算生成结束。

**需要你判断**：Gemini 长回复中途的自然停顿会不会超过 1.2s?如果会，仍可能提前判定完成。
接入 A 的按钮状态后这个风险已经小很多（按钮是 stop 就无条件继续等），但如果 A 全部
不成立，B4 就是唯一防线,需要把阈值调高。

---

## 🟢 C. 回复元素定位

`gemini-adapter.ts` → `getLastAIResponseElement()`

```js
console.log('主选择器命中:', document.querySelectorAll(
  'model-response .model-response-text, model-response .response-content, .model-response-text').length);
console.log('兜底命中:', document.querySelectorAll('[data-message-author-role="model"]').length);
```

**要确认的点**：主选择器同时匹配 `model-response .model-response-text` 和裸的
`.model-response-text`，同一个元素可能被计两次。只要「最后一个」是正确的当前轮回复就没问题,
但如果 Gemini 把「思考过程」也渲染成 `.model-response-text`,取到的可能是思考块而不是正文。

请在一轮**带思考过程**的回复上跑上面这段，看命中数量和你的直觉是否一致。

---

## 🟢 D. 编辑器与对话容器

这两处是老代码，长期在跑，顺带确认。

```js
// D1. Quill 编辑器
console.log('编辑器:', !!document.querySelector('rich-textarea .ql-editor[contenteditable="true"]'));

// D2. 对话滚动容器（按优先级，应命中第一个）
['chat-window infinite-scroller','infinite-scroller.chat-history','#chat-history',
 'ms-autoscroll-container','.conversation-container'].forEach(s =>
  console.log(s, '→', !!document.querySelector(s)));
```

---

## 一次性诊断脚本

嫌上面一条条跑麻烦的话，直接用这个。**在生成过程中**跑一次、**生成结束后**再跑一次，
把两次输出都贴回来，A 和 B 的问题基本就能定了。

```js
(() => {
  const pick = s => document.querySelector(s);
  const btn = pick('.text-input-field .send-button-container>gem-icon-button>button')
           || pick('.text-input-field button:last-of-type');
  const turn = [...document.querySelectorAll('model-response')].pop();
  const actions = turn?.querySelector('message-actions');

  console.log('=== 按钮 ===');
  console.log('找到:', !!btn);
  console.log('icon:', btn?.querySelector('mat-icon')?.textContent?.trim());
  console.log('aria-label:', btn?.getAttribute('aria-label'));
  console.log('mattooltip:', btn?.getAttribute('mattooltip'));
  console.log('disabled:', btn?.disabled);
  console.log('父容器 class:', btn?.parentElement?.parentElement?.className);
  console.log('outerHTML:', btn?.outerHTML);

  console.log('=== 生成状态 ===');
  console.log('model-response 总数:', document.querySelectorAll('model-response').length);
  console.log('turn aria-busy:', turn?.getAttribute('aria-busy'));
  console.log('message-actions 存在:', !!actions, '| hidden:', actions?.hasAttribute('hidden'));
  ['loading-indicator','streaming-indicator','response-streaming'].forEach(c =>
    console.log('.'+c+':', document.querySelectorAll('.'+c).length));

  console.log('=== 容器 ===');
  console.log('编辑器:', !!pick('rich-textarea .ql-editor[contenteditable="true"]'));
  console.log('滚动容器:', !!pick('chat-window infinite-scroller'));
})();
```

---

## 确认后我会改什么

| 你的反馈 | 我的动作 |
|----------|----------|
| A 全部不成立 | 换判据（可能改用 MutationObserver 盯按钮属性变化），并调高 B4 阈值 |
| A1 或 A2 成立 | 删掉不成立的分支，减少误判路径 |
| A4 是两个按钮 | 重写 `findSendButton()`，改成选可见的那个 |
| B2 `aria-busy` 可靠 | 提为主判据，B1 降为兜底 |
| B3 全是 0 | 删掉这三个 class |
| C 会命中思考块 | 收紧选择器，排除思考过程容器 |
