import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { db } from '@/db';
import { agentsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

const client = new OpenAI({
  baseURL: 'https://api.subconscious.dev/v1',
  apiKey: process.env.SUBCONSCIOUS_API_KEY || '',
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { query, config } = body;

    let prompt: string;
    let tools: string[];

    if (config) {
      prompt = config.prompt;
      tools = config.tools || [];
    } else {
      const agent = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);

      if (!agent || agent.length === 0) {
        return new Response('Agent not found', { status: 404 });
      }

      const agentData = agent[0];
      prompt = agentData.prompt;
      tools = Array.isArray(agentData.tools) ? agentData.tools : [];
    }

    const toolsArray = tools.map((tool: string) => ({
      type: tool as any,
    })) as any;

    const userMessage = query || prompt;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = '';
        let reasoning: any = null;
        let aborted = false;

        request.signal?.addEventListener('abort', () => {
          aborted = true;
        });

        try {
          const response = await client.chat.completions.create({
            model: 'tim-large',
            messages: [
              {
                role: 'system',
                content: prompt,
              },
              {
                role: 'user',
                content: userMessage,
              },
            ],
            tools: toolsArray.length > 0 ? toolsArray : [],
            stream: true,
          });

          for await (const chunk of response) {
            if (aborted || request.signal?.aborted) {
              const partialData = JSON.stringify({ 
                type: 'partial', 
                answer: fullContent,
                reasoning: reasoning,
                stopped: true 
              }) + '\n';
              controller.enqueue(encoder.encode(partialData));
              controller.close();
              return;
            }

            if (!chunk.choices || chunk.choices.length === 0) {
              continue;
            }

            const delta = chunk.choices[0]?.delta;
            
            const content = delta?.content || '';
            if (content) {
              fullContent += content;
              const chunkData = JSON.stringify({ type: 'content', content }) + '\n';
              controller.enqueue(encoder.encode(chunkData));
            }

            if (delta?.tool_calls) {
              if (!reasoning) {
                reasoning = [];
              }
              for (const toolCall of delta.tool_calls) {
                if (toolCall.function) {
                  const index = toolCall.index ?? 0;
                  if (!reasoning[index]) {
                    reasoning[index] = {
                      id: toolCall.id || '',
                      type: 'function',
                      function: {
                        name: toolCall.function.name || '',
                        arguments: toolCall.function.arguments || '',
                      },
                    };
                  } else {
                    if (toolCall.function.arguments) {
                      reasoning[index].function.arguments = 
                        (reasoning[index].function.arguments || '') + toolCall.function.arguments;
                    }
                    if (toolCall.function.name) {
                      reasoning[index].function.name = toolCall.function.name;
                    }
                    if (toolCall.id) {
                      reasoning[index].id = toolCall.id;
                    }
                  }

                  try {
                    const args = JSON.parse(reasoning[index].function.arguments || '{}');
                    const chunkData = JSON.stringify({ 
                      type: 'reasoning', 
                      reasoning: reasoning[index]
                    }) + '\n';
                    controller.enqueue(encoder.encode(chunkData));
                  } catch (e) {
                  }
                }
              }
            }
          }

          const finalData = JSON.stringify({ 
            type: 'done', 
            answer: fullContent,
            reasoning: reasoning 
          }) + '\n';
          controller.enqueue(encoder.encode(finalData));
          controller.close();
        } catch (error: any) {
          if (error.name === 'AbortError' || aborted || request.signal?.aborted) {
            const partialData = JSON.stringify({ 
              type: 'partial', 
              answer: fullContent,
              reasoning: reasoning,
              stopped: true 
            }) + '\n';
            controller.enqueue(encoder.encode(partialData));
            controller.close();
            return;
          }
          console.error('Error streaming response:', error);
          const errorData = JSON.stringify({ 
            type: 'error', 
            error: error.message || 'Failed to stream response' 
          }) + '\n';
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Error in run API:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
