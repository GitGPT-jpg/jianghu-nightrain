import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  if (code) {
    const supabase = await createServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
