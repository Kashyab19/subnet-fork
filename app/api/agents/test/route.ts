import { NextRequest } from 'next/server';
import OpenAI from 'openai';

// Initialize the client with Subconscious endpoint
const client = new OpenAI({
  baseURL: 'https://api.subconscious.dev/v1',
  apiKey: process.env.SUBCONSCIOUS_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, tools, query } = body;

    if (!prompt) {
      return new Response('Prompt is required', { status: 400 });
    }

    // Parse tools from the request
    const toolsArray = Array.isArray(tools) ? tools : [];

    // Map tools to the format expected by Subconscious API
    const mappedTools = toolsArray.map((tool: string) => ({
      type: tool as any,
    })) as any;

    // Create a streaming response using ReadableStream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Combine the prompt with the query if provided
          const fullPrompt = query ? `${prompt}\n\nUser query: ${query}` : prompt;

          const response = await client.chat.completions.create({
            model: 'tim-large',
            messages: [
              {
                role: 'user',
                content: fullPrompt,
              },
            ],
            tools: mappedTools.length > 0 ? mappedTools : [],
            stream: true,
          });

          // Stream the response
          for await (const chunk of response) {
            // Handle different possible chunk structures
            if (!chunk.choices || chunk.choices.length === 0) {
              console.log('No choices in chunk', chunk);
              continue;
            }

            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              console.log('Content in chunk', content);
              controller.enqueue(encoder.encode(content));
            }
          }

          controller.close();
        } catch (error) {
          console.error('Error streaming response:', error);
          controller.error(error);
        }
      },
    });

    // Return the stream
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in test API:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

