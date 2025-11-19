import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { agentsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateShareId } from '@/lib/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [originalAgent] = await db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.id, id))
      .limit(1);

    if (!originalAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (!originalAgent.isPublic) {
      return NextResponse.json({ error: 'Cannot fork private agent' }, { status: 403 });
    }

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

    const [forkedAgent] = await db
      .insert(agentsTable)
      .values({
        name: originalAgent.name,
        description: originalAgent.description,
        prompt: originalAgent.prompt,
        tools: originalAgent.tools,
        parentAgentId: originalAgent.id,
        shareId: newShareId,
        isPublic: false,
      })
      .returning();

    const mappedAgent = {
      id: forkedAgent.id,
      title: forkedAgent.name,
      description: forkedAgent.description,
      prompt: forkedAgent.prompt,
      tools: (forkedAgent.tools as string[]) || [],
      shareId: forkedAgent.shareId,
      isPublic: forkedAgent.isPublic,
      parentAgentId: forkedAgent.parentAgentId,
      parentAgent: {
        id: originalAgent.id,
        title: originalAgent.name,
        description: originalAgent.description,
        prompt: originalAgent.prompt,
        tools: (originalAgent.tools as string[]) || [],
        shareId: originalAgent.shareId,
        isPublic: originalAgent.isPublic,
      },
    };

    return NextResponse.json(mappedAgent, { status: 201 });
  } catch (error) {
    console.error('Error forking agent:', error);
    return NextResponse.json({ error: 'Failed to fork agent' }, { status: 500 });
  }
}

