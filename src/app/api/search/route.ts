import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const conversationId = searchParams.get("conversation_id");

    if (!q || !q.trim()) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const searchTerm = `%${q.trim()}%`;

    let query = supabase
      .from("messages")
      .select("id, conversation_id, role, content, created_at")
      .ilike("content", searchTerm)
      .order("created_at", { ascending: false })
      .limit(50);

    if (conversationId && conversationId.trim()) {
      query = query.eq("conversation_id", conversationId);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error("[SUPABASE] search error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (e) {
    console.error("[SUPABASE] search exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
