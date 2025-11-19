'use client';

import Link from 'next/link';
import type { Agent } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Share2, GitFork, Loader2, Zap, Brain, Sparkles, CheckCircle2, GitBranch } from 'lucide-react';
import { useState, useMemo } from 'react';
import { AVAILABLE_TOOLS } from '@/lib/types';
import { ShareDialog } from '@/components/share-dialog';
import { GenealogyTree } from '@/components/genealogy-tree';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  generatePersonalityTraits,
} from '@/lib/utils';
import { ToolIcon } from '@/components/tool-icon';
import { cn } from '@/lib/utils';

interface AgentCardProps {
  agent: Agent;
  onDelete?: (agentId: string) => void;
  onUpdate?: (updatedAgent: Agent) => void;
  showForkButton?: boolean; // For public agents in marketplace
}

export function AgentCard({ agent, onDelete, onUpdate, showForkButton = false }: AgentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [genealogyDialogOpen, setGenealogyDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Generate visual identity
  const traits = useMemo(() => generatePersonalityTraits(agent), [agent]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${agent.title}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete agent');
      }

      onDelete?.(agent.id);
    } catch (error) {
      console.error('Error deleting agent:', error);
      alert('Failed to delete agent. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFork = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!agent.isPublic) {
      toast({
        title: 'Cannot fork',
        description: 'This agent is not public.',
        variant: 'destructive',
      });
      return;
    }

    setIsForking(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}/fork`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fork agent');
      }

      const forkedAgent = await response.json();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      
      toast({
        title: 'Agent forked!',
        description: 'Redirecting to edit your new agent...',
      });
      
      router.push(`/run/${forkedAgent.id}`);
    } catch (error: any) {
      console.error('Error forking agent:', error);
      toast({
        title: 'Failed to fork',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsForking(false);
    }
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShareDialogOpen(true);
  };

  const handleGenealogyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setGenealogyDialogOpen(true);
  };

  const speedIcons = {
    lightning: Zap,
    thoughtful: Brain,
    balanced: Sparkles,
  };

  const speedLabels = {
    lightning: 'Lightning Fast',
    thoughtful: 'Thoughtful',
    balanced: 'Balanced',
  };

  const styleLabels = {
    creative: 'Creative',
    analytical: 'Analytical',
    balanced: 'Balanced',
  };

  const SpeedIcon = speedIcons[traits.speed];

  return (
    <>
      <Card
        className={cn(
          'group relative overflow-hidden transition-all duration-300',
          'hover:shadow-xl hover:-translate-y-1',
          isHovered && 'shadow-lg',
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2 flex-wrap">
                <CardTitle className="text-xl transition-colors group-hover:text-primary">
                  {agent.title}
                </CardTitle>
                {agent.parentAgent && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    <Link
                      href={
                        agent.parentAgent.shareId
                          ? `/agent/${agent.parentAgent.shareId}`
                          : `/run/${agent.parentAgent.id}`
                      }
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Forked from {agent.parentAgent.title}
                    </Link>
                  </Badge>
                )}
              </div>
              <CardDescription className="line-clamp-2 mt-1">
                {agent.description}
              </CardDescription>
            </div>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0 transition-all duration-200"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          
          {/* Personality Speed Badge */}
          <div className="mt-2">
            <Badge
              variant="secondary"
              className={cn(
                'text-xs transition-all duration-300',
                isHovered && 'scale-105',
              )}
            >
              <SpeedIcon className="mr-1 h-3 w-3" />
              {speedLabels[traits.speed]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Personality Traits */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-xs transition-all duration-200',
                traits.style === 'creative' && 'border-pink-200 text-pink-700 dark:border-pink-800 dark:text-pink-300',
                traits.style === 'analytical' && 'border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300',
              )}
            >
              {styleLabels[traits.style]}
            </Badge>
            {traits.specialties.slice(0, 2).map((specialty, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {specialty}
              </Badge>
            ))}
          </div>

          {/* Tools */}
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">Tools</p>
            <div className="flex flex-wrap gap-2">
              {agent.tools.slice(0, 3).map((tool) => (
                <Badge
                  key={tool}
                  variant="outline"
                  className="text-xs gap-1.5 transition-all duration-200 hover:scale-105"
                >
                  <ToolIcon tool={tool} size={12} />
                  {AVAILABLE_TOOLS.find((t) => t.value === tool)?.label || tool}
                </Badge>
              ))}
              {agent.tools.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{agent.tools.length - 3}
                </Badge>
              )}
            </div>
          </div>

          {/* Prompt Preview on Hover */}
          {isHovered && (
            <div className="animate-in fade-in-50 slide-in-from-top-2 duration-200">
              <div className="prose prose-sm text-muted-foreground bg-muted/50 max-h-32 max-w-none overflow-hidden rounded-md border p-2 text-xs">
                <p className="line-clamp-3 m-0">{agent.prompt}</p>
              </div>
            </div>
          )}

          {agent.isPublic && (
            <Badge variant="outline" className="text-xs w-fit">
              Public
            </Badge>
          )}
        </CardContent>

        <CardFooter className="flex gap-2 pt-4">
          <Link href={`/run/${agent.id}`} className="flex-1">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full transition-all duration-200 hover:scale-[1.02]">
              View Agent
            </Button>
          </Link>
          {!showForkButton && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={handleGenealogyClick}
                className="shrink-0 transition-all duration-200 hover:scale-105"
                title="View genealogy tree"
              >
                <GitBranch className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleShareClick}
                className="shrink-0 transition-all duration-200 hover:scale-105"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {showForkButton && agent.isPublic && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={handleGenealogyClick}
                className="shrink-0 transition-all duration-200 hover:scale-105"
                title="View genealogy tree"
              >
                <GitBranch className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={handleFork}
                disabled={isForking || showSuccess}
                className={cn(
                  'shrink-0 transition-all duration-200',
                  showSuccess && 'bg-green-500 text-white border-green-500',
                  !showSuccess && 'hover:scale-105',
                )}
                title="Fork this agent"
              >
                {showSuccess ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 animate-in zoom-in duration-200" />
                    Forked!
                  </>
                ) : isForking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Forking...
                  </>
                ) : (
                  <>
                    <GitFork className="mr-2 h-4 w-4" />
                    Fork
                  </>
                )}
              </Button>
            </>
          )}
        </CardFooter>

        {/* Success Animation Overlay */}
        {showSuccess && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-green-500/10 animate-in fade-in-0 duration-300">
            <div className="rounded-full bg-green-500 p-4 animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
          </div>
        )}
      </Card>

      {!showForkButton && (
        <ShareDialog
          agent={agent}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          onUpdate={(updatedAgent) => {
            onUpdate?.(updatedAgent);
          }}
        />
      )}
      <GenealogyTree
        agentId={agent.id}
        agentTitle={agent.title}
        open={genealogyDialogOpen}
        onOpenChange={setGenealogyDialogOpen}
      />
    </>
  );
}
