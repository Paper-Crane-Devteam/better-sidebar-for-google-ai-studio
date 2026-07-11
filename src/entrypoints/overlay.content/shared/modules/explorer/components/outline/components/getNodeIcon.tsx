import {
  Heading,
  Code2,
  Circle,
  Image,
  Table2,
  Link2,
  Sigma,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import type { OutlineNode } from '../types';

export function getNodeIcon(node: OutlineNode) {
  switch (node.type) {
    case 'heading':
      return (
        <Heading
          className={cn(
            'h-3 w-3 shrink-0',
            node.meta === 'h1'
              ? 'text-red-500'
              : node.meta === 'h2'
                ? 'text-blue-500'
                : node.meta === 'h3'
                  ? 'text-green-500'
                  : 'text-orange-400',
          )}
        />
      );
    case 'code-block':
      return <Code2 className="h-3 w-3 shrink-0 text-purple-500" />;
    case 'image':
      return <Image className="h-3 w-3 shrink-0 text-pink-500" />;
    case 'table':
      return <Table2 className="h-3 w-3 shrink-0 text-cyan-500" />;
    case 'link':
      return <Link2 className="h-3 w-3 shrink-0 text-blue-400" />;
    case 'math':
      return <Sigma className="h-3 w-3 shrink-0 text-amber-500" />;
    default:
      return <Circle className="h-2 w-2 shrink-0 text-muted-foreground/30" />;
  }
}
