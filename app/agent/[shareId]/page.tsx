'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Agent } from '@/lib/types';
import { AVAILABLE_TOOLS } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import { GitFork, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function PublicAgentPage() {
  const params = useParams();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isForking, setIsForking] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchAgent() {
      const shareId = params.shareId as string;

      try {
        const response = await fetch(`/api/agents/share/${shareId}`);

        if (!response.ok) {
          if (response.status === 404) {
            router.push('/');
            return;
          }
          if (response.status === 403) {
            toast({
              title: 'Agent is private',
              description: 'This agent is not publicly available.',
              variant: 'destructive',
            });
            router.push('/');
            return;
          }
          throw new Error('Failed to fetch agent');
        }

        const data = await response.json();
        setAgent(data);
      } catch (error) {
        console.error('Error fetching agent:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAgent();
  }, [params.shareId, router, toast]);

  const handleFork = async () => {
    if (!agent) return;

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
        description: 'Redirecting to your new agent...',
      });
      
      router.push(`/playground/${forkedAgent.id}`);
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

  const getToolLabel = (toolValue: string) => {
    const tool = AVAILABLE_TOOLS.find((t) => t.value === toolValue);
    return tool?.label || toolValue;
  };

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <Header />
        <main className="container mx-auto max-w-4xl px-4 py-16">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="mb-2 flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/discover')}
                    className="shrink-0"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Discover
                  </Button>
                </div>
                <CardTitle className="mb-1 text-2xl">{agent.title}</CardTitle>
                <p className="text-muted-foreground mb-2 text-sm">{agent.description}</p>
                {agent.parentAgent && (
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs">
                      <Link
                        href={agent.parentAgent.shareId ? `/agent/${agent.parentAgent.shareId}` : `/playground/${agent.parentAgent.id}`}
                        className="hover:underline"
                      >
                        Forked from {agent.parentAgent.title}
                      </Link>
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {agent.tools.map((tool) => (
                <Badge key={tool} variant="secondary" className="text-xs">
                  {getToolLabel(tool)}
                </Badge>
              ))}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Collapsible open={showPrompt} onOpenChange={setShowPrompt}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  {showPrompt ? 'Hide' : 'Show'} Instruction Set
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="prose prose-sm text-foreground bg-muted/50 max-h-96 max-w-none overflow-y-auto rounded-md border p-3 text-xs">
                  <ReactMarkdown>{agent.prompt}</ReactMarkdown>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="border-t pt-4">
              <div className="flex gap-2">
                <Link href={`/playground/${agent.id}`} className="flex-1">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full">
                    Run Agent
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={handleFork}
                  disabled={isForking}
                  className="shrink-0"
                >
                  {isForking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Forking...
                    </>
                  ) : (
                    <>
                      <GitFork className="mr-2 h-4 w-4" />
                      Fork this Agent
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

