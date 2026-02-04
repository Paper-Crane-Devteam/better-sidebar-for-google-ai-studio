import React, { forwardRef } from 'react';
import { useAppStore } from '@/shared/lib/store';
import { ArboristTreeHandle } from '../types';
import { TreeView } from './TreeView';
import { TimelineView } from './TimelineView';

export type { ArboristTreeHandle } from '../types';

interface ArboristTreeProps {
  onSelect: (item: any) => void;
  width?: number;
  height?: number;
}

export const ArboristTree = forwardRef<ArboristTreeHandle, ArboristTreeProps>(({ onSelect }, ref) => {
  const { ui } = useAppStore();
  const { viewMode } = ui.explorer;

  if (viewMode === 'timeline') {
    return <TimelineView ref={ref} onSelect={onSelect} />;
  }

  return <TreeView ref={ref} onSelect={onSelect} />;
});
