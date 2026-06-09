import { NextRequest, NextResponse } from "next/server";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "deepseek-ai/deepseek-v4-flash";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are Hermes, an AI assistant created by Nous Research. You are running inside the Hermes Chat web interface.

Guidelines:
- Be helpful, concise, and accurate
- Respond in the same language the user writes in (Portuguese if they write in Portuguese)
- You have access to web search, code execution, and file tools through the Hermes Agent platform
- When asked about your capabilities, mention you're powered by Hermes Agent
- Be friendly but professional
- Format responses with markdown when appropriate`;

export async function POST(req: NextRequest) {
  try {
    const { message, messages } = await req.json();

    if (!message && !messages) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "NVIDIA_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Build messages array for the API
    const chatMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // If full conversation history is provided, use it
    if (messages && Array.isArray(messages)) {
      for (const msg of messages) {
        chatMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    } else if (message) {
      chatMessages.push({ role: "user", content: message });
    }

    const response = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("NVIDIA API error:", response.status, errText);
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const reply =
      data.choices?.[0]?.message?.content || "No response from model.";

    return NextResponse.json({ response: reply });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Chat API error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
