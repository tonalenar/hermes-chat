import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { q } = body as { q: string };

    if (!q || !q.trim()) {
      return NextResponse.json(
        { error: "Search query 'q' is required" },
        { status: 400 }
      );
    }

    const searchTerm = `%${q.trim()}%`;
    const userId = request.headers.get("x-user-id") || null;

    // 1. Search conversations by title
    let titleQuery = supabase
      .from("conversations")
      .select("id, title, model, pinned, created_at, updated_at")
      .ilike("title", searchTerm)
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (userId) {
      titleQuery = titleQuery.eq("user_id", userId);
    }

    const { data: titleMatches, error: titleError } = await titleQuery;

    if (titleError) {
      console.error("[SUPABASE] search title error:", titleError);
    }

    // 2. Search messages by content — fetch matching conversation_ids first
    let msgQuery = supabase
      .from("messages")
      .select("id, conversation_id, role, content, model, created_at")
      .ilike("content", searchTerm)
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: rawMessages, error: msgError } = await msgQuery;

    if (msgError) {
      console.error("[SUPABASE] search messages error:", msgError);
    }

    let messages: any[] = rawMessages || [];
    let conversations: any[] = titleMatches || [];

    // 3. If we found messages, fetch their conversations (only non-archived)
    if (rawMessages && rawMessages.length > 0) {
      const convIds = [...new Set(rawMessages.map((m: any) => m.conversation_id))];

      let convQuery = supabase
        .from("conversations")
        .select("id, title, model, pinned, created_at, updated_at")
        .in("id", convIds)
        .eq("archived", false);

      if (userId) {
        convQuery = convQuery.eq("user_id", userId);
      }

      const { data: relatedConvs } = await convQuery;

      if (relatedConvs) {
        // Merge with title matches (avoid duplicates)
        const existingIds = new Set(conversations.map((c: any) => c.id));
        for (const conv of relatedConvs) {
          if (!existingIds.has(conv.id)) {
            conversations.push(conv);
            existingIds.add(conv.id);
          }
        }

        // Filter messages to only those belonging to accessible conversations
        const accessibleIds = new Set(relatedConvs.map((c: any) => c.id));
        messages = messages.filter((m: any) => accessibleIds.has(m.conversation_id));
      } else {
        // No accessible conversations — return no messages
        messages = [];
      }
    }

    return NextResponse.json({
      conversations,
      messages,
    });
  } catch (e) {
    console.error("[SUPABASE] search exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
