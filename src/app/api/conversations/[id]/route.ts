import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const isShareView = searchParams.get("share") === "true";

    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .single();

    if (convError || !conv) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("[SUPABASE] messages error:", msgError);
    }

    // If share view, return only public-safe fields
    if (isShareView) {
      return NextResponse.json({
        conversation: {
          id: conv.id,
          title: conv.title,
          model: conv.model,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
        },
        messages: (messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          model: m.model,
          created_at: m.created_at,
        })),
      });
    }

    return NextResponse.json({
      conversation: conv,
      messages: messages || [],
    });
  } catch (e) {
    console.error("[SUPABASE] get conversation exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, model, user_id, pinned, archived } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (model !== undefined) updates.model = model;
    if (user_id !== undefined) updates.user_id = user_id;
    if (pinned !== undefined) updates.pinned = pinned;
    if (archived !== undefined) updates.archived = archived;

    const { data, error } = await supabase
      .from("conversations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[SUPABASE] update conversation error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversation: data });
  } catch (e) {
    console.error("[SUPABASE] update conversation exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if conversation is already archived
    const { data: conv } = await supabase
      .from("conversations")
      .select("archived")
      .eq("id", id)
      .single();

    if (conv?.archived) {
      // Already archived: hard delete
      await supabase.from("messages").delete().eq("conversation_id", id);
      const { error } = await supabase.from("conversations").delete().eq("id", id);

      if (error) {
        console.error("[SUPABASE] hard delete conversation error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, hard_delete: true });
    }

    // Not archived yet: soft delete (set archived=true)
    const { error } = await supabase
      .from("conversations")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("[SUPABASE] soft delete conversation error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, archived: true });
  } catch (e) {
    console.error("[SUPABASE] delete conversation exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
