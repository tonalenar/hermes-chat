import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId } = body as { conversationId: string };

    if (!conversationId || !conversationId.trim()) {
      return NextResponse.json(
        { error: "Field 'conversationId' is required" },
        { status: 400 }
      );
    }

    const shareToken = randomUUID();

    const { error: updateError } = await supabase
      .from("conversations")
      .update({ share_token: shareToken })
      .eq("id", conversationId);

    if (updateError) {
      console.error("[SUPABASE] share update error:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const url = `${baseUrl}/share/${shareToken}`;

    return NextResponse.json({ share_token: shareToken, url });
  } catch (e) {
    console.error("[SUPABASE] share exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token || !token.trim()) {
      return NextResponse.json(
        { error: "Query parameter 'token' is required" },
        { status: 400 }
      );
    }

    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("share_token", token)
      .single();

    if (convError || !conv) {
      return NextResponse.json(
        { error: "Shared conversation not found" },
        { status: 404 }
      );
    }

    const { data: messages, error: msgError } = await supabase
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

    const publicMessages = (messages || []).map(
      (m: { id: string; role: string; content: string; model: string | null; created_at: string }) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        model: m.model,
        created_at: m.created_at,
      })
    );

    return NextResponse.json({
      conversation: publicConversation,
      messages: publicMessages,
    });
  } catch (e) {
    console.error("[SUPABASE] share exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
