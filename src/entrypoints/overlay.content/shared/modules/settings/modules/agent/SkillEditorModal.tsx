/**
 * SkillEditorModal — Create/edit a custom skill.
 *
 * Rendered inside the app-wide GlobalModal (see `@/shared/components/GlobalModal`)
 * instead of a local drawer, so it always sits above the settings panel and
 * reuses the shared header/footer chrome.
 */

import React, { useState } from 'react';
import { useModalStore, modal } from '@/shared/lib/modal';
import i18n from '@/locale/i18n';
import { useAgentConfigStore } from '../../../agent-loop/agent-config-store';
import type { Skill } from '../../../agent-loop/skills/types';

interface FormData {
  title: string;
  description: string;
  icon: string;
  promptContent: string;
}

/** Imperative bridge between the modal footer buttons and the form state. */
interface SkillFormHandle {
  /** Validates and persists. Returns true when the modal may close. */
  submit: () => boolean;
  /** Whether the user changed anything since opening. */
  isDirty: () => boolean;
}

const TITLE_MAX = 50;
const DESCRIPTION_MAX = 200;
const PROMPT_MAX = 5000;

const inputClass =
  'w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground ' +
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const SkillEditorForm: React.FC<{
  skill?: Skill;
  handleRef: { current: SkillFormHandle | null };
}> = ({ skill, handleRef }) => {
  const [form, setForm] = useState<FormData>({
    title: skill?.title || '',
    description: skill?.description || '',
    icon: skill?.icon || 'Sparkles',
    promptContent: skill?.promptContent || '',
  });
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.title.trim()) newErrors.title = i18n.t('agent.settings.titleRequired');
    if (!form.description.trim()) newErrors.description = i18n.t('agent.settings.descriptionRequired');
    if (!form.promptContent.trim()) newErrors.promptContent = i18n.t('agent.settings.promptRequired');
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return false;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      icon: form.icon,
      promptContent: form.promptContent.trim(),
    };
    const store = useAgentConfigStore.getState();
    if (skill) {
      store.updateCustomSkill(skill.id, payload);
    } else {
      store.addCustomSkill(payload);
    }
    return true;
  };

  // Expose the latest closure to the modal footer handlers.
  handleRef.current = { submit, isDirty: () => dirty };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">
          {i18n.t('agent.settings.skillTitle')} <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => handleChange('title', e.target.value.slice(0, TITLE_MAX))}
          placeholder={i18n.t('agent.settings.skillTitlePlaceholder')}
          className={inputClass}
        />
        {errors.title && <p className="text-[10px] text-destructive">{errors.title}</p>}
        <p className="text-[10px] text-muted-foreground">
          {form.title.length}/{TITLE_MAX}
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">
          {i18n.t('agent.settings.skillDescription')} <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value.slice(0, DESCRIPTION_MAX))}
          placeholder={i18n.t('agent.settings.skillDescriptionPlaceholder')}
          className={inputClass}
        />
        {errors.description && (
          <p className="text-[10px] text-destructive">{errors.description}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {form.description.length}/{DESCRIPTION_MAX}
        </p>
      </div>

      {/* Prompt content */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">
          {i18n.t('agent.settings.skillPrompt')} <span className="text-destructive">*</span>
        </label>
        <textarea
          value={form.promptContent}
          onChange={(e) => handleChange('promptContent', e.target.value.slice(0, PROMPT_MAX))}
          placeholder={i18n.t('agent.settings.skillPromptPlaceholder')}
          rows={12}
          className={`${inputClass} text-xs font-mono resize-none`}
        />
        {errors.promptContent && (
          <p className="text-[10px] text-destructive">{errors.promptContent}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {form.promptContent.length}/{PROMPT_MAX}
        </p>
      </div>
    </div>
  );
};

/**
 * Open the skill editor in the global modal.
 * Pass a skill to edit it, or nothing to create a new one.
 */
export function openSkillEditorModal(skill?: Skill): void {
  const handleRef: { current: SkillFormHandle | null } = { current: null };

  useModalStore.getState().open({
    type: 'confirm',
    title: skill ? i18n.t('agent.settings.editSkill') : i18n.t('agent.settings.newSkill'),
    content: <SkillEditorForm skill={skill} handleRef={handleRef} />,
    confirmText: i18n.t('common.save'),
    cancelText: i18n.t('common.cancel'),
    modalClassName: 'max-w-2xl',
    onConfirm: () => {
      if (handleRef.current?.submit()) {
        useModalStore.getState().close();
      }
    },
    onCancel: async () => {
      if (handleRef.current?.isDirty()) {
        const discard = await modal.confirm({
          title: i18n.t('agent.settings.discardTitle'),
          content: i18n.t('agent.settings.discardContent'),
          confirmText: i18n.t('agent.settings.discard'),
          destructive: true,
        });
        if (!discard) return;
      }
      useModalStore.getState().close();
    },
  });
}
