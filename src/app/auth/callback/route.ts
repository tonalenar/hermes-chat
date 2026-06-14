import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[AUTH CALLBACK] Code exchange error:", error.message);
        // Fallback: preserve code for client-side exchange
        const redirectUrl = new URL(next, origin);
        redirectUrl.searchParams.set("code", code);
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
