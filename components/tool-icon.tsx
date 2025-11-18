'use client';

import {
  Search,
  Globe,
  FileText,
  Zap,
  Layers,
  Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolIconProps {
  tool: string;
  className?: string;
  size?: number;
}

const toolIconMap: Record<string, { icon: React.ComponentType<{ className?: string; size?: number }>; color: string }> = {
  parallel_search: { icon: Zap, color: 'text-yellow-500' },
  exa_search: { icon: Search, color: 'text-blue-500' },
  exa_crawl: { icon: Globe, color: 'text-green-500' },
  exa_find_similar: { icon: Network, color: 'text-purple-500' },
  web_search: { icon: Search, color: 'text-orange-500' },
  webpage_understanding: { icon: FileText, color: 'text-indigo-500' },
};

export function ToolIcon({ tool, className, size = 16 }: ToolIconProps) {
  const toolConfig = toolIconMap[tool];
  
  if (!toolConfig) {
    return <Layers className={cn('text-muted-foreground', className)} size={size} />;
  }
  
  const Icon = toolConfig.icon;
  return <Icon className={cn(toolConfig.color, className)} size={size} />;
}

