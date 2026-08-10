import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface DismissibleTipProps {
  children: ReactNode;
  onDismiss: () => void;
  /** Vertical alignment of the close button. Use 'start' for multi-line content. */
  align?: 'center' | 'start';
  className?: string;
}

/**
 * A reusable bottom-of-panel dismissible tip/banner.
 * Displays content with a close (×) button on the right.
 */
export const DismissibleTip = ({
  children,
  onDismiss,
  align = 'center',
  className = '',
}: DismissibleTipProps) => {
  return (
    <div
      className={`flex ${align === 'start' ? 'items-start' : 'items-center'} gap-2 px-3 py-2 mx-2 mb-2 rounded-md bg-muted/50 text-muted-foreground text-xs border border-border/50 ${className}`}
    >
      <span className="flex-1 leading-relaxed">{children}</span>
      <button
        onClick={onDismiss}
        className="shrink-0 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};
