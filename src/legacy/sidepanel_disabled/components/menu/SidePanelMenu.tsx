import React from 'react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { useI18n } from '@/shared/hooks/useI18n';
import { MoreVertical, Globe, Settings, Database } from 'lucide-react';

interface SidePanelMenuProps {
  onScanLibrary: () => void;
  onOpenSql: () => void;
  onOpenSettings: () => void;
  onReset: () => void;
  isScanning?: boolean;
}

export const SidePanelMenu = ({ onScanLibrary, onOpenSql, onOpenSettings, onReset, isScanning }: SidePanelMenuProps) => {
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SimpleTooltip content={t('tooltip.more')}>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </SimpleTooltip>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onScanLibrary} disabled={isScanning}>
          <Globe className="mr-2 h-4 w-4" />
          <span>{isScanning ? t('menu.scanning') : t('menu.scanChatList')}</span>
        </DropdownMenuItem>
        {import.meta.env.DEV && (
          <>
            <DropdownMenuItem onClick={onOpenSql}>
              <Database className="mr-2 h-4 w-4" />
              <span>{t('menu.sqlQuery')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReset} className="text-red-600 focus:text-red-600">
              <Database className="mr-2 h-4 w-4" />
              <span>{t('modal.resetDatabase')}</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenSettings}>
          <Settings className="mr-2 h-4 w-4" />
          <span>{t('menu.settings')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

