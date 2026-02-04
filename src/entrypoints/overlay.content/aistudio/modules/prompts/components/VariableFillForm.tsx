import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { useI18n } from '@/shared/hooks/useI18n';

export interface VariableFillFormRef {
  getValues(): Record<string, string>;
}

interface VariableFillFormProps {
  variables: string[];
}

export const VariableFillForm = forwardRef<VariableFillFormRef, VariableFillFormProps>(
  function VariableFillForm({ variables }, ref) {
    const { t } = useI18n();
    const [values, setValues] = useState<Record<string, string>>(() => {
      const init: Record<string, string> = {};
      variables.forEach((v) => (init[v] = ''));
      return init;
    });
    const valuesRef = useRef(values);
    valuesRef.current = values;

    useImperativeHandle(ref, () => ({
      getValues() {
        return { ...valuesRef.current };
      },
    }));

    return (
      <div className="space-y-4 text-sm text-muted-foreground text-left">
        <p className="leading-relaxed">{t('prompts.fillVariablesIntro')}</p>
        <div className="grid gap-3">
          {variables.map((name) => (
            <div key={name} className="grid gap-1.5">
              <Label
                htmlFor={`var-${name}`}
                className="text-foreground font-medium"
              >
                {name}
              </Label>
              <Input
                id={`var-${name}`}
                value={values[name] ?? ''}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [name]: e.target.value }))
                }
                placeholder={t('prompts.variablePlaceholder')}
                className="text-foreground"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
);
