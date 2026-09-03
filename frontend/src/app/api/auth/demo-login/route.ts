import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const noStore = { "Cache-Control": "no-store, private" };

export async function POST() {
  const email = process.env.CARGOMESH_DEMO_LOGIN_EMAIL?.trim();
  const password = process.env.CARGOMESH_DEMO_LOGIN_PASSWORD;
  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: { code: "DEMO_LOGIN_UNAVAILABLE" } },
      { status: 503, headers: noStore },
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return NextResponse.json(
        { ok: false, error: { code: "DEMO_LOGIN_FAILED" } },
        { status: 401, headers: noStore },
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { ok: false, error: { code: "DEMO_MEMBERSHIP_REQUIRED" } },
        { status: 403, headers: noStore },
      );
    }

    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "DEMO_LOGIN_FAILED" } },
      { status: 500, headers: noStore },
    );
  }
}
