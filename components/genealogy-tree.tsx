'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoaderCircle, GitBranch, GitFork, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface TreeNode {
  id: string;
  title: string;
  description: string;
  shareId?: string | null;
  isPublic?: boolean;
  parentAgentId?: string | null;
  children?: TreeNode[];
}

interface GenealogyData {
  root: TreeNode;
  ancestors: TreeNode[];
  descendants: TreeNode[];
}

interface GenealogyTreeProps {
  agentId: string;
  agentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenealogyTree({ agentId, agentTitle, open, onOpenChange }: GenealogyTreeProps) {
  const [data, setData] = useState<GenealogyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && agentId) {
      fetchGenealogy();
    }
  }, [open, agentId]);

  const fetchGenealogy = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/agents/${agentId}/genealogy`);
      if (!response.ok) {
        throw new Error('Failed to fetch genealogy');
      }
      const genealogyData = await response.json();
      setData(genealogyData);
    } catch (err) {
      console.error('Error fetching genealogy:', err);
      setError('Failed to load genealogy tree');
    } finally {
      setIsLoading(false);
    }
  };

  const renderNode = (node: TreeNode, level: number = 0, isRoot: boolean = false) => {
    const hasChildren = node.children && node.children.length > 0;
    const linkPath = node.shareId ? `/agent/${node.shareId}` : `/run/${node.id}`;

    return (
      <div key={node.id} className="relative">
        <div className={cn('flex items-start gap-3', level > 0 && 'mt-4')}>
          {/* Connection line */}
          {level > 0 && (
            <div className="absolute left-0 top-0 w-6 h-6 border-l-2 border-b-2 border-muted-foreground/30 -translate-x-6 translate-y-3" />
          )}
          
          {/* Node content */}
          <div className="flex-1 min-w-0">
            <Card className={cn(
              'transition-all hover:shadow-md',
              isRoot && 'ring-2 ring-primary'
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base line-clamp-1">
                      {node.title}
                    </CardTitle>
                    <p className="text-muted-foreground text-sm line-clamp-2 mt-1">
                      {node.description}
                    </p>
                  </div>
                  {isRoot && (
                    <Badge variant="default" className="shrink-0">
                      Root
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {node.isPublic && (
                      <Badge variant="outline" className="text-xs">
                        Public
                      </Badge>
                    )}
                    {hasChildren && (
                      <Badge variant="secondary" className="text-xs">
                        <GitFork className="mr-1 h-3 w-3" />
                        {node.children?.length} fork{node.children && node.children.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <Link href={linkPath} onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="text-xs">
                      View
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Children */}
        {hasChildren && (
          <div className="ml-8 mt-2 space-y-2 border-l-2 border-muted-foreground/30 pl-6">
            {node.children?.map((child) => renderNode(child, level + 1, false))}
          </div>
        )}
      </div>
    );
  };

  const hasAnyData = data && (data.ancestors.length > 0 || data.descendants.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Genealogy Tree: {agentTitle}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchGenealogy} variant="outline" className="mt-4">
              Retry
            </Button>
          </div>
        ) : !hasAnyData ? (
          <div className="py-12 text-center">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              This agent has no forks or parent agents yet.
            </p>
          </div>
        ) : (
          <div className="space-y-8 py-4">
            {/* Ancestors */}
            {data.ancestors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 rotate-[-90deg]" />
                  Ancestors ({data.ancestors.length})
                </h3>
                <div className="space-y-2">
                  {data.ancestors.map((ancestor, idx) => (
                    <div key={ancestor.id}>
                      {renderNode(ancestor, 0, false)}
                      {idx < data.ancestors.length - 1 && (
                        <div className="flex items-center justify-center my-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Arrow to root */}
                  <div className="flex items-center justify-center my-2">
                    <ChevronRight className="h-4 w-4 text-primary rotate-90" />
                  </div>
                </div>
              </div>
            )}

            {/* Root */}
            <div>
              {data.ancestors.length > 0 && (
                <h3 className="text-sm font-semibold text-muted-foreground mb-4">
                  Current Agent
                </h3>
              )}
              {renderNode(data.root, 0, true)}
            </div>

            {/* Descendants */}
            {data.descendants.length > 0 && (
              <div>
                <div className="flex items-center justify-center my-2">
                  <ChevronRight className="h-4 w-4 text-primary rotate-90" />
                </div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                  <GitFork className="h-4 w-4" />
                  Forks ({data.descendants.length})
                </h3>
                <div className="space-y-2">
                  {data.descendants.map((descendant) => renderNode(descendant, 0, false))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

