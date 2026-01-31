import React, { useState } from 'react';
import { useAppStore } from '@/shared/lib/store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Plus } from 'lucide-react';
import { TagItem } from './TagItem';
import { SidePanelMenu } from '../../components/menu/SidePanelMenu';
import { useI18n } from '@/shared/hooks/useI18n';

interface TagsTabProps {}

export const TagsTab = ({}: TagsTabProps) => {
    const { t } = useI18n();
    const { tags, createTag } = useAppStore();
    const [newTagName, setNewTagName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;
        setIsCreating(true);
        await createTag(newTagName.trim());
        setNewTagName('');
        setIsCreating(false);
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="p-3 border-b flex items-center justify-between h-12 shrink-0">
                <h1 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                    {t('tabs.tags')}
                </h1>
                <div className="flex gap-0.5 items-center">
                    <SidePanelMenu />
                </div>
            </div>

            {/* Create Tag Input */}
            <div className="p-3 border-b flex gap-2">
                <Input 
                    placeholder={t('tags.newTagName')} 
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                    maxLength={30}
                    className="h-8 text-sm"
                />
                <Button 
                    size="icon" 
                    variant="secondary" 
                    className="h-8 w-8 shrink-0" 
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || isCreating}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            {/* Tags List */}
            <div className="flex-1 overflow-y-auto p-2">
                <div className="flex flex-col gap-1">
                    {tags.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8 text-sm">
                            {t('tags.noTagsYet')}
                        </div>
                    ) : (
                        tags.map((tag) => (
                            <TagItem key={tag.id} tag={tag} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
