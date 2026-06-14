import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// CORS headers for public share endpoint
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Use server client (service role) to bypass RLS for public access
    const serverClient = createServerClient();

    const { data: conv, error: convError } = await serverClient
      .from("conversations")
      .select("*")
      .eq("share_token", token)
      .single();

    if (convError || !conv) {
      return NextResponse.json(
        { error: "Shared conversation not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Do not expose archived conversations
    if (conv.archived) {
      return NextResponse.json(
        { error: "Shared conversation not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const { data: messages, error: msgError } = await serverClient
      .from("messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("[SUPABASE] share messages error:", msgError);
    }

    // Return only public-safe fields
    const publicConversation = {
      id: conv.id,
      title: conv.title,
      model: conv.model,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
    };

    const publicMessages = (messages || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      model: m.model,
      created_at: m.created_at,
    }));

    return NextResponse.json(
      {
        conversation: publicConversation,
        messages: publicMessages,
      },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error("[SUPABASE] share exception:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
