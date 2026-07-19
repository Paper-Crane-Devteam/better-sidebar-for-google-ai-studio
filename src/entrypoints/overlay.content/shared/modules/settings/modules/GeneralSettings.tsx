import React from 'react';
import { Button } from '../../../components/ui/button';
import { Separator } from '../../../components/ui/separator';
import { ChevronDown } from 'lucide-react';
import { Switch } from '@/shared/components/ui/switch';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { useI18n } from '@/shared/hooks/useI18n';
import { detectPlatform, Platform } from '@/shared/types/platform';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

export const GeneralSettings = () => {
  const { t } = useI18n();
  const {
    newChatBehavior,
    setNewChatBehavior,
    shortcuts,
    setShortcutVisible,
  } = useSettingsStore();

  const { language, setLanguage } = usePegasusStore();

  const platform = detectPlatform();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">{t('settings.appearance')}</h3>
        <Separator />
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-medium">
                {t('settings.language')}
              </span>
              <p className="text-xs text-muted-foreground">
                {t('settings.languageDescription')}
              </p>
            </div>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs min-w-[120px] justify-between"
                >
                  <span>
                    {language === 'en' && t('settings.english')}
                    {language === 'zh-CN' && t('settings.chinese')}
                    {language === 'ja' && t('settings.japanese')}
                    {language === 'zh-TW' && t('settings.chineseTraditional')}
                    {language === 'pt' && t('settings.portuguese')}
                    {language === 'es' && t('settings.spanish')}
                    {language === 'ru' && t('settings.russian')}
                  </span>
                  <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[120px]">
                <DropdownMenuRadioGroup
                  value={language}
                  onValueChange={(value) => {
                    if (
                      value === 'zh-CN' ||
                      value === 'zh-TW' ||
                      value === 'en' ||
                      value === 'ja' ||
                      value === 'pt' ||
                      value === 'es' ||
                      value === 'ru'
                    ) {
                      setLanguage(value);
                    }
                  }}
                >
                  <DropdownMenuRadioItem value="en">
                    {t('settings.english')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="zh-CN">
                    {t('settings.chinese')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="ja">
                    {t('settings.japanese')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="zh-TW">
                    {t('settings.chineseTraditional')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="pt">
                    {t('settings.portuguese')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="es">
                    {t('settings.spanish')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="ru">
                    {t('settings.russian')}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">{t('shortcuts.title')}</h3>
        <Separator />
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">
                {t('shortcuts.favorites')}
              </label>
            </div>
            <Switch
              checked={shortcuts?.favorites ?? true}
              onCheckedChange={(c) => setShortcutVisible('favorites', c)}
            />
          </div>
          {platform === Platform.AI_STUDIO && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">
                    {t('shortcuts.build')}
                  </label>
                </div>
                <Switch
                  checked={shortcuts?.build ?? true}
                  onCheckedChange={(c) => setShortcutVisible('build', c)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">
                    {t('shortcuts.dashboard')}
                  </label>
                </div>
                <Switch
                  checked={shortcuts?.dashboard ?? true}
                  onCheckedChange={(c) => setShortcutVisible('dashboard', c)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">
                    {t('shortcuts.documentation')}
                  </label>
                </div>
                <Switch
                  checked={shortcuts?.documentation ?? true}
                  onCheckedChange={(c) =>
                    setShortcutVisible('documentation', c)
                  }
                />
              </div>
            </>
          )}
          {/* ChatGPT shortcuts - temporarily hidden
          {platform === Platform.CHATGPT && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">
                    {t('shortcuts.images')}
                  </label>
                </div>
                <Switch
                  checked={shortcuts?.images ?? true}
                  onCheckedChange={(c) => setShortcutVisible('images', c)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">
                    {t('shortcuts.apps')}
                  </label>
                </div>
                <Switch
                  checked={shortcuts?.apps ?? true}
                  onCheckedChange={(c) => setShortcutVisible('apps', c)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">
                    {t('shortcuts.codex')}
                  </label>
                </div>
                <Switch
                  checked={shortcuts?.codex ?? true}
                  onCheckedChange={(c) => setShortcutVisible('codex', c)}
                />
              </div>
            </>
          )}
          */}
          {platform === Platform.GEMINI && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">
                    {t('shortcuts.myStuff')}
                  </label>
                </div>
                <Switch
                  checked={shortcuts?.myStuff ?? true}
                  onCheckedChange={(c) => setShortcutVisible('myStuff', c)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">
                    {t('shortcuts.gems')}
                  </label>
                </div>
                <Switch
                  checked={shortcuts?.gems ?? true}
                  onCheckedChange={(c) => setShortcutVisible('gems', c)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">
                    {t('shortcuts.notebooks')}
                  </label>
                </div>
                <Switch
                  checked={shortcuts?.notebooks ?? true}
                  onCheckedChange={(c) => setShortcutVisible('notebooks', c)}
                />
              </div>
            </>
          )}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">
                {t('shortcuts.originalUI')}
              </label>
            </div>
            <Switch
              checked={shortcuts?.originalUI ?? true}
              onCheckedChange={(c) => setShortcutVisible('originalUI', c)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">{t('settings.behavior')}</h3>
        <Separator />
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-medium">
                  {t('settings.newChatBehavior')}
                </span>
                <p className="text-xs text-muted-foreground">
                  {t('settings.newChatBehaviorDescription')}
                </p>
              </div>
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border">
                <Button
                  variant={
                    newChatBehavior === 'current-tab' ? 'secondary' : 'ghost'
                  }
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setNewChatBehavior('current-tab')}
                >
                  {t('settings.currentTab')}
                </Button>
                <Button
                  variant={newChatBehavior === 'new-tab' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setNewChatBehavior('new-tab')}
                >
                  {t('settings.newTab')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
