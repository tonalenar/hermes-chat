import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const userId = searchParams.get("user_id");
    const searchQuery = searchParams.get("q");
    const archivedOnly = searchParams.get("archived") === "true";

    let query = supabase
      .from("conversations")
      .select(`
        id,
        title,
        model,
        pinned,
        archived,
        share_token,
        created_at,
        updated_at,
        messages:messages(count)
      `)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    // By default, exclude archived conversations unless ?archived=true
    if (archivedOnly) {
      query = query.eq("archived", true);
    } else {
      query = query.eq("archived", false);
    }

    // Text search: search title ILIKE OR content ILIKE in messages
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = `%${searchQuery.trim()}%`;

      // Find conversation IDs that have matching messages
      const { data: msgMatches } = await supabase
        .from("messages")
        .select("conversation_id")
        .ilike("content", searchTerm);

      const matchingIds = [
        ...new Set((msgMatches || []).map((m: any) => m.conversation_id)),
      ];

      if (matchingIds.length > 0) {
        query = query.or(
          `title.ilike.${searchTerm},id.in.(${matchingIds.join(",")})`
        );
      } else {
        query = query.ilike("title", searchTerm);
      }
    }

    const { data, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("[SUPABASE] conversations error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversations: data || [] });
  } catch (e) {
    console.error("[SUPABASE] conversations exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, model, pinned, archived } = body;

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        title: title || "New Chat",
        model: model || "kr/claude-sonnet-4.5",
        pinned: pinned || false,
        archived: archived || false,
      })
      .select()
      .single();

    if (error) {
      console.error("[SUPABASE] create conversation error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversation: data });
  } catch (e) {
    console.error("[SUPABASE] create conversation exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
