import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { agentsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> },
) {
  try {
    const { shareId } = await params;

    const [agent] = await db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.shareId, shareId))
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (!agent.isPublic) {
      return NextResponse.json({ error: 'Agent is not public' }, { status: 403 });
    }

    let parentAgent = null;
    if (agent.parentAgentId) {
      const [parent] = await db
        .select()
        .from(agentsTable)
        .where(eq(agentsTable.id, agent.parentAgentId))
        .limit(1);
      if (parent) {
        parentAgent = {
          id: parent.id,
          title: parent.name,
          description: parent.description,
          prompt: parent.prompt,
          tools: (parent.tools as string[]) || [],
          shareId: parent.shareId,
          isPublic: parent.isPublic,
        };
      }
    }

    const mappedAgent = {
      id: agent.id,
      title: agent.name,
      description: agent.description,
      prompt: agent.prompt,
      tools: (agent.tools as string[]) || [],
      shareId: agent.shareId,
      isPublic: agent.isPublic,
      parentAgentId: agent.parentAgentId,
      parentAgent,
    };

    return NextResponse.json(mappedAgent);
  } catch (error) {
    console.error('Error fetching agent by shareId:', error);
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
  }
}

