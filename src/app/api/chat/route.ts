import { NextRequest } from "next/server";

const BASE_URL = process.env.OPENAI_BASE_URL || "http://localhost:20128/v1";
const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "kr/claude-sonnet-4.5";

// In-memory conversation store
const conversations = new Map<string, Array<{ role: string; content: string }>>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, conversationId, messages: clientMessages } = body;

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build messages array
    let messages: Array<{ role: string; content: string }>;

    if (clientMessages && Array.isArray(clientMessages)) {
      messages = [...clientMessages, { role: "user", content: message }];
    } else if (conversationId && conversations.has(conversationId)) {
      messages = conversations.get(conversationId)!;
      messages.push({ role: "user", content: message });
    } else {
      messages = [{ role: "user", content: message }];
    }

    // Store conversation
    if (conversationId) {
      conversations.set(conversationId, messages);
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `API error ${response.status}: ${errText}` }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // If we got a streaming response
    if (response.headers.get("content-type")?.includes("text/event-stream") || response.body) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      const stream = new ReadableStream({
        async start(controller) {
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") {
                  controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                  continue;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullContent += content;
                    controller.enqueue(
                      new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`)
                    );
                  }
                } catch {
                  // skip malformed chunks
                }
              }
            }
            // Save assistant response
            if (conversationId && fullContent) {
              const conv = conversations.get(conversationId);
              if (conv) conv.push({ role: "assistant", content: fullContent });
            }
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Fallback: non-streaming response
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    if (conversationId) {
      const conv = conversations.get(conversationId);
      if (conv) conv.push({ role: "assistant", content });
    }
    return new Response(JSON.stringify({ response: content }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Chat API error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
