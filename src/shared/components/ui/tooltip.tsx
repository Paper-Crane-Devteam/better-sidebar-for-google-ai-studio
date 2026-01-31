import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/shared/lib/utils"
import { TooltipHelper } from "@/shared/lib/tooltip-helper"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
  // Use the container from TooltipHelper if available (Overlay), otherwise undefined (defaults to body for Sidepanel)
  const container = React.useMemo(() => {
    // Check if we are in the overlay content script environment by checking if TooltipHelper has an instance
    // However, TooltipHelper singleton might exist but not be initialized if imported in SidePanel.
    // getContainer() defaults to document.body if not initialized, but for Overlay we want the Wrapper.
    // If not initialized (SidePanel), it returns body (or wrapper is null).
    
    // Actually, Radix Tooltip Portal `container` prop expects HTMLElement.
    // If we pass document.body to Radix, it works.
    // But for Overlay, we want the shadow wrapper.
    return TooltipHelper.getInstance().getContainer();
  }, []);

  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 max-w-xs",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
})
TooltipContent.displayName = TooltipPrimitive.Content.displayName

function SimpleTooltip({ content, children, ...props }: { content: React.ReactNode } & React.ComponentProps<typeof TooltipContent> & { delayDuration?: number }) {
  return (
    <TooltipProvider delayDuration={props.delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent {...props}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, SimpleTooltip }

