import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { agentsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface TreeNode {
  id: string;
  title: string;
  description: string;
  shareId?: string | null;
  isPublic?: boolean;
  parentAgentId?: string | null;
  children?: TreeNode[];
}

// Recursively fetch all ancestors (parents, grandparents, etc.)
async function getAncestors(agentId: string, visited: Set<string> = new Set()): Promise<TreeNode[]> {
  if (visited.has(agentId)) {
    return []; // Prevent cycles
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
    shareId: parent.shareId,
    isPublic: parent.isPublic,
    parentAgentId: parent.parentAgentId,
  };

  const ancestors = await getAncestors(parent.id, visited);
  return [parentNode, ...ancestors];
}

// Recursively fetch all descendants (children, grandchildren, etc.)
async function getDescendants(agentId: string, visited: Set<string> = new Set()): Promise<TreeNode[]> {
  if (visited.has(agentId)) {
    return []; // Prevent cycles
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

// GET /api/agents/[id]/genealogy - Get genealogy tree for an agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Get the agent itself
    const [agent] = await db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.id, id))
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get ancestors (parents, grandparents, etc.)
    const ancestors = await getAncestors(id);

    // Get descendants (children, grandchildren, etc.)
    const descendants = await getDescendants(id);

    // Build the tree structure
    const rootNode: TreeNode = {
      id: agent.id,
      title: agent.name,
      description: agent.description,
      shareId: agent.shareId,
      isPublic: agent.isPublic,
      parentAgentId: agent.parentAgentId,
      children: descendants.length > 0 ? descendants : undefined,
    };

    return NextResponse.json({
      root: rootNode,
      ancestors: ancestors.reverse(), // Reverse to show oldest first
      descendants: descendants,
    });
  } catch (error) {
    console.error('Error fetching genealogy:', error);
    return NextResponse.json({ error: 'Failed to fetch genealogy' }, { status: 500 });
  }
}

