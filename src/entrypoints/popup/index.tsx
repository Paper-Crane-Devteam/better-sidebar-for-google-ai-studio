import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '@/shared/lib/iconify-bundle';
import '@/index.scss';
import '@/locale/i18n';
import { initPegasusTransport } from '@webext-pegasus/transport/popup';
import { getPegasusStoreReady, usePegasusStore } from '@/shared/lib/pegasus-store';
import { useI18n } from '@/shared/hooks/useI18n';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { Platform, PLATFORM_CONFIG, detectPlatform } from '@/shared/types/platform';
import {
  getPlatformEnabledState,
  setPlatformEnabled,
  PlatformEnabledState,
} from '@/shared/lib/platform-enabled-store';
import { cn } from '@/shared/lib/utils/utils';
import { SlidersHorizontal, Settings2, Globe2, Bot } from 'lucide-react';
import { browser } from 'wxt/browser';
import { themeRegistry, refreshThemeRegistry } from '@/themes';

type Tab = 'platforms' | 'gemini' | 'aistudio';

// Debounce utility
function useDebouncedCallback<T extends (...args: any[]) => any>(fn: T, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]) as T;
}

// Slider with local state + debounced store write
function DebouncedSlider({ value, min, max, step = 1, onChange }: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  const debouncedOnChange = useDebouncedCallback(onChange, 200);

  return (
    <input
      type="range"
      min={min} max={max} step={step}
      value={local}
      onChange={(e) => {
        const v = Number(e.target.value);
        setLocal(v);
        debouncedOnChange(v);
      }}
      className="ui-slider w-full"
    />
  );
}

const Options = () => {
  const { t } = useI18n();
  const [enabledState, setEnabledState] = useState<PlatformEnabledState | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('platforms');
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>(Platform.UNKNOWN);

  const theme = usePegasusStore((state) => state.theme);
  const customTheme = usePegasusStore((state) => state.customTheme);

  const geminiSettings = usePegasusStore((s) => s.enhancedFeatures.gemini);
  const aistudioSettings = usePegasusStore((s) => s.enhancedFeatures.aistudio);
  const setGeminiFeature = usePegasusStore((s) => s.setGeminiEnhancedFeature);
  const setAIStudioFeature = usePegasusStore((s) => s.setAIStudioEnhancedFeature);

  // Apply theme: base platform theme class + dark mode + custom theme overrides
  useEffect(() => {
    const root = document.documentElement;

    // Always apply the platform base theme class so default CSS variables are available
    root.classList.add('theme-gemini');

    refreshThemeRegistry();

    if (customTheme && themeRegistry[customTheme]) {
      const preset = themeRegistry[customTheme];
      // Force dark/light based on the custom theme's preferred mode
      if (preset.preferredMode === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      // Apply sidebarVariables (same ones used for the overlay panel)
      if (preset.sidebarVariables) {
        for (const v of preset.sidebarVariables) {
          root.style.setProperty(v.property, v.value);
        }
      }
    } else {
      // No custom theme â€?clear any previously set variable overrides
      root.style.cssText = '';
      // Fall back to user's light/dark preference
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  }, [theme, customTheme]);

  useEffect(() => {
    getPlatformEnabledState().then(setEnabledState);
  }, []);

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const url = tabs[0]?.url;
      if (url) {
        try {
          const hostname = new URL(url).hostname;
          const detected = detectPlatform(hostname);
          setDetectedPlatform(detected);
          if (detected === Platform.GEMINI) {
            setActiveTab('gemini');
          } else if (detected === Platform.AI_STUDIO) {
            setActiveTab('aistudio');
          }
        } catch (e) {}
      }
    });
  }, []);

  const togglePlatform = async (platform: Platform, enabled: boolean) => {
    if (!enabledState) return;
    setEnabledState((prev) => (prev ? { ...prev, [platform]: enabled } : null));
    await setPlatformEnabled(platform, enabled);
  };

  if (!enabledState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground animate-pulse">
        {t('common.loading')}
      </div>
    );
  }

  const platformsToConfigure = [Platform.AI_STUDIO, Platform.GEMINI];

  return (
    <div className="w-[420px] h-[600px] flex flex-col bg-background text-foreground overflow-hidden font-sans selection:bg-primary/30">
      <div className="absolute top-0 left-0 w-full h-[400px] pointer-events-none overflow-hidden z-0 select-none">
        <div className="absolute -top-[100px] -left-[80px] w-[300px] h-[300px] rounded-full bg-primary/5 blur-[80px]" />
        <div className="absolute top-[20px] -right-[100px] w-[350px] h-[350px] rounded-full bg-primary/5 blur-[90px]" />
      </div>

      {/* Header */}
      <div className="relative z-10 w-full flex-shrink-0 flex flex-col items-center pt-6 pb-4 space-y-4 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-primary shadow-md flex items-center justify-center shrink-0">
            <img src="/icons/icon128.png" className="w-6 h-6 object-contain drop-shadow-sm" alt="Logo" />
          </div>
          <h1 className="text-base font-bold tracking-tight text-foreground leading-tight">
            {t('popup.title')}
          </h1>
        </div>

        <div className="flex bg-muted/50 p-1 rounded-lg w-[85%]">
          <button
            onClick={() => setActiveTab('platforms')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-all duration-200",
              activeTab === 'platforms' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Globe2 className="w-4 h-4" />
            {t('popup.platforms')}
          </button>
          
          {(detectedPlatform === Platform.GEMINI || activeTab === 'gemini') && (
            <button
              onClick={() => setActiveTab('gemini')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-all duration-200",
                activeTab === 'gemini' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Settings2 className="w-4 h-4" />
              {t('geminiUI.title')}
            </button>
          )}

          {(detectedPlatform === Platform.AI_STUDIO || activeTab === 'aistudio') && (
            <button
              onClick={() => setActiveTab('aistudio')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-all duration-200",
                activeTab === 'aistudio' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Bot className="w-4 h-4" />
              AI Studio
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {activeTab === 'platforms' && (
          <div className="w-full bg-card/60 backdrop-blur-xl rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs text-muted-foreground">{t('popup.description')}</p>
            </div>
            <div className="flex flex-col">
              {platformsToConfigure.map((platform) => {
                const config = PLATFORM_CONFIG[platform];
                if (!config) return null;
                const isSupported = config.supported !== false;
                const isEnabled = enabledState[platform as keyof PlatformEnabledState] ?? true;
                const platformColorStr = config.color;

                return (
                  <div
                    key={platform}
                    className={cn(
                      'group flex items-center justify-between p-4 transition-all duration-300 relative',
                      !isSupported ? 'bg-muted/10 opacity-60 grayscale' : isEnabled ? 'bg-transparent hover:bg-muted/10' : 'bg-muted/5 opacity-75 grayscale-[20%]'
                    )}
                  >
                    <a
                      href={isSupported ? config.urlPattern : undefined}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        'flex items-center gap-3 flex-1 min-w-0 pr-4 transition-opacity',
                        isSupported ? 'cursor-pointer hover:opacity-80' : 'cursor-default pointer-events-none'
                      )}
                      onClick={(e) => !isSupported && e.preventDefault()}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden shrink-0',
                        isSupported && isEnabled ? 'bg-background shadow-sm scale-100' : 'bg-muted/50 scale-[0.98]'
                      )}>
                        {isSupported && isEnabled && (
                          <div className="absolute inset-0 opacity-15 dark:opacity-20" style={{ backgroundColor: platformColorStr }} />
                        )}
                        <img src={config.icon} alt={config.name} className="w-5 h-5 relative z-10" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate group-hover:underline underline-offset-2 decoration-foreground/30">{config.name}</span>
                          {!isSupported && <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-muted text-muted-foreground uppercase leading-none">{t('onboarding.comingSoon')}</span>}
                        </div>
                        <span className="text-xs text-muted-foreground truncate mt-1">{config.hostname}</span>
                      </div>
                    </a>
                    <Switch
                      checked={isSupported ? isEnabled : false}
                      disabled={!isSupported}
                      onCheckedChange={(c) => isSupported && togglePlatform(platform, c)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'gemini' && (
          <div className="space-y-6 pb-4">
            {!geminiSettings ? (
              <div className="text-sm text-muted-foreground text-center py-8">{t('common.loading')}</div>
            ) : (
              <>
                {/* Layout Dimensions */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">{t('geminiUI.layoutDimensions')}</h3>
                  </div>
                  <div className="bg-card/40 rounded-xl p-4 space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">{t('geminiUI.sidebarWidth')}</Label>
                        <span className="text-[10px] font-mono font-medium text-primary bg-primary/10 px-2 py-1 rounded leading-none">{geminiSettings.sidebarWidth}px</span>
                      </div>
                      <DebouncedSlider value={geminiSettings.sidebarWidth} min={300} max={550} onChange={(v) => setGeminiFeature('sidebarWidth', v)} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">{t('geminiUI.chatContentWidth')}</Label>
                        <span className="text-[10px] font-mono font-medium text-primary bg-primary/10 px-2 py-1 rounded leading-none">{geminiSettings.chatWidth}%</span>
                      </div>
                      <DebouncedSlider value={geminiSettings.chatWidth} min={40} max={100} onChange={(v) => setGeminiFeature('chatWidth', v)} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">{t('geminiUI.inputBoxWidth')}</Label>
                        <span className="text-[10px] font-mono font-medium text-primary bg-primary/10 px-2 py-1 rounded leading-none">{geminiSettings.inputWidth}%</span>
                      </div>
                      <DebouncedSlider value={geminiSettings.inputWidth} min={40} max={100} onChange={(v) => setGeminiFeature('inputWidth', v)} />
                    </div>
                  </div>
                </div>

                {/* Element Visibility */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Globe2 className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">{t('geminiUI.elementVisibility')}</h3>
                  </div>
                  <div className="bg-card/40 rounded-xl">
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('geminiUI.aiDisclaimer')}</Label>
                        <p className="text-xs text-muted-foreground">{t('geminiUI.aiDisclaimerDesc')}</p>
                      </div>
                      <Switch checked={!geminiSettings.hideDisclaimer} onCheckedChange={(c) => setGeminiFeature('hideDisclaimer', !c)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('geminiUI.upgradeButton')}</Label>
                        <p className="text-xs text-muted-foreground">{t('geminiUI.upgradeButtonDesc')}</p>
                      </div>
                      <Switch checked={!geminiSettings.hideUpgrade} onCheckedChange={(c) => setGeminiFeature('hideUpgrade', !c)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('geminiUI.hotkeyHelper')}</Label>
                        <p className="text-xs text-muted-foreground">{t('geminiUI.hotkeyHelperDesc')}</p>
                      </div>
                      <Switch checked={geminiSettings.showHotkeyHelper} onCheckedChange={(c) => setGeminiFeature('showHotkeyHelper', c)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                  </div>
                </div>

                {/* Additional Features */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">{t('geminiUI.additionalFeatures')}</h3>
                  </div>
                  <div className="bg-card/40 rounded-xl">
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('geminiUI.zenMode')}</Label>
                        <p className="text-xs text-muted-foreground">{t('geminiUI.zenModeDesc')}</p>
                      </div>
                      <Switch checked={geminiSettings.zenMode} onCheckedChange={(c) => setGeminiFeature('zenMode', c)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('geminiUI.removeAutoWatermark')}</Label>
                        <p className="text-xs text-muted-foreground">{t('geminiUI.removeAutoWatermarkDesc')}</p>
                      </div>
                      <Switch checked={geminiSettings.removeWatermark} onCheckedChange={(c) => setGeminiFeature('removeWatermark', c)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('geminiUI.smartScrollbar')}</Label>
                        <p className="text-xs text-muted-foreground">{t('geminiUI.smartScrollbarDesc')}</p>
                      </div>
                      <Switch checked={geminiSettings.showSmartScrollbar} onCheckedChange={(c) => setGeminiFeature('showSmartScrollbar', c)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('geminiUI.autoHideInput')}</Label>
                        <p className="text-xs text-muted-foreground">{t('geminiUI.autoHideInputDesc')}</p>
                      </div>
                      <Switch checked={geminiSettings.autoHideInput} onCheckedChange={(c) => setGeminiFeature('autoHideInput', c)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('geminiUI.slashCommand')}</Label>
                        <p className="text-xs text-muted-foreground">{t('geminiUI.slashCommandDesc')}</p>
                      </div>
                      <Switch checked={geminiSettings.slashCommand} onCheckedChange={(c) => setGeminiFeature('slashCommand', c)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'aistudio' && (
          <div className="space-y-6 pb-4">
            {!aistudioSettings ? (
              <div className="text-sm text-muted-foreground text-center py-8">{t('common.loading')}</div>
            ) : (
              <>
                {/* Layout Dimensions */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">{t('aistudioUI.layoutDimensions')}</h3>
                  </div>
                  <div className="bg-card/40 rounded-xl p-4 space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">{t('aistudioUI.sidebarWidth')}</Label>
                        <span className="text-[10px] font-mono font-medium text-primary bg-primary/10 px-2 py-1 rounded leading-none">{aistudioSettings.sidebarWidth}px</span>
                      </div>
                      <DebouncedSlider value={aistudioSettings.sidebarWidth} min={280} max={500} onChange={(v) => setAIStudioFeature('sidebarWidth', v)} />
                    </div>
                  </div>
                </div>

                {/* Additional Features */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">{t('aistudioUI.additionalFeatures')}</h3>
                  </div>
                  <div className="bg-card/40 rounded-xl">
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('aistudioUI.autoHideInput')}</Label>
                        <p className="text-xs text-muted-foreground">{t('aistudioUI.autoHideInputDesc')}</p>
                      </div>
                      <Switch checked={aistudioSettings.autoHideInput} onCheckedChange={(c) => setAIStudioFeature('autoHideInput', c)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('aistudioUI.autoHideRunSettings')}</Label>
                        <p className="text-xs text-muted-foreground">{t('aistudioUI.autoHideRunSettingsDesc')}</p>
                      </div>
                      <Switch checked={aistudioSettings.autoHideRunSettings} onCheckedChange={(c) => setAIStudioFeature('autoHideRunSettings', c)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('aistudioUI.slashCommand')}</Label>
                        <p className="text-xs text-muted-foreground">{t('aistudioUI.slashCommandDesc')}</p>
                      </div>
                      <Switch checked={aistudioSettings.slashCommand} onCheckedChange={(c) => setAIStudioFeature('slashCommand', c)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('aistudioUI.hotkeyHelper')}</Label>
                        <p className="text-xs text-muted-foreground">{t('aistudioUI.hotkeyHelperDesc')}</p>
                      </div>
                      <Switch checked={aistudioSettings.showHotkeyHelper} onCheckedChange={(c) => setAIStudioFeature('showHotkeyHelper', c)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 flex-shrink-0 text-center py-2 bg-background/80 backdrop-blur-sm">
        <p className="text-[10px] text-muted-foreground font-medium tracking-wide">
          {t('footer.madeWith')}
        </p>
      </div>
    </div>
  );
};

// Initialize Pegasus transport and wait for store sync before rendering
initPegasusTransport();
getPegasusStoreReady().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Options />
    </React.StrictMode>,
  );
});
