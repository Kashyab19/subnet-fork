'use client';

import { useEffect, useState } from 'react';
import type { Agent } from '@/lib/types';
import { Header } from '@/components/header';
import { AgentCard } from '@/components/agent-card';
import { AgentCardSkeleton } from '@/components/agent-card-skeleton';
import { Button } from '@/components/ui/button';
import { Grid3x3, GitBranch } from 'lucide-react';
import { GenealogyTreeView } from '@/components/genealogy-tree-view';

type ViewMode = 'grid' | 'tree';

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    async function fetchPublicAgents() {
      try {
        const response = await fetch('/api/agents?public=true');
        if (!response.ok) {
          throw new Error('Failed to fetch public agents');
        }
        const data = await response.json();
        setAgents(data);
      } catch (error) {
        console.error('Error fetching public agents:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPublicAgents();
  }, []);

  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-foreground mb-2 text-4xl font-bold">Discover Agents</h1>
            <p className="text-muted-foreground">
              Explore and fork public agents created by the community
            </p>
          </div>
          {!isLoading && agents.length > 0 && (
            <div className="flex gap-2 rounded-lg border p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="gap-2"
              >
                <Grid3x3 className="h-4 w-4" />
                Grid
              </Button>
              <Button
                variant={viewMode === 'tree' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('tree')}
                className="gap-2"
              >
                <GitBranch className="h-4 w-4" />
                Genealogy
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground mb-4 text-lg">
              No public agents found yet. Be the first to share an agent!
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                showForkButton={true}
              />
            ))}
          </div>
        ) : (
          <GenealogyTreeView agents={agents} />
        )}
      </main>
    </div>
  );
}
