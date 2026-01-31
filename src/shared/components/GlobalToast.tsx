import React from 'react';
import { useToastStore } from '@/shared/lib/toast';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/shared/lib/utils'; // Assuming cn utility exists, usually does in shadcn projects

const icons = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <AlertCircle className="h-5 w-5 text-red-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
};

const borderColors = {
    success: 'border-green-200 dark:border-green-900',
    error: 'border-red-200 dark:border-red-900',
    info: 'border-blue-200 dark:border-blue-900',
    warning: 'border-yellow-200 dark:border-yellow-900',
};

const bgColors = {
    success: 'bg-green-50 dark:bg-green-950/30',
    error: 'bg-red-50 dark:bg-red-950/30',
    info: 'bg-blue-50 dark:bg-blue-950/30',
    warning: 'bg-yellow-50 dark:bg-yellow-950/30',
};

export const GlobalToast = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 pointer-events-none w-full max-w-sm items-center px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-center gap-3 w-full p-4 rounded-md shadow-lg border animate-in slide-in-from-top-full duration-300",
            "bg-background text-foreground", // Default fallback
            // borderColors[toast.type],
            // bgColors[toast.type]
          )}
        >
          {icons[toast.type]}
          <div className="flex-1 text-sm font-medium">{toast.message}</div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
