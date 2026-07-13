import React from 'react';
import { Icon as IconifyIcon } from '@iconify/react';
import { cn } from '@/shared/lib/utils/utils';

export interface UnifiedIconProps {
  /** Iconify icon name, e.g. "tabler:diamond", "codicon:collapse-all" */
  icon: string;
  /** Additional CSS classes (size, color, etc.) */
  className?: string;
  /** Inline style override */
  style?: React.CSSProperties;
  /** Explicit width (for icons that use pixel sizing instead of className) */
  width?: number | string;
  /** Explicit height (for icons that use pixel sizing instead of className) */
  height?: number | string;
}

/**
 * Unified icon component that wraps @iconify/react to match lucide-react's
 * visual appearance:
 * - Uses `currentColor` for stroke/fill (inherits text color like lucide)
 * - Renders at 1em × 1em by default (scales with font-size or explicit w/h classes)
 * - Applies `shrink-0` to prevent flex shrinking (same as lucide default behavior)
 *
 * Usage:
 *   <UIcon icon="tabler:diamond" className="h-4 w-4" />
 *   <UIcon icon="codicon:collapse-all" className="h-3.5 w-3.5" />
 *   <UIcon icon="fluent-color:premium-24" width={24} height={24} />
 *
 * This component ensures @iconify icons render with the same color inheritance
 * and sizing behavior as lucide-react icons, eliminating visual inconsistencies.
 */
export const UIcon = ({ icon, className, style, width, height }: UnifiedIconProps) => {
  return (
    <IconifyIcon
      icon={icon}
      className={cn('shrink-0', className)}
      style={{ color: 'currentColor', ...style }}
      {...(width !== undefined && { width })}
      {...(height !== undefined && { height })}
    />
  );
};
