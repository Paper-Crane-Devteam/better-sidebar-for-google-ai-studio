---
inclusion: fileMatch
fileMatchPattern: "**/*.tsx"
---

# Spacing System Rules (8px Grid)

This project enforces a 4px-base / 8px-rhythm spacing system. Follow these rules when writing or modifying any UI component.

## Allowed Spacing Values

| Tailwind Class | Pixels | Usage |
|---|---|---|
| `gap-1`, `p-1`, `m-1` | 4px | Micro: icon-text gap, inline elements |
| `gap-2`, `p-2`, `m-2` | 8px | Base: inner padding, toolbar gaps, small margins |
| `gap-3`, `p-3`, `m-3` | 12px | Compact: header padding in dense panels |
| `gap-4`, `p-4`, `m-4` | 16px | Standard: section padding, card padding |
| `gap-5`, `p-5`, `m-5` | 20px | Comfortable: modal content |
| `gap-6`, `p-6`, `m-6` | 24px | Generous: dialog padding, section gaps |
| `gap-8`, `p-8`, `m-8` | 32px | Large: page-level spacing |

## BANNED Values (never use)

- `gap-0.5`, `p-0.5`, `m-0.5` → 2px (too small, use `gap-1` instead)
- `gap-1.5`, `p-1.5`, `m-1.5` → 6px (use `gap-1` or `gap-2` instead)
- `gap-2.5`, `p-2.5`, `m-2.5` → 10px (use `gap-2` or `gap-3` instead)
- `py-[3px]`, `px-[5px]`, `px-[11px]` → arbitrary non-grid values (snap to nearest 4px multiple)

## Pattern Guidelines

- **Toolbar headers**: `px-3 py-2` (12px horizontal, 8px vertical)
- **Icon button groups**: `gap-1` (4px between buttons)
- **Section separators (dividers)**: `mx-1` or `mx-2` for horizontal margins
- **Modal/dialog content**: `p-6` (24px all sides)
- **Icon-to-text gap**: `gap-2` (8px)
- **List item vertical**: `py-1` (4px) or `space-y-1` (4px)
- **Card internal**: `p-4` (16px) or `p-5` (20px)

## CSS Variables Available

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
```

## Custom Tailwind Tokens

Use `grid-*` tokens for explicit grid-aligned spacing when Tailwind defaults feel ambiguous:
- `p-grid-1` = 8px, `p-grid-2` = 16px, `p-grid-3` = 24px, etc.
