'use client';

import { useEffect, useState } from 'react';
import type { Agent } from '@/lib/types';
import { Header } from '@/components/header';
import { AgentCard } from '@/components/agent-card';
import { Loader2 } from 'lucide-react';

export default function DiscoverPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        <div className="mb-8">
          <h1 className="text-foreground mb-2 text-4xl font-bold">Discover Agents</h1>
          <p className="text-muted-foreground">
            Explore and fork public agents created by the community
          </p>
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground mt-4 text-lg">Loading agents...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground mb-4 text-lg">
              No public agents found yet. Be the first to share an agent!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                showForkButton={true}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

