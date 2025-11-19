'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Agent } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoaderCircle, GitBranch, GitFork, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
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

interface GenealogyTreeViewProps {
  agents: Agent[];
}

export function GenealogyTreeView({ agents }: GenealogyTreeViewProps) {
  const router = useRouter();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [data, setData] = useState<GenealogyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build a map of agents by ID for quick lookup
  const agentsMap = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((agent) => map.set(agent.id, agent));
    return map;
  }, [agents]);

  // Get root agents (agents without parents)
  const rootAgents = useMemo(() => {
    return agents.filter((agent) => !agent.parentAgentId);
  }, [agents]);

  // Auto-select first root agent if available
  useEffect(() => {
    if (!selectedAgentId && rootAgents.length > 0) {
      setSelectedAgentId(rootAgents[0].id);
    }
  }, [rootAgents, selectedAgentId]);

  // Fetch genealogy when agent is selected
  useEffect(() => {
    if (selectedAgentId) {
      fetchGenealogy(selectedAgentId);
    }
  }, [selectedAgentId]);

  const fetchGenealogy = async (agentId: string) => {
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

  const handleAgentSelect = (agentId: string) => {
    setSelectedAgentId(agentId);
    fetchGenealogy(agentId);
  };

  const renderNode = (node: TreeNode, level: number = 0, isRoot: boolean = false, isLast: boolean = false) => {
    const hasChildren = node.children && node.children.length > 0;
    const linkPath = `/run/${node.id}`;

    return (
      <div key={node.id} className="relative flex flex-col items-center">
        {/* Vertical line from parent with gradient */}
        {level > 0 && (
          <div className="absolute bottom-full w-0.5 h-8 bg-gradient-to-t from-primary/40 via-primary/20 to-transparent" />
        )}

        {/* Node content */}
        <Card
          className={cn(
            'w-72 transition-all duration-300 cursor-pointer relative z-10 group',
            'hover:shadow-xl hover:-translate-y-1',
            'border-2',
            isRoot 
              ? 'ring-2 ring-primary/50 shadow-lg bg-gradient-to-br from-primary/5 to-background border-primary/30' 
              : 'hover:border-primary/40 hover:shadow-lg bg-background',
            'backdrop-blur-sm'
          )}
          onClick={() => handleAgentSelect(node.id)}
        >
          {/* Decorative corner accent */}
          {isRoot && (
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full opacity-50" />
          )}
          
          <CardHeader className="pb-3 relative">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className={cn(
                  'text-sm font-semibold line-clamp-1 transition-colors',
                  isRoot ? 'text-primary' : 'group-hover:text-primary'
                )}>
                  {node.title}
                </CardTitle>
                <p className="text-muted-foreground text-xs line-clamp-2 mt-1.5 leading-relaxed">
                  {node.description}
                </p>
              </div>
              {isRoot && (
                <Badge variant="default" className="shrink-0 text-xs shadow-sm bg-primary">
                  Root
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {node.isPublic && (
                  <Badge variant="outline" className="text-xs border-green-200 text-green-700 dark:border-green-800 dark:text-green-300">
                    Public
                  </Badge>
                )}
                {hasChildren && (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                    <GitFork className="mr-1 h-3 w-3" />
                    {node.children?.length}
                  </Badge>
                )}
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs h-7 px-3 transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  router.push(linkPath);
                }}
              >
                View
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Horizontal line to children */}
        {hasChildren && (
          <>
            {/* Vertical line down from parent with gradient */}
            <div className="w-0.5 h-8 bg-gradient-to-b from-primary/40 via-primary/20 to-transparent mt-2" />
            
            {/* Children container with horizontal connector */}
            <div className="relative flex items-start justify-center gap-10 mt-8">
              {/* Horizontal line connecting all children with gradient */}
              {node.children && node.children.length > 1 && (
                <div 
                  className="absolute top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                  style={{
                    left: '50%',
                    width: `${(node.children.length - 1) * 304}px`,
                    transform: 'translateX(-50%)'
                  }}
                />
              )}
              
              {node.children?.map((child, index) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  {/* Vertical line up to horizontal connector with gradient */}
                  <div className="absolute bottom-full left-1/2 w-0.5 h-8 bg-gradient-to-t from-primary/40 via-primary/20 to-transparent -translate-x-1/2" />
                  
                  {/* Render child */}
                  {renderNode(child, level + 1, false, index === (node.children?.length || 0) - 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const hasAnyData = data && (data.ancestors.length > 0 || data.descendants.length > 0);
  const selectedAgent = selectedAgentId ? agentsMap.get(selectedAgentId) : null;

  return (
    <div className="space-y-6">
      {/* Agent Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">View genealogy for:</label>
        <Select value={selectedAgentId || ''} onValueChange={handleAgentSelect}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select an agent" />
          </SelectTrigger>
          <SelectContent>
            {rootAgents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.title}
              </SelectItem>
            ))}
            {agents.filter((a) => !rootAgents.find((r) => r.id === a.id)).length > 0 && (
              <>
                {agents
                  .filter((a) => !rootAgents.find((r) => r.id === a.id))
                  .map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.title} {agent.parentAgent && `(forked from ${agent.parentAgent.title})`}
                    </SelectItem>
                  ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Tree View */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="py-12 text-center">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => selectedAgentId && fetchGenealogy(selectedAgentId)} variant="outline" className="mt-4">
            Retry
          </Button>
        </div>
      ) : !selectedAgentId ? (
        <div className="py-12 text-center">
          <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Select an agent to view its genealogy tree.</p>
        </div>
      ) : !hasAnyData ? (
        <div className="py-12 text-center">
          <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {selectedAgent?.title} has no forks or parent agents yet.
          </p>
        </div>
      ) : (
        <div className="py-8 overflow-x-auto">
          <div className="flex flex-col items-center min-w-max px-8 bg-gradient-to-b from-background via-muted/20 to-background rounded-lg">
            {/* Ancestors - displayed vertically above root */}
            {data.ancestors.length > 0 && (
              <div className="mb-12 flex flex-col items-center">
                <h3 className="text-sm font-semibold text-muted-foreground mb-8 flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50">
                  <ChevronRight className="h-4 w-4 rotate-[-90deg] text-primary" />
                  Ancestors ({data.ancestors.length})
                </h3>
                <div className="flex flex-col items-center gap-6">
                  {data.ancestors.map((ancestor, idx) => (
                    <div key={ancestor.id} className="relative flex flex-col items-center">
                      {renderNode(ancestor, 0, false, idx === data.ancestors.length - 1)}
                      {idx < data.ancestors.length - 1 && (
                        <div className="w-0.5 h-10 bg-gradient-to-b from-primary/30 via-primary/20 to-transparent my-2" />
                      )}
                    </div>
                  ))}
                  {/* Connection line to root with gradient */}
                  <div className="w-0.5 h-10 bg-gradient-to-b from-primary/50 via-primary/30 to-transparent my-2" />
                </div>
              </div>
            )}

            {/* Root */}
            <div className="relative flex flex-col items-center">
              {data.ancestors.length > 0 && (
                <h3 className="text-sm font-semibold text-primary mb-8 px-4 py-2 rounded-full bg-primary/10">
                  Current Agent
                </h3>
              )}
              {renderNode(data.root, 0, true, false)}
            </div>

            {/* Descendants - displayed as tree branches below root */}
            {data.descendants.length > 0 && (
              <div className="mt-12 flex flex-col items-center">
                <div className="w-0.5 h-10 bg-gradient-to-b from-primary/50 via-primary/30 to-transparent mb-4" />
                <h3 className="text-sm font-semibold text-muted-foreground mb-8 flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50">
                  <GitFork className="h-4 w-4 text-primary" />
                  Forks ({data.descendants.length})
                </h3>
                <div className="flex items-start gap-10">
                  {data.descendants.map((descendant, idx) => (
                    <div key={descendant.id} className="relative">
                      {renderNode(descendant, 0, false, idx === data.descendants.length - 1)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

