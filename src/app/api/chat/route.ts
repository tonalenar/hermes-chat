import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// Track sessions per conversation
const sessions = new Map<string, string>();

const HERMES_ENV = {
  ...process.env,
  HERMES_HOME: "/home/ubuntu/.hermes",
  PATH: `/home/ubuntu/.hermes/hermes-agent/venv/bin:/home/ubuntu/.nvm/versions/node/v24.16.0/bin:${process.env.PATH}`,
};

async function callHermes(message: string, sessionId?: string): Promise<{ response: string; sessionId: string }> {
  const args = ["chat", "-q", message, "-Q"];
  if (sessionId) {
    args.push("--resume", sessionId);
  }

  const { stdout, stderr } = await exec("hermes", args, {
    env: HERMES_ENV,
    timeout: 120_000,
    maxBuffer: 5 * 1024 * 1024,
  });

  const rawOutput = (stdout || "").trim();
  if (!rawOutput) {
    throw new Error("Empty response from Hermes");
  }

  // Parse session_id from stderr
  let newSessionId = sessionId || "";
  if (stderr) {
    const match = stderr.match(/session_id:\s*(\S+)/);
    if (match) newSessionId = match[1];
  }

  // Clean stdout
  const lines = rawOutput.split("\n");
  const clean = lines.filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (t.startsWith("session_id:")) return false;
    if (/^[─╭╰╮╯│┌┐└┘├┤┬┴┼]+$/.test(t)) return false;
    return true;
  });

  const response = clean.join("\n").trim() || rawOutput;
  return { response, sessionId: newSessionId };
}

export async function POST(req: NextRequest) {
  try {
    const { message, conversationId } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const existingSession = conversationId ? sessions.get(conversationId) : undefined;
    const result = await callHermes(message, existingSession);

    if (conversationId && result.sessionId) {
      sessions.set(conversationId, result.sessionId);
    }

    return NextResponse.json({
      response: result.response,
      sessionId: result.sessionId,
    });
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
