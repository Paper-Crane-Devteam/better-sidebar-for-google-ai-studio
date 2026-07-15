/**
 * ExecutionHistorySection — Collapsible history list (reverse chronological, expandable details) + undo button.
 */

import React, { useState, useMemo } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { useAgentLoopStore } from '../agent-loop-store';
import { agentEventBus } from '../event-bus';

export const ExecutionHistorySection: React.FC = () => {
  const currentResults = useAgentLoopStore((s) => s.currentResults);
  const history = useAgentLoopStore((s) => s.history);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const snapshotCreated = useAgentLoopStore((s) => s.snapshotCreated);
  const [open, setOpen] = useState(true);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [undoStatus, setUndoStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const allResults = useMemo(() => {
    const items = [
      ...currentResults.map((r) => ({ ...r, round: currentRound })),
      ...history.flatMap((h) => h.results.map((r) => ({ ...r, round: h.round }))),
    ];
    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  }, [currentResults, history, currentRound]);

  // Check if undo is possible
  const lastResult = currentResults[currentResults.length - 1];
  const canUndo =
    snapshotCreated &&
    lastResult &&
    lastResult.toolName === 'execute_sql' &&
    lastResult.success;

  const handleUndo = async () => {
    agentEventBus.emit('control:undo-requested', undefined);
    try {
      const { restoreSnapshot } = await import('../snapshot/snapshot-manager');
      await restoreSnapshot('latest');
      useAgentLoopStore.getState().removeLastResult();
      useAgentLoopStore.getState().setPendingInstruction(
        '[SYSTEM] 上一步操作已被用户撤销，数据库已恢复到执行前的状态。请注意之前的操作结果不再有效。',
      );
      setUndoStatus('success');
      agentEventBus.emit('control:undo-completed', { success: true });
      setTimeout(() => setUndoStatus('idle'), 3000);
    } catch (e) {
      const error = (e as Error).message;
      setUndoStatus('error');
      agentEventBus.emit('control:undo-completed', { success: false, error });
      setTimeout(() => setUndoStatus('idle'), 3000);
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Math.round((Date.now() - timestamp) / 1000);
    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.round(diff / 60)}分钟前`;
    return `${Math.round(diff / 3600)}小时前`;
  };

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex w-full items-center justify-between py-1">
        <span className="text-xs font-medium text-foreground">执行历史</span>
        <span className="text-[10px] text-muted-foreground">
          本轮已执行 {currentResults.length} 个工具
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content>
        {/* Undo button */}
        <div className="mt-2 mb-2">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            title={!canUndo ? (snapshotCreated ? '该操作不可撤销' : '无可用快照') : undefined}
            className="rounded-md border border-border px-2 py-1 text-[10px] font-medium text-foreground
                       hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            撤销上一步
          </button>
          {undoStatus === 'success' && (
            <span className="ml-2 text-[10px] text-green-500">✓ 已撤销</span>
          )}
          {undoStatus === 'error' && (
            <span className="ml-2 text-[10px] text-destructive">恢复失败</span>
          )}
        </div>

        {allResults.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">暂无执行记录</p>
        ) : (
          <div className="max-h-[200px] space-y-1 overflow-y-auto">
            {allResults.map((result, i) => (
              <div key={i}>
                <button
                  onClick={() => setExpandedItem(expandedItem === i ? null : i)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] ${result.success ? 'text-green-500' : 'text-destructive'}`}>
                      {result.success ? '✓' : '✗'}
                    </span>
                    <span className="text-xs text-foreground">{result.toolName}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(result.timestamp)}
                  </span>
                </button>
                {expandedItem === i && (
                  <div className="ml-4 mt-1 rounded border border-border bg-muted/30 p-2">
                    <pre className="whitespace-pre-wrap text-[10px] font-mono text-muted-foreground">
                      {result.result.length > 300
                        ? result.result.slice(0, 300) + '...'
                        : result.result}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
