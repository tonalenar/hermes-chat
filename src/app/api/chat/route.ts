import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message, conversationHistory } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Build prompt with context
    let prompt = message;
    if (conversationHistory?.length > 0) {
      const ctx = conversationHistory
        .slice(-10)
        .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");
      prompt = `Context:\n${ctx}\n\nUser: ${message}`;
    }

    // Call hermes CLI
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);

    const { stdout } = await exec("hermes", ["chat", "-q", prompt, "-Q"], {
      env: {
        ...process.env,
        HERMES_HOME: "/home/ubuntu/.hermes",
        PATH: `/home/ubuntu/.hermes/hermes-agent/venv/bin:/home/ubuntu/.nvm/versions/node/v24.16.0/bin:${process.env.PATH}`,
      },
      timeout: 120_000,
      maxBuffer: 5 * 1024 * 1024,
    });

    if (!stdout?.trim()) {
      return NextResponse.json({ error: "Empty response from Hermes" }, { status: 500 });
    }

    // Parse: skip session_id line and box-drawing chars
    const lines = stdout.trim().split("\n");
    const clean = lines.filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (t.startsWith("session_id:")) return false;
      if (/^[─╭╰╮╯│┌┐└┘├┤┬┴┼]+$/.test(t)) return false;
      return true;
    });

    const response = clean.join("\n").trim() || stdout.trim();
    return NextResponse.json({ response });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("API error:", msg);

    if (msg.includes("ETIMEDOUT") || msg.includes("timed out")) {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    if (msg.includes("ENOENT")) {
      return NextResponse.json({ error: "Hermes CLI not found" }, { status: 500 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
