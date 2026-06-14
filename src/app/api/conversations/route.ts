import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const userId = searchParams.get("user_id");

    let query = supabase
      .from("conversations")
      .select(`
        id,
        title,
        model,
        created_at,
        updated_at,
        messages:messages(count)
      `)
      .order("updated_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
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
    const { title, model } = body;

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        title: title || "New Chat",
        model: model || "kr/claude-sonnet-4.5",
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
