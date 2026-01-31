# 国际化 (i18n) 使用指南

本项目使用 `i18next` 和 `react-i18next` 进行国际化支持。

## 文件结构

```
src/locale/
  ├── zh.json      # 中文翻译
  ├── en.json      # 英文翻译
  └── i18n.ts      # i18n 配置文件
```

## 使用方法

### 1. 在组件中使用翻译

```tsx
import { useI18n } from '@/shared/hooks/useI18n';

function MyComponent() {
  const { t } = useI18n();
  
  return (
    <div>
      <h1>{t('tabs.files')}</h1>
      <button>{t('common.save')}</button>
    </div>
  );
}
```

### 2. 带参数的翻译

```tsx
const { t } = useI18n();

// 在 zh.json 中: "imported": "已导入 {{count}} 条对话"
// 在 en.json 中: "imported": "Imported {{count}} conversations"
toast.success(t('toast.imported', { count: 10 }));
```

### 3. 切换语言

```tsx
const { changeLanguage, currentLanguage } = useI18n();

// 切换到中文
changeLanguage('zh');

// 切换到英文
changeLanguage('en');
```

## 添加新的翻译

1. 在 `zh.json` 和 `en.json` 中添加对应的键值对
2. 在组件中使用 `t('your.key.path')` 来引用翻译

## 语言检测

- 首次加载时会自动检测浏览器语言
- 如果浏览器语言是中文（zh-*），则使用中文
- 否则默认使用英文
- 用户选择的语言会保存到 Chrome Storage 中

