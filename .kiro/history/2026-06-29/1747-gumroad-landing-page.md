# Gumroad 自定义 Landing Page 构建与发布

> 对话时间：2026-06-29 17:47
> 状态：✅ 已完成

## 任务概述

为 Gumroad 产品 `eklogd`（Better Sidebar: Power Pack）创建并发布了自定义 landing page，替换 Gumroad 默认产品页。

## 当前进度

### 已完成

- [x] 安装 Gumroad CLI (`brew install antiwork/cli/gumroad`)
- [x] 认证登录 Gumroad CLI
- [x] 获取产品详情（名称、价格、封面图 URL、描述）
- [x] 设计并编写 `landing.html` — 完整的转化导向落地页
- [x] 通过 `gumroad products page preview` 验证 sanitization report 无关键问题
- [x] 确认无 warning（buy element 存在）
- [x] 通过 `gumroad products page publish` 发布上线
- [x] 验证页面返回 HTTP 200，checkout URL (`?wanted=true`) 正确 302 跳转

### 进行中 / 未完成

- [ ] （无）

## 关键上下文

### 技术决策

- 使用 Tailwind CDN + Google Fonts（Inter），Gumroad 沙箱允许这两个外部 CDN
- 产品封面图使用 Gumroad 自身的 `public-files.gumroad.com` 域名，不触发外部图片拦截
- 深色模式通过 `prefers-color-scheme` 媒体查询自动检测，给 `<html>` 加 `dark` class
- 多个 `data-gumroad-action="buy"` 按钮分布在 nav/hero/final CTA，提升转化率
- 使用 `data-gumroad-field="name|price"` 让 Gumroad 服务端填充真实值
- Sanitizer 只移除了 `<meta>` 和 `<title>` 标签（预期行为，Gumroad 自己处理 head）

### 重要发现

- Gumroad 自定义 landing page 的 sanitizer 允许：`<script>`, `<style>`, `<details>`, `<summary>`, `<table>`, `<img>` 等
- Gumroad 自定义 landing page 不允许：`<meta>`, `<title>` 标签
- 页面在 sandbox iframe 内运行，父级通过 `message` 事件监听 `gumroad:checkout` 
- `data-gumroad-action="buy"` 在 iframe 内会自动向 parent postMessage
- Checkout 链接格式：`/l/eklogd?wanted=true`，支持 `variant/option/quantity/price/recurrence` 参数

## 涉及文件

| 文件路径 | 说明 |
|----------|------|
| `landing.html` | Gumroad 自定义 landing page 源文件（已发布） |

## 环境 & 分支信息

- Gumroad 产品 permalink：`eklogd`
- 产品 URL：`https://papercranedev.gumroad.com/l/eklogd`
- 产品价格：$19.99（固定价格，非 pay-what-you-want）
- Gumroad CLI 版本：2026.06.24

## 下次开始时的提示

> Landing page 已发布上线。如果需要修改页面，直接编辑 `landing.html` 然后运行：
> ```
> gumroad products page publish eklogd ./landing.html --json --no-input --non-interactive
> ```
> 如果需要恢复默认页面：
> ```
> gumroad products page clear eklogd --yes --json --no-input --non-interactive
> ```

## 相关命令速查

```bash
# 查看产品信息
gumroad products view eklogd --json --no-input --non-interactive

# 预览（不发布，检查 sanitization）
gumroad products page preview eklogd ./landing.html --json --no-input --non-interactive

# 发布
gumroad products page publish eklogd ./landing.html --json --no-input --non-interactive

# 获取线上 URL
gumroad products page url eklogd --json --jq '.product.landing_url' --no-input --non-interactive

# 清除自定义页面
gumroad products page clear eklogd --yes --json --no-input --non-interactive
```
