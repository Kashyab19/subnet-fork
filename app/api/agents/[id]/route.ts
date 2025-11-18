import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { agentsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/agents/[id] - Get a specific agent by UUID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Fetch parent agent if this is a fork
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

    // Map database fields to match Agent interface
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
    console.error('Error fetching agent:', error);
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
  }
}

// PATCH /api/agents/[id] - Update agent (for sharing settings and core fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isPublic, title, description, prompt, tools } = body;

    // Get current agent
    const [currentAgent] = await db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.id, id))
      .limit(1);

    if (!currentAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    // Update core fields if provided
    if (title !== undefined) {
      updateData.name = title;
    }
    if (description !== undefined) {
      updateData.description = description;
    }
    if (prompt !== undefined) {
      updateData.prompt = prompt;
    }
    if (tools !== undefined) {
      updateData.tools = tools;
    }

    // Update sharing settings if provided
    if (typeof isPublic === 'boolean') {
      updateData.isPublic = isPublic;
      
      // Generate shareId server-side if making public and doesn't have one
      if (isPublic && !currentAgent.shareId) {
        const { generateShareId } = await import('@/lib/utils');
        let newShareId: string | undefined;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
          newShareId = generateShareId();
          const [existing] = await db
            .select()
            .from(agentsTable)
            .where(eq(agentsTable.shareId, newShareId))
            .limit(1);
          
          if (!existing) {
            isUnique = true;
          } else {
            newShareId = undefined;
          }
          attempts++;
        }

        if (!isUnique || !newShareId) {
          return NextResponse.json({ error: 'Failed to generate unique shareId' }, { status: 500 });
        }

        updateData.shareId = newShareId;
      }
    }

    const [updatedAgent] = await db
      .update(agentsTable)
      .set(updateData)
      .where(eq(agentsTable.id, id))
      .returning();

    if (!updatedAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const mappedAgent = {
      id: updatedAgent.id,
      title: updatedAgent.name,
      description: updatedAgent.description,
      prompt: updatedAgent.prompt,
      tools: (updatedAgent.tools as string[]) || [],
      shareId: updatedAgent.shareId,
      isPublic: updatedAgent.isPublic,
      parentAgentId: updatedAgent.parentAgentId,
    };

    return NextResponse.json(mappedAgent);
  } catch (error: any) {
    console.error('Error updating agent:', error);
    
    // Check for unique constraint violation
    if (error.code === '23505' || error.message?.includes('unique')) {
      return NextResponse.json({ error: 'Share ID already exists. Please try again.' }, { status: 409 });
    }
    
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}

// DELETE /api/agents/[id] - Delete a specific agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [deletedAgent] = await db
      .delete(agentsTable)
      .where(eq(agentsTable.id, id))
      .returning();

    if (!deletedAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
}
