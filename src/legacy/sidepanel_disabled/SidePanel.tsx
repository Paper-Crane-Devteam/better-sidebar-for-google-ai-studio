import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/shared/lib/store';
import { Button } from '@/shared/components/ui/button';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { RefreshCw, MessageSquarePlus, FolderPlus, ListCollapse, Loader2, ArrowDownAZ, Clock } from 'lucide-react';
import { SidePanelMenu } from './components/menu/SidePanelMenu';
import { SqlExecutor } from './components/menu/SqlExecutor';
import { ArboristTree, ArboristTreeHandle } from './components/tree-view/ArboristTree';
import { modal } from '@/shared/lib/modal';
import { useI18n } from '@/shared/hooks/useI18n';
import '@/index.css';

export const SidePanel = ({ className }: { className?: string }) => {
  const { t } = useI18n();
  const { folders, conversations, fetchData, isLoading, createFolder } = useAppStore();
  const [showSqlInterface, setShowSqlInterface] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [sortOrder, setSortOrder] = useState<'alpha' | 'date'>('alpha');
  const treeRef = useRef<ArboristTreeHandle>(null);

  useEffect(() => {
    // Theme sync
    const applyTheme = (theme: string) => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    // Initial check
    browser.storage.local.get(['theme'], (result) => {
      if (result.theme) {
        applyTheme(result.theme as string);
      }
    });

    // Listener for changes
    const changeListener = (changes: {
      [key: string]: Browser.storage.StorageChange;
    }) => {
      if (changes.theme) {
        applyTheme(changes.theme.newValue as string);
      }
    };
    browser.storage.onChanged.addListener(changeListener);

    fetchData();

    browser.storage.local.get(['sidepanel_sort_order'], (result) => {
      if (result.sidepanel_sort_order) {
        setSortOrder(result.sidepanel_sort_order as 'alpha' | 'date');
      }
    });

    // Listen for updates from background script
    const listener = (message: any) => {
      if (message.type === 'DATA_UPDATED') {
        console.log('Received DATA_UPDATED signal, refreshing...');
        fetchData(true);
        setIsScanning(false);
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => {
        browser.runtime.onMessage.removeListener(listener);
        browser.storage.onChanged.removeListener(changeListener);
    };
  }, []);

  const handleGlobalScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    console.log("Global Scan triggered");
    browser.runtime.sendMessage({ type: 'SCAN_LIBRARY' });
  };

  const handleSelect = (nodes: any[]) => {
    if (nodes.length > 0) {
        const node = nodes[0];
        setSelectedNode(node);
        // Handle file click action
        if (node.data.type === 'file' && node.data.data?.external_url) {
             browser.runtime.sendMessage({ 
                 type: 'OPEN_URL', 
                 payload: { url: node.data.data.external_url } 
             });
        }
    } else {
        setSelectedNode(null);
    }
  };

  const handleNewFolder = async () => {
      let parentId: string | null = null;
      if (selectedNode) {
          // If folder selected, create INSIDE it
          if (selectedNode.data.type === 'folder') {
              parentId = selectedNode.data.id;
          } else {
              // If file selected, create as SIBLING (same parent)
              const item = selectedNode.data.data;
              parentId = item.folder_id || null;
          }
      }
      const newFolderId = await createFolder(t('sidebar.newFolder'), parentId);
      if (newFolderId) {
          // Wait a bit for the tree to render the new node
          setTimeout(() => {
              treeRef.current?.edit(newFolderId);
          }, 100);
      }
  };

  const handleNewChat = async () => {
      const url = 'https://aistudio.google.com/prompts/new_chat';
      browser.runtime.sendMessage({ 
          type: 'OPEN_URL', 
          payload: { url } 
      });
  };

  const handleCollapseAll = () => {
      treeRef.current?.collapseAll();
  };

  const handleReset = async () => {
    const confirmed = await modal.confirm({
      title: t('modal.resetDatabase'),
      content: t('modal.resetDatabaseConfirm'),
      confirmText: t('modal.reset'),
      cancelText: t('common.cancel')
    });
    if (!confirmed) return;
    await browser.runtime.sendMessage({ type: 'RESET_DATABASE' });
    fetchData();
  };

  if (showSqlInterface) {
    return <SqlExecutor onClose={() => setShowSqlInterface(false)} />;
  }

  return (
    <div className={`flex flex-col bg-background text-foreground ${className || 'h-screen'} relative`}>
      {isScanning && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h1 className="font-semibold text-lg">{t('sidebar.aiStudio')}</h1>
        <div className="flex gap-1">
          <SimpleTooltip content={t('sidebar.newConversation')}>
            <Button variant="ghost" size="icon" onClick={handleNewChat}>
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </SimpleTooltip>
          <SimpleTooltip content={t('sidebar.newFolder')}>
            <Button variant="ghost" size="icon" onClick={handleNewFolder}>
              <FolderPlus className="h-4 w-4" />
            </Button>
          </SimpleTooltip>
           <SimpleTooltip content={t('sidebar.collapseAll')}>
            <Button variant="ghost" size="icon" onClick={handleCollapseAll}>
              <ListCollapse className="h-4 w-4" />
            </Button>
          </SimpleTooltip>
          <SimpleTooltip content={sortOrder === 'alpha' ? t('sidebar.sortByDate') : t('sidebar.sortAlphabetically')}>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                const newOrder = sortOrder === 'alpha' ? 'date' : 'alpha';
                setSortOrder(newOrder);
                browser.storage.local.set({ sidepanel_sort_order: newOrder });
              }}
            >
              {sortOrder === 'alpha' ? <ArrowDownAZ className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </Button>
          </SimpleTooltip>
          
          <SidePanelMenu 
            onScanLibrary={handleGlobalScan}
            onOpenSql={() => setShowSqlInterface(true)}
            onOpenSettings={() => console.log('Settings clicked')}
            onReset={handleReset}
            isScanning={isScanning}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {(() => {
          if (isLoading) {
            return <div className="p-4 text-center text-muted-foreground">{t('common.loading')}</div>;
          }
          if (folders.length === 0 && conversations.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center text-muted-foreground gap-4">
                <p>{t('explorer.noConversations')}</p>
                <p>{t('explorer.scanPrompt')}</p>
                <Button onClick={handleGlobalScan} className="gap-2" disabled={isScanning}>
                  {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {isScanning ? t('explorer.scanning') : t('explorer.scanLibrary')}
                </Button>
              </div>
            );
          }
          return <ArboristTree ref={treeRef} onSelect={handleSelect} sortOrder={sortOrder} />;
        })()}
      </div>

    </div>
  );
};
