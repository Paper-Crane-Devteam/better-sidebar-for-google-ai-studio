/**
 * AgentUserPrompt — the AI is asking, and the loop is parked until it gets an answer.
 *
 * Distinct from AgentConfirmation on purpose. That one gates a single operation and
 * the user can switch it off; this one is a decision only they can make, so there is
 * no "always allow". Approving a plan here grants no execution permission — the
 * write confirmation still runs on its own terms.
 *
 * The same question is also visible in the chat, and answering there works too: the
 * engine watches for that and catches up. This panel is the convenient path, not the
 * only one.
 */

import React, { useState } from 'react';
import { MessageCircleQuestion, Send } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { getActiveEngine } from '../../agent-loop/engine/engine-registry';

const MAX_LENGTH = 2000;

export const AgentUserPrompt: React.FC = () => {
  const { t } = useI18n();
  const pendingQuestion = useAgentLoopStore((s) => s.pendingQuestion);
  const [value, setValue] = useState('');

  if (!pendingQuestion) return null;

  const { question, options, allowFreeText, resolve } = pendingQuestion;

  const answer = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setValue('');
    resolve(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      answer(value);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="h-3 w-3 shrink-0 text-primary" />
        <span className="text-xs font-medium text-foreground">
          {t('agent.ask.title', { defaultValue: 'The agent needs your input' })}
        </span>
      </div>

      {/* Salvaged prose questions can be long, so this scrolls rather than pushing
          the answer controls out of view. */}
      <p className="max-h-[200px] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground">
        {question}
      </p>

      {options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option}
              size="sm"
              variant="outline"
              className="h-7 max-w-full text-xs"
              onClick={() => answer(option)}
            >
              <span className="truncate">{option}</span>
            </Button>
          ))}
        </div>
      )}

      {allowFreeText && (
        <div className="flex items-end gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder={
              options.length > 0
                ? t('agent.ask.placeholderOther', { defaultValue: 'Or answer in your own words...' })
                : t('agent.ask.placeholder', { defaultValue: 'Type your answer...' })
            }
            rows={2}
            autoFocus
            className="flex-1 resize-none rounded-md border border-border/50 bg-background px-2 py-1
                       text-xs text-foreground placeholder:text-muted-foreground
                       transition-colors focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <Button
            size="sm"
            className="h-7 shrink-0 gap-1 text-xs"
            disabled={!value.trim()}
            onClick={() => answer(value)}
          >
            <Send className="h-3 w-3" />
            {t('agent.ask.send', { defaultValue: 'Answer' })}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {t('agent.ask.chatHint', {
            defaultValue: 'You can also just reply in the chat input.',
          })}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 shrink-0 text-xs text-muted-foreground"
          onClick={() => {
            // Stop the engine, not just the question: it owns the abort token and
            // the pending wait, so resolving alone would leave the loop running.
            const engine = getActiveEngine();
            if (engine) engine.stop();
            else resolve(null);
          }}
        >
          {t('agent.ask.stop', { defaultValue: 'Stop task' })}
        </Button>
      </div>
    </div>
  );
};
