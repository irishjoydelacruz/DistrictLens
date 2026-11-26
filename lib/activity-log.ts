import { createClient } from "@/lib/supabase/client";

export async function logActivity(params: {
  action: string;
  entityType?: string;
  entityId?: string | number;
  details?: string;
}) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, team:teams(name)")
      .eq("id", user.id)
      .single();

    const team = profile?.team as
      | { name?: string }
      | { name?: string }[]
      | null;
    const teamName = Array.isArray(team) ? team[0]?.name : team?.name;

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      actor_name: profile?.full_name ?? user.email,
      actor_role: profile?.role ?? null,
      actor_team: teamName ?? null,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId != null ? String(params.entityId) : null,
      details: params.details ?? null,
    });
  } catch (error) {
    console.error("Activity log failed:", error);
  }
}