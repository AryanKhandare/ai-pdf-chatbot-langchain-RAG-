import { NextResponse } from 'next/server';
import { retrievalAssistantStreamConfig } from '@/constants/graphConfigs';
import { graph as retrievalGraph } from '../../../../backend/src/retrieval_graph/graph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { message, messages } = await req.json();

    if (!message) {
      return new NextResponse(
        JSON.stringify({ error: 'Message is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    try {
      const formattedMessages = (messages || []).map((m: any) => 
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
      );

      const stream = await retrievalGraph.stream(
        { query: message, messages: formattedMessages },
        {
          streamMode: ['messages', 'updates'],
          configurable: {
            ...retrievalAssistantStreamConfig,
          },
        },
      );

      // Set up response as a stream
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            // Forward each chunk from the graph to the client
            for await (const chunk of stream) {
              const [mode, payload] = chunk;
              
              if (mode === 'messages') {
                const [msgChunk] = payload;
                if (msgChunk && (msgChunk._getType() === 'ai' || msgChunk.getType?.() === 'ai')) {
                  const sseEvent = {
                    event: 'messages/partial',
                    data: [{ type: 'ai', content: msgChunk.content }]
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseEvent)}\n\n`));
                }
              } else if (mode === 'updates') {
                const sseEvent = {
                  event: 'updates',
                  data: payload
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseEvent)}\n\n`));
              }
            }
          } catch (error) {
            console.error('Streaming error:', error);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: 'Streaming error occurred' })}\n\n`,
              ),
            );
          } finally {
            controller.close();
          }
        },
      });

      // Return the stream with appropriate headers
      return new Response(customReadable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } catch (error) {
      // Handle streamRun errors
      console.error('Stream initialization error:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    // Handle JSON parsing errors
    console.error('Route error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
