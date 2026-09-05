import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request, { params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: journey } = await supabase
    .from("journeys")
    .select("id, user_id, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!journey || journey.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (journey.status === "completed") {
    return NextResponse.json({ ok: true }); // already done, nothing to do
  }

  const { error } = await supabase
    .from("journeys")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", journey.id);

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
