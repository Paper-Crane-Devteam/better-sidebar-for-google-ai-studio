import React, { useEffect, useState } from 'react';
import { useI18n } from '@/shared/hooks/useI18n';

interface CreateSnippetFormProps {
  formRef: React.RefObject<HTMLFormElement | null>;
  initialValues?: { title: string; content: string };
  onChange?: (data: { title: string; content: string }) => void;
  onValidSubmit?: () => void;
}

export const CreateSnippetForm = ({
  formRef,
  initialValues,
  onChange,
  onValidSubmit,
}: CreateSnippetFormProps) => {
  const { t } = useI18n();
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [content, setContent] = useState(initialValues?.content ?? '');

  useEffect(() => {
    onChange?.({ title, content });
  }, [title, content]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onValidSubmit?.();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-medium text-foreground">
          {t('snippets.title')}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          placeholder={t('snippets.titlePlaceholder')}
          autoFocus
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">
          {t('snippets.content')}
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring min-h-[280px] resize-y"
          placeholder={t('snippets.contentPlaceholder')}
        />
      </div>
    </form>
  );
};
