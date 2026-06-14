import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
    const { title, model } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title) updates.title = title;
    if (model) updates.model = model;

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

    // Delete messages first (cascade should handle this, but just in case)
    await supabase.from("messages").delete().eq("conversation_id", id);
    // Delete conversation
    const { error } = await supabase.from("conversations").delete().eq("id", id);

    if (error) {
      console.error("[SUPABASE] delete conversation error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[SUPABASE] delete conversation exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
