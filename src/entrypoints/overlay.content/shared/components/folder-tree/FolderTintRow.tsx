import React from 'react';
import { RowRendererProps } from 'react-arborist';
import { FolderTreeNodeData } from './types';

/**
 * Custom row renderer for folder tree items.
 */
export function FolderTintRow<T extends FolderTreeNodeData>({
  node,
  attrs,
  innerRef,
  children,
}: RowRendererProps<T>) {
  return (
    <div
      {...attrs}
      ref={innerRef}
      className={attrs.className}
      onFocus={(e) => e.stopPropagation()}
      onClick={node.handleClick}
    >
      {children}
    </div>
  );
}
