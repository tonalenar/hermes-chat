import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message, conversationHistory } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Build prompt with conversation context
    let fullPrompt = message;
    if (conversationHistory && conversationHistory.length > 0) {
      const context = conversationHistory
        .slice(-10)
        .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");
      fullPrompt = `Previous conversation:\n${context}\n\nUser: ${message}`;
    }

    // Call Hermes CLI in quiet mode
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    const timeout = 120_000;

    const { stdout } = await execFileAsync(
      "hermes",
      ["chat", "-q", fullPrompt, "-Q"],
      {
        env: {
          ...process.env,
          HERMES_HOME: process.env.HERMES_HOME || "/home/ubuntu/.hermes",
          PATH: `/home/ubuntu/.hermes/hermes-agent/venv/bin:/home/ubuntu/.nvm/versions/node/v24.16.0/bin:${process.env.PATH}`,
        },
        timeout,
        maxBuffer: 1024 * 1024 * 5,
      }
    );

    if (!stdout?.trim()) {
      return NextResponse.json({ error: "Hermes returned empty response" }, { status: 500 });
    }

    // Parse output: first line is "session_id: xxx", rest is the response
    const lines = stdout.trim().split("\n");
    let response: string;

    if (lines[0]?.startsWith("session_id:")) {
      response = lines.slice(1).join("\n").trim();
    } else {
      response = stdout.trim();
    }

    // Filter out any metadata lines that leaked through
    response = response
      .split("\n")
      .filter((line) => {
        const l = line.trim();
        return !l.startsWith("Initializing") && !l.startsWith("─") && !l.startsWith("╭") && !l.startsWith("╰") && !l.startsWith("Resume this") && !l.startsWith("hermes --") && !l.startsWith("Session:") && !l.startsWith("Duration:") && !l.startsWith("Messages:");
      })
      .join("\n")
      .trim();

    if (!response) {
      response = stdout.trim();
    }

    return NextResponse.json({ response });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Chat API error:", errorMessage);
    return NextResponse.json({ error: "Failed to process message", details: errorMessage }, { status: 500 });
  }
}
