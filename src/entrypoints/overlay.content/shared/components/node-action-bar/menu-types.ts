import React from 'react';

/** A simple clickable menu item */
export interface MenuItemDef {
  type: 'item';
  key: string;
  icon?: React.ReactNode;
  label: string;
  onClick: (e?: React.MouseEvent) => void;
  className?: string;
  /** If true, prevent the menu from closing after click (useful for checkbox-like items) */
  preventClose?: boolean;
}

/** A separator line */
export interface MenuSeparatorDef {
  type: 'separator';
  key: string;
}

/** A checkbox menu item */
export interface MenuCheckboxItemDef {
  type: 'checkbox';
  key: string;
  label: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** If true, prevent the menu from closing after toggle */
  preventClose?: boolean;
}

/** A submenu with nested items or custom content */
export interface MenuSubDef {
  type: 'sub';
  key: string;
  icon?: React.ReactNode;
  label: string;
  /** Either nested MenuItemDef[] or custom ReactNode content */
  children: MenuEntryDef[] | React.ReactNode;
  contentClassName?: string;
}

export type MenuEntryDef =
  | MenuItemDef
  | MenuSeparatorDef
  | MenuCheckboxItemDef
  | MenuSubDef;
