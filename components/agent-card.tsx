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
import { Trash2, Share2, GitFork, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { AVAILABLE_TOOLS } from '@/lib/types';
import { ShareDialog } from '@/components/share-dialog';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

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
  const router = useRouter();
  const { toast } = useToast();

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
      toast({
        title: 'Agent forked!',
        description: 'Redirecting to edit your new agent...',
      });
      
      // Redirect to edit/create page with the forked agent data
      // For now, redirect to the run page - you might want to create an edit page
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

  return (
    <>
      <Card className="relative">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <CardTitle className="text-xl">{agent.title}</CardTitle>
                {agent.parentAgent && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    <Link
                      href={agent.parentAgent.shareId ? `/agent/${agent.parentAgent.shareId}` : `/run/${agent.parentAgent.id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Forked from {agent.parentAgent.title}
                    </Link>
                  </Badge>
                )}
              </div>
              <CardDescription className="line-clamp-2 mt-1">{agent.description}</CardDescription>
            </div>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-2">
              <p className="text-muted-foreground text-sm font-medium">Tools:</p>
              <div className="flex flex-wrap gap-2">
                {agent.tools.slice(0, 2).map((tool) => (
                  <Badge key={tool} variant="secondary" className="text-xs">
                    {AVAILABLE_TOOLS.find((t) => t.value === tool)?.label}
                  </Badge>
                ))}
                {agent.tools.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{agent.tools.length - 2}
                  </Badge>
                )}
              </div>
            </div>
            {agent.isPublic && (
              <Badge variant="outline" className="text-xs">
                Public
              </Badge>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Link href={`/run/${agent.id}`} className="flex-1">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full">
              View Agent
            </Button>
          </Link>
          {!showForkButton && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleShareClick}
              className="shrink-0"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          )}
          {showForkButton && agent.isPublic && (
            <Button
              variant="outline"
              onClick={handleFork}
              disabled={isForking}
              className="shrink-0"
              title="Fork this agent"
            >
              {isForking ? (
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
          )}
        </CardFooter>
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
    </>
  );
}
