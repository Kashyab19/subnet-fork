import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { agentsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface TreeNode {
  id: string;
  title: string;
  description: string;
  prompt: string;
  tools: string[];
  shareId?: string | null;
  isPublic?: boolean;
  parentAgentId?: string | null;
  children?: TreeNode[];
}

async function getAncestors(agentId: string, visited: Set<string> = new Set()): Promise<TreeNode[]> {
  if (visited.has(agentId)) {
    return [];
  }
  visited.add(agentId);

  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.id, agentId))
    .limit(1);

  if (!agent || !agent.parentAgentId) {
    return [];
  }

  const [parent] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.id, agent.parentAgentId))
    .limit(1);

  if (!parent) {
    return [];
  }

  const parentNode: TreeNode = {
    id: parent.id,
    title: parent.name,
    description: parent.description,
    prompt: parent.prompt,
    tools: (parent.tools as string[]) || [],
    shareId: parent.shareId,
    isPublic: parent.isPublic,
    parentAgentId: parent.parentAgentId,
  };

  const ancestors = await getAncestors(parent.id, visited);
  return [parentNode, ...ancestors];
}

async function getDescendants(agentId: string, visited: Set<string> = new Set()): Promise<TreeNode[]> {
  if (visited.has(agentId)) {
    return [];
  }
  visited.add(agentId);

  const children = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.parentAgentId, agentId));

  const descendants: TreeNode[] = [];

  for (const child of children) {
    const childNode: TreeNode = {
      id: child.id,
      title: child.name,
      description: child.description,
      prompt: child.prompt,
      tools: (child.tools as string[]) || [],
      shareId: child.shareId,
      isPublic: child.isPublic,
      parentAgentId: child.parentAgentId,
    };

    const grandChildren = await getDescendants(child.id, visited);
    if (grandChildren.length > 0) {
      childNode.children = grandChildren;
    }

    descendants.push(childNode);
  }

  return descendants;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [agent] = await db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.id, id))
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const ancestors = await getAncestors(id);
    const descendants = await getDescendants(id);

    const rootNode: TreeNode = {
      id: agent.id,
      title: agent.name,
      description: agent.description,
      prompt: agent.prompt,
      tools: (agent.tools as string[]) || [],
      shareId: agent.shareId,
      isPublic: agent.isPublic,
      parentAgentId: agent.parentAgentId,
      children: descendants.length > 0 ? descendants : undefined,
    };

    return NextResponse.json({
      root: rootNode,
      ancestors: ancestors.reverse(),
      descendants: descendants,
    });
  } catch (error) {
    console.error('Error fetching genealogy:', error);
    return NextResponse.json({ error: 'Failed to fetch genealogy' }, { status: 500 });
  }
}

