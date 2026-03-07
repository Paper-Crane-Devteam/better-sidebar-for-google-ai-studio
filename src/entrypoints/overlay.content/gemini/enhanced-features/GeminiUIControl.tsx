import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { SlidersHorizontal, X, ChevronRight } from 'lucide-react';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils/utils';

export const GeminiUIControl = () => {
  const [isOpen, setIsOpen] = useState(false);

  const sidebarWidth = useSettingsStore(s => s.enhancedFeatures.gemini.sidebarWidth);
  const chatWidth = useSettingsStore(s => s.enhancedFeatures.gemini.chatWidth);
  const inputWidth = useSettingsStore(s => s.enhancedFeatures.gemini.inputWidth);
  const hideBrand = useSettingsStore(s => s.enhancedFeatures.gemini.hideBrand);
  const hideDisclaimer = useSettingsStore(s => s.enhancedFeatures.gemini.hideDisclaimer);
  const setGeminiFeature = useSettingsStore(s => s.setGeminiFeature);

  // Apply CSS for all UI tweaks into the main document
  useEffect(() => {
    const styleId = 'better-sidebar-gemini-ui-tweaks';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    let css = '';
    
    // Visibility Toggles
    if (hideBrand) {
      css += `bard-mode-switcher:has(bard-logo) { display: none !important; }\n`;
    }
    if (hideDisclaimer) {
      css += `hallucination-disclaimer { visibility: hidden !important; height: 10px !important; }\n`;
    }

    // Layout Widths
    css += `
      bard-sidenav { 
        --bard-sidenav-open-width: ${sidebarWidth}px !important; 
      }
      .chat-window {
        max-width: ${chatWidth}% !important;
        width: 100% !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
      input-area-v2 {
        max-width: ${inputWidth}% !important;
        width: 100% !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
    `;

    styleEl.textContent = css;
  }, [hideBrand, hideDisclaimer, sidebarWidth, chatWidth, inputWidth]);

  return (
    <div className="fixed top-3.5 right-20 z-[999999]">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-background/60 backdrop-blur-md transition-all hover:bg-accent",
              isOpen && "bg-accent shadow-sm ring-2 ring-ring/20"
            )}
          >
            {isOpen ? (
              <X className="h-4 w-4 text-foreground" />
            ) : (
              <SlidersHorizontal className="h-4 w-4 text-foreground" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-[320px] rounded-2xl border border-border bg-popover/95 p-5 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Gemini UI Controls</h3>
              <p className="text-[11px] text-muted-foreground">Adjust layout and visibility</p>
            </div>
          </div>

          {/* Section 1: Layout Dimensions */}
          <div className="space-y-5 mb-6">
            <div className="flex items-center gap-2">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Layout Dimensions</h4>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            
            <div className="space-y-4">
              {/* Sidebar Width */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Sidebar Width</Label>
                  <span className="text-[10px] font-mono font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">{sidebarWidth}px</span>
                </div>
                <input
                  type="range"
                  min={300}
                  max={550}
                  step={1}
                  value={sidebarWidth}
                  onChange={(e) => setGeminiFeature('sidebarWidth', Number(e.target.value))}
                  className="ui-slider"
                />
              </div>

              {/* Chat Width */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Chat Width</Label>
                  <span className="text-[10px] font-mono font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">{chatWidth}%</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={100}
                  step={1}
                  value={chatWidth}
                  onChange={(e) => setGeminiFeature('chatWidth', Number(e.target.value))}
                  className="ui-slider"
                />
              </div>

              {/* Input Box Width */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Input Box Width</Label>
                  <span className="text-[10px] font-mono font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">{inputWidth}%</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={100}
                  step={1}
                  value={inputWidth}
                  onChange={(e) => setGeminiFeature('inputWidth', Number(e.target.value))}
                  className="ui-slider"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Element Visibility */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Element Visibility</h4>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            <div className="space-y-4">
              {/* Gemini Brand */}
              <div className="flex items-center justify-between group">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold cursor-pointer" onClick={() => setGeminiFeature('hideBrand', !hideBrand)}>Gemini Brand</Label>
                  <p className="text-[10px] text-muted-foreground">Logo and version switcher</p>
                </div>
                <Switch
                  checked={!hideBrand}
                  onCheckedChange={(c) => setGeminiFeature('hideBrand', !c)}
                />
              </div>

              {/* AI Disclaimer */}
              <div className="flex items-center justify-between group">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold cursor-pointer" onClick={() => setGeminiFeature('hideDisclaimer', !hideDisclaimer)}>AI Disclaimer</Label>
                  <p className="text-[10px] text-muted-foreground">Error warning message</p>
                </div>
                <Switch
                  checked={!hideDisclaimer}
                  onCheckedChange={(c) => setGeminiFeature('hideDisclaimer', !c)}
                />
              </div>
            </div>
          </div>

          {/* Footer Decoration */}
          <div className="mt-6 flex justify-center">
            <div className="h-1 w-12 rounded-full bg-border/40" />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

