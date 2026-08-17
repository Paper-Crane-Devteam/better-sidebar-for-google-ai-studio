/**
 * SkillEditorDrawer — Create/edit skill form.
 * Slides in from the right, overlaying the settings content.
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useAgentConfigStore } from '../../../agent-loop/agent-config-store';
import type { Skill } from '../../../agent-loop/skills/types';

interface SkillEditorDrawerProps {
  skill?: Skill;
  onSave: () => void;
  onClose: () => void;
}

interface FormData {
  title: string;
  description: string;
  icon: string;
  promptContent: string;
}

export const SkillEditorDrawer: React.FC<SkillEditorDrawerProps> = ({
  skill,
  onSave,
  onClose,
}) => {
  const [form, setForm] = useState<FormData>({
    title: skill?.title || '',
    description: skill?.description || '',
    icon: skill?.icon || 'Sparkles',
    promptContent: skill?.promptContent || '',
  });
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const { addCustomSkill, updateCustomSkill } = useAgentConfigStore();

  useEffect(() => {
    setDirty(false);
  }, [skill?.id]);

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.title.trim()) newErrors.title = 'Title is required';
    if (!form.description.trim()) newErrors.description = 'Description is required';
    if (!form.promptContent.trim()) newErrors.promptContent = 'Prompt content is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    if (skill) {
      updateCustomSkill(skill.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        icon: form.icon,
        promptContent: form.promptContent.trim(),
      });
    } else {
      addCustomSkill({
        title: form.title.trim(),
        description: form.description.trim(),
        icon: form.icon,
        promptContent: form.promptContent.trim(),
      });
    }
    onSave();
  };

  const handleClose = () => {
    if (dirty) {
      if (!confirm('Discard unsaved changes?')) return;
    }
    onClose();
  };

  return (
    <div className="absolute inset-0 z-10 bg-background flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-sm font-semibold">
          {skill ? 'Edit Skill' : 'New Skill'}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">
            Title <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value.slice(0, 50))}
            placeholder="e.g. Organize by Topic"
            className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm
                       placeholder:text-muted-foreground focus-visible:outline-none
                       focus-visible:ring-1 focus-visible:ring-ring"
          />
          {errors.title && <p className="text-[10px] text-destructive">{errors.title}</p>}
          <p className="text-[10px] text-muted-foreground">{form.title.length}/50</p>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">
            Description <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value.slice(0, 200))}
            placeholder="Brief description of what this skill does"
            className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm
                       placeholder:text-muted-foreground focus-visible:outline-none
                       focus-visible:ring-1 focus-visible:ring-ring"
          />
          {errors.description && (
            <p className="text-[10px] text-destructive">{errors.description}</p>
          )}
          <p className="text-[10px] text-muted-foreground">{form.description.length}/200</p>
        </div>

        {/* Prompt Content */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">
            Prompt Content <span className="text-destructive">*</span>
          </label>
          <textarea
            value={form.promptContent}
            onChange={(e) => handleChange('promptContent', e.target.value.slice(0, 5000))}
            placeholder={`## Task: Your task name\n\nDescribe what this skill does and how the AI should approach it.\n\nTips:\n- Start with understanding the current state\n- Explain your plan before executing\n- ...`}
            rows={12}
            className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-xs
                       font-mono placeholder:text-muted-foreground focus-visible:outline-none
                       focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
          {errors.promptContent && (
            <p className="text-[10px] text-destructive">{errors.promptContent}</p>
          )}
          <p className="text-[10px] text-muted-foreground">{form.promptContent.length}/5000</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-4 py-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={handleClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
};
