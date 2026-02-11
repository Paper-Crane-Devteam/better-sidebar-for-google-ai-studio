import React from 'react';
import {
  Sparkles,
  MessageSquare,
  FileText,
  Lightbulb,
  BookOpen,
  Code,
  Image,
  Zap,
  Send,
  Copy,
  Star,
  Heart,
  Bookmark,
  PenLine,
  Bot,
  User,
  type LucideIcon,
} from 'lucide-react';

/** Icon name → Lucide component for prompt icon picker */
export const PROMPT_ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  MessageSquare,
  FileText,
  Lightbulb,
  BookOpen,
  Code,
  Image,
  Zap,
  Send,
  Copy,
  Star,
  Heart,
  Bookmark,
  PenLine,
  Bot,
  User,
};

export const PROMPT_ICON_NAMES = Object.keys(PROMPT_ICON_MAP) as string[];

export function getPromptIconComponent(name: string): LucideIcon | null {
  return name && PROMPT_ICON_MAP[name] ? PROMPT_ICON_MAP[name] : null;
}

export function PromptIconDisplay({ name, className }: { name: string; className?: string }) {
  const Icon = getPromptIconComponent(name);
  if (!Icon) return <Sparkles className={className} aria-hidden />;
  return <Icon className={className} aria-hidden />;
}
