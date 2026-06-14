import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

const BASE_URL = process.env.OPENAI_BASE_URL || "http://localhost:20128/v1";
const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "kr/claude-sonnet-4.5";

async function saveToSupabase(
  conversationId: string,
  role: string,
  content: string,
  modelName: string = MODEL,
  tokensUsed?: number
) {
  console.log("[SUPABASE] saveToSupabase called:", { conversationId, role, modelName, tokensUsed });
  try {
    // Upsert conversation with title for new conversations
    const defaultTitle: string | undefined = role === "user" && typeof content === 'string'
      ? content.slice(0, 40)
      : undefined;
    const convData: Record<string, any> = {
      id: conversationId,
      updated_at: new Date().toISOString(),
    };
    if (defaultTitle) convData.title = defaultTitle;
    // Update tokens_used on conversation (aggregate)
    if (tokensUsed) {
      convData.tokens_used = tokensUsed;
    }

    const { error: convError } = await supabase.from("conversations").upsert(convData, {
      onConflict: 'id',
    });
    if (convError) console.error("[SUPABASE] conv error:", convError);

    // Insert message
    const msgId = crypto.randomUUID();
    const msgInsert: Record<string, any> = {
      id: msgId,
      conversation_id: conversationId,
      role,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      model: modelName,
    };
    if (tokensUsed !== undefined) {
      msgInsert.tokens_used = tokensUsed;
    }
    const { error: msgError } = await supabase.from("messages").insert(msgInsert);
    if (msgError) console.error("[SUPABASE] msg error:", msgError);
  } catch (e) {
    console.error("[SUPABASE] exception:", e);
  }
}

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
    let model: string = MODEL; // Use env default, or override from request
    let temperature: number | undefined;
    let systemInstructions: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      message = (formData.get("message") as string) || "";
      conversationId = formData.get("conversationId") as string | undefined;
      const modelFromForm = formData.get("model") as string | undefined;
      if (modelFromForm) model = modelFromForm;
      const tempFromForm = formData.get("temperature") as string | undefined;
      if (tempFromForm) temperature = parseFloat(tempFromForm);
      systemInstructions = formData.get("systemInstructions") as string | undefined;
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
      if (body.model) model = body.model;
      if (body.temperature !== undefined) temperature = body.temperature;
      if (body.systemInstructions) systemInstructions = body.systemInstructions;
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
      // Save to Supabase
      const userContentStr = typeof userContent === 'string' ? userContent : JSON.stringify(userContent);
      saveToSupabase(conversationId, "user", userContentStr, model);
    }

    const openAiBody: Record<string, unknown> = {
      model: model,
      messages,
      stream: true,
    };
    if (temperature !== undefined) {
      openAiBody.temperature = temperature;
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(openAiBody),
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
      let totalTokensUsed: number | undefined;

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
                  // Capture usage from final chunk (OpenAI-compatible format)
                  if (parsed.usage) {
                    totalTokensUsed = parsed.usage.total_tokens;
                    // Forward usage info as metadata event
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify({ type: "metadata", tokens_used: totalTokensUsed })}\n\n`
                      )
                    );
                  }
                } catch {
                  // skip malformed chunks
                }
              }
            }
            // Save assistant response with token count
            if (conversationId && fullContent) {
              const conv = conversations.get(conversationId);
              if (conv) conv.push({ role: "assistant", content: fullContent });
              // Save to Supabase with tokens_used if available
              saveToSupabase(conversationId, "assistant", fullContent, model, totalTokensUsed);
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
    const tokensUsed = data.usage?.total_tokens;
    if (conversationId) {
      const conv = conversations.get(conversationId);
      if (conv) conv.push({ role: "assistant", content });
      // Save to Supabase with token count
      saveToSupabase(conversationId, "assistant", content, model, tokensUsed);
    }
    return new Response(
      JSON.stringify({ 
        response: content,
        tokens_used: tokensUsed,
        metadata: tokensUsed ? { tokens_used: tokensUsed } : undefined
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Chat API error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
