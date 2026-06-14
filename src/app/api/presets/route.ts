import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: presets, error } = await supabase
      .from("prompt_presets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[SUPABASE] presets list error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ presets: presets || [] });
  } catch (e) {
    console.error("[SUPABASE] presets exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, instructions, temperature } = body as {
      name: string;
      instructions: string;
      temperature?: number;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Field 'name' is required" },
        { status: 400 }
      );
    }

    if (!instructions || !instructions.trim()) {
      return NextResponse.json(
        { error: "Field 'instructions' is required" },
        { status: 400 }
      );
    }

    const { data: preset, error } = await supabase
      .from("prompt_presets")
      .insert({
        name: name.trim(),
        instructions: instructions.trim(),
        temperature: temperature ?? 0.7,
      })
      .select()
      .single();

    if (error) {
      console.error("[SUPABASE] preset create error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ preset });
  } catch (e) {
    console.error("[SUPABASE] preset create exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id || !id.trim()) {
      return NextResponse.json(
        { error: "Query parameter 'id' is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("prompt_presets")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[SUPABASE] preset delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[SUPABASE] preset delete exception:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
