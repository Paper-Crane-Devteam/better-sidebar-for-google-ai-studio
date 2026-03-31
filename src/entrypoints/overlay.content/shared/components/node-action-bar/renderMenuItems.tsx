import React from 'react';
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuCheckboxItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/entrypoints/overlay.content/shared/components/ui/context-menu';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/shared/components/ui/dropdown-menu';
import type { MenuEntryDef, MenuSubDef } from './menu-types';

type Variant = 'context' | 'dropdown';

/**
 * Wrapper that makes Radix Sub menus fully controlled.
 *
 * In shadow-DOM environments Radix's built-in pointer-grace-area /
 * focus-outside detection can fail, leaving sub-menus stuck open.
 * By controlling `open` ourselves and closing on `onOpenChange(false)`
 * we guarantee correct behaviour everywhere.
 */
function ControlledSubMenu({
  entry,
  variant,
  openKey,
  onOpenChange,
}: {
  entry: MenuSubDef;
  variant: Variant;
  openKey: string | null;
  onOpenChange: (key: string | null) => void;
}) {
  const Sub = variant === 'context' ? ContextMenuSub : DropdownMenuSub;
  const SubTrigger = variant === 'context' ? ContextMenuSubTrigger : DropdownMenuSubTrigger;
  const SubContent = variant === 'context' ? ContextMenuSubContent : DropdownMenuSubContent;

  const isOpen = openKey === entry.key;

  const hasNestedDefs =
    Array.isArray(entry.children) &&
    entry.children.length > 0 &&
    typeof (entry.children[0] as any)?.type === 'string';

  return (
    <Sub
      open={isOpen}
      onOpenChange={(open) => onOpenChange(open ? entry.key : null)}
    >
      <SubTrigger>
        {entry.icon && (
          <span className="mr-2 h-4 w-4 flex items-center justify-center shrink-0">
            {entry.icon}
          </span>
        )}
        {entry.label}
      </SubTrigger>
      <SubContent
        className={entry.contentClassName}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {hasNestedDefs
          ? renderMenuItems(entry.children as MenuEntryDef[], variant)
          : (entry.children as React.ReactNode)}
      </SubContent>
    </Sub>
  );
}

/**
 * Stateful wrapper that renders a flat list of MenuEntryDef items
 * while coordinating which sub-menu (if any) is open.
 */
function MenuItemList({ items, variant }: { items: MenuEntryDef[]; variant: Variant }) {
  const [openSubKey, setOpenSubKey] = React.useState<string | null>(null);

  const Item = variant === 'context' ? ContextMenuItem : DropdownMenuItem;
  const Separator = variant === 'context' ? ContextMenuSeparator : DropdownMenuSeparator;
  const CheckboxItem = variant === 'context' ? ContextMenuCheckboxItem : DropdownMenuCheckboxItem;

  return (
    <>
      {items.map((entry) => {
        switch (entry.type) {
          case 'separator':
            return <Separator key={entry.key} />;

          case 'item':
            return (
              <Item
                key={entry.key}
                className={entry.className}
                onClick={entry.onClick}
                onSelect={entry.preventClose ? (e: Event) => e.preventDefault() : undefined}
                onPointerEnter={() => setOpenSubKey(null)}
              >
                {entry.icon && (
                  <span className="mr-2 h-4 w-4 flex items-center justify-center shrink-0">
                    {entry.icon}
                  </span>
                )}
                {entry.label}
              </Item>
            );

          case 'checkbox':
            return (
              <CheckboxItem
                key={entry.key}
                checked={entry.checked}
                onCheckedChange={entry.onCheckedChange}
                onSelect={entry.preventClose ? (e: Event) => e.preventDefault() : undefined}
                onPointerEnter={() => setOpenSubKey(null)}
              >
                {entry.label}
              </CheckboxItem>
            );

          case 'sub':
            return (
              <ControlledSubMenu
                key={entry.key}
                entry={entry}
                variant={variant}
                openKey={openSubKey}
                onOpenChange={setOpenSubKey}
              />
            );

          default:
            return null;
        }
      })}
    </>
  );
}

export function renderMenuItems(items: MenuEntryDef[], variant: Variant): React.ReactNode[] {
  return [<MenuItemList key="__menu-items" items={items} variant={variant} />];
}
