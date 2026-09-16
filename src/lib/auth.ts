import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export async function getSessionUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile() {
  if (!isSupabaseConfigured()) return { user: null, profile: null };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { user: null, profile: null };

    const { data: profile } = await supabase
      .from("profiles")
      .select("*, charities(*)")
      .eq("id", user.id)
      .maybeSingle();

    return { user, profile: profile as Profile | null };
  } catch {
    return { user: null, profile: null };
  }
}

export async function requireSubscriber() {
  const { user, profile } = await getProfile();
  if (!user || !profile) redirect("/login");
  if (profile.role !== "admin" && !profile.is_subscribed) {
    redirect("/dashboard/inactive");
  }
  return { user, profile };
}

export async function requireAdmin() {
  const { user, profile } = await getProfile();
  if (!user || !profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");
  return { user, profile };
}
