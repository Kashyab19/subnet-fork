import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

function getClient() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const subconsciousKey = process.env.SUBCONSCIOUS_API_KEY;
  
  if (openaiKey) {
    return new OpenAI({
      apiKey: openaiKey,
    });
  }
  
  if (subconsciousKey) {
    return new OpenAI({
      apiKey: subconsciousKey,
      baseURL: 'https://api.subconscious.dev/v1',
    });
  }
  
  throw new Error('No API key configured');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    let client: OpenAI;
    try {
      client = getClient();
    } catch (error) {
      console.error('No API key found. OPENAI_API_KEY or SUBCONSCIOUS_API_KEY must be set.');
      return NextResponse.json(
        { error: 'API key not configured. Please set OPENAI_API_KEY or SUBCONSCIOUS_API_KEY.' },
        { status: 500 }
      );
    }

    // Determine which model to use based on API
    const useOpenAI = !!process.env.OPENAI_API_KEY;
    const model = useOpenAI ? 'gpt-4o' : 'tim-large';

    // System prompt for optimization
    const optimizationPrompt = `You are an expert at writing high-quality system prompts for AI agents. Your task is to transform a basic or lazy user instruction into a robust, expert-level system prompt.

Apply these best practices:
1. **Chain of Thought**: Include explicit reasoning steps the agent should follow
2. **Few-shot Examples**: Add 2-3 concrete examples showing desired behavior
3. **Clear Constraints**: Define boundaries, limitations, and error handling
4. **Structured Format**: Use clear sections (Role, Instructions, Examples, Constraints)
5. **Specificity**: Replace vague terms with concrete, actionable instructions
6. **Tool Usage**: If tools are mentioned, explain when and how to use them

Transform this user instruction into an expert-level system prompt:

"${prompt}"

       Return ONLY the optimized system prompt, without any additional commentary or explanation.`;

      if (useOpenAI) {
        const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert prompt engineer specializing in creating high-quality system prompts for AI agents.',
          },
          {
            role: 'user',
            content: optimizationPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const optimizedPrompt = response.choices[0]?.message?.content?.trim();

      if (!optimizedPrompt) {
        return NextResponse.json(
          { error: 'Failed to generate optimized prompt' },
          { status: 500 }
        );
      }

            return NextResponse.json({ optimizedPrompt });
          } else {
            const userMessage = `Transform this into a detailed system prompt with examples and clear instructions: "${prompt}"`;

      try {
        const response = await client.chat.completions.create({
          model: 'tim-large',
          messages: [{ role: 'user', content: userMessage }],
          temperature: 0.7,
          max_tokens: 1000,
          stream: true,
        });

        let optimizedPrompt = '';
        for await (const chunk of response) {
          const content = chunk.choices?.[0]?.delta?.content || '';
          if (content) {
            optimizedPrompt += content;
          }
        }

        const trimmed = optimizedPrompt.trim();
        if (!trimmed) {
          return NextResponse.json(
            { error: 'Empty response from API' },
            { status: 500 }
          );
        }

        return NextResponse.json({ optimizedPrompt: trimmed });
      } catch (streamError: any) {
        console.error('Subconscious API stream error:', streamError);
        const errorMsg = streamError?.error || streamError?.message || 'Internal server error from API';
        return NextResponse.json(
          { 
            error: `Subconscious API error: ${errorMsg}. Please set OPENAI_API_KEY for better reliability, or try again later.` 
          },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error('Error optimizing prompt:', error);
    const errorMessage = error?.message || 'Failed to optimize prompt. Please try again.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

