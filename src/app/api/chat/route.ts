import { NextRequest } from "next/server";

const BASE_URL = process.env.OPENAI_BASE_URL || "http://localhost:20128/v1";
const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "kr/claude-sonnet-4.5";

// In-memory conversation store
const conversations = new Map<string, Array<{ role: string; content: string | any }>>();

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_DOCUMENT_TYPES = [
  "text/plain",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
];

function getMimeCategory(type: string): string {
  if (ALLOWED_IMAGE_TYPES.includes(type)) return "image";
  if (ALLOWED_DOCUMENT_TYPES.includes(type)) return "document";
  if (type.startsWith("text/")) return "text";
  return "unknown";
}

async function processFile(file: File): Promise<{ type: string; content: string; name: string }> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString("base64");
  const mimeType = file.type;
  const category = getMimeCategory(mimeType);

  if (category === "image") {
    return {
      type: "image_url",
      content: `data:${mimeType};base64,${base64}`,
      name: file.name,
    };
  }

  // For documents, try to extract text
  if (category === "text" || mimeType === "text/plain") {
    const text = buffer.toString("utf-8");
    return {
      type: "text",
      content: `[Arquivo: ${file.name}]\n${text.slice(0, 5000)}`,
      name: file.name,
    };
  }

  // For PDF, use base64 (most vision models can handle it)
  if (mimeType === "application/pdf") {
    return {
      type: "image_url",
      content: `data:${mimeType};base64,${base64}`,
      name: file.name,
    };
  }

  // For other documents, just mention the file name
  return {
    type: "text",
    content: `[Arquivo anexado: ${file.name} (tipo: ${mimeType})]`,
    name: file.name,
  };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let message: string;
    let files: File[] = [];
    let conversationId: string | undefined;
    let clientMessages: any[] | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      message = (formData.get("message") as string) || "";
      conversationId = formData.get("conversationId") as string | undefined;
      const messagesStr = formData.get("messages") as string | undefined;
      if (messagesStr) {
        try {
          clientMessages = JSON.parse(messagesStr);
        } catch {}
      }

      const fileEntries = formData.getAll("files") as File[];
      files = fileEntries.filter((f) => f.size > 0);
    } else {
      const body = await req.json();
      message = body.message;
      conversationId = body.conversationId;
      clientMessages = body.messages;
    }

    if (!message && files.length === 0) {
      return new Response(JSON.stringify({ error: "Message or file is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Process files
    let processedFiles: any[] = [];
    if (files.length > 0) {
      processedFiles = await Promise.all(files.map(processFile));
    }

    // Build user content (text + images)
    let userContent: string | any[];
    
    if (processedFiles.length > 0) {
      // Build multimodal content
      userContent = [];
      
      if (message) {
        userContent.push({ type: "text", text: message });
      }
      
      for (const file of processedFiles) {
        if (file.type === "image_url") {
          userContent.push({
            type: "image_url",
            image_url: { url: file.content }
          });
        } else {
          userContent.push({ type: "text", text: file.content });
        }
      }
    } else {
      userContent = message;
    }

    // Build messages array
    let messages: Array<{ role: string; content: string | any }>;

    if (clientMessages && Array.isArray(clientMessages)) {
      messages = [...clientMessages, { role: "user", content: userContent }];
    } else if (conversationId && conversations.has(conversationId)) {
      messages = conversations.get(conversationId)!;
      messages.push({ role: "user", content: userContent });
    } else {
      messages = [{ role: "user", content: userContent }];
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