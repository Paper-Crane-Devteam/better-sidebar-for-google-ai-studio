import React from 'react';
import { Gem as GemIcon, History, Plus } from 'lucide-react';

interface CompositeIconProps {
  className?: string;
}

export const GemWithHistory = ({ className }: CompositeIconProps) => (
  <span className={`relative inline-flex items-center justify-center ${className ?? ''}`}>
    <GemIcon className="h-4 w-4" />
    <History className="absolute -top-1 -right-1.5" style={{ width: 12, height: 12 }} strokeWidth={2.5} />
  </span>
);

export const GemWithPlus = ({ className }: CompositeIconProps) => (
  <span className={`relative inline-flex items-center justify-center ${className ?? ''}`}>
    <GemIcon className="h-4 w-4" />
    <Plus className="absolute -top-1 -right-1.5" style={{ width: 12, height: 12 }} strokeWidth={3} />
  </span>
);
