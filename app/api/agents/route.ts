import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { agentsTable } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

// GET /api/agents - Get first 50 agents (optionally filter by isPublic)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const publicOnly = searchParams.get('public') === 'true';

    const agents = publicOnly
      ? await db
          .select()
          .from(agentsTable)
          .where(eq(agentsTable.isPublic, true))
          .orderBy(desc(agentsTable.createdAt))
          .limit(50)
      : await db
          .select()
          .from(agentsTable)
          .orderBy(desc(agentsTable.createdAt))
          .limit(50);

    // Map database fields to match Agent interface
    const mappedAgents = await Promise.all(
      agents.map(async (agent) => {
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
            };
          }
        }

        return {
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
      })
    );

    return NextResponse.json(mappedAgents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, prompt, tools } = body;

    if (!title || !description || !prompt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [newAgent] = await db
      .insert(agentsTable)
      .values({
        name: title,
        description,
        prompt,
        tools: tools || [],
      })
      .returning();

    // Map database fields to match Agent interface
    const mappedAgent = {
      id: newAgent.id,
      title: newAgent.name,
      description: newAgent.description,
      prompt: newAgent.prompt,
      tools: (newAgent.tools as string[]) || [],
      shareId: newAgent.shareId,
      isPublic: newAgent.isPublic,
      parentAgentId: newAgent.parentAgentId,
    };

    return NextResponse.json(mappedAgent, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}
