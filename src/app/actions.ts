"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, requireAdmin, requireSubscriber } from "@/lib/auth";

export async function signUpAction(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard/charity");
}

export async function signInAction(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const { profile } = await getProfile();
  if (profile?.role === "admin") redirect("/admin");
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function chooseCharityAction(formData: FormData) {
  const { user } = await requireSubscriber();
  const supabase = await createClient();
  const charityId = String(formData.get("charity_id") ?? "");

  const { error } = await supabase
    .from("profiles")
    .update({ charity_id: charityId })
    .eq("id", user.id);

  if (error) {
    redirect(`/dashboard/charity?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function joinTournamentAction(formData: FormData) {
  const { user, profile } = await requireSubscriber();
  const supabase = await createClient();
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const targetScore = Number(formData.get("target_score"));

  if (!profile.charity_id) redirect("/dashboard/charity");
  if (!tournamentId || !Number.isFinite(targetScore) || targetScore < 1) {
    redirect(`/dashboard/play/${tournamentId}?error=Enter a target score`);
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, charity_id")
    .eq("id", tournamentId)
    .maybeSingle();

  if (tournamentError || !tournament) {
    redirect("/dashboard?error=Tournament not found");
  }
  if (tournament.charity_id !== profile.charity_id) {
    redirect("/dashboard?error=This board belongs to another charity");
  }

  const { error } = await supabase.from("entries").insert({
    user_id: user.id,
    tournament_id: tournamentId,
    target_score: Math.round(targetScore),
    status: "registered",
  });

  if (error) {
    redirect(
      `/dashboard/play/${tournamentId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function submitScoreAction(formData: FormData) {
  const { user } = await requireSubscriber();
  const supabase = await createClient();
  const entryId = String(formData.get("entry_id") ?? "");
  const actualScore = Number(formData.get("actual_score"));
  const scoreImagePath = String(formData.get("score_image_path") ?? "");

  if (!entryId || !Number.isFinite(actualScore) || actualScore < 1) {
    redirect(`/dashboard/entry/${entryId}?error=Add your posted score`);
  }
  if (!scoreImagePath) {
    redirect(`/dashboard/entry/${entryId}?error=Upload a scorecard image first`);
  }

  const { error } = await supabase
    .from("entries")
    .update({
      actual_score: Math.round(actualScore),
      score_image_path: scoreImagePath,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .eq("user_id", user.id)
    .in("status", ["registered", "submitted", "rejected"]);

  if (error) {
    redirect(
      `/dashboard/entry/${entryId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createTournamentAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const payload = {
    charity_id: String(formData.get("charity_id") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    match_type: Number(formData.get("match_type")),
    venue: String(formData.get("venue") ?? "").trim() || null,
    starts_at: new Date(String(formData.get("starts_at"))).toISOString(),
    ends_at: new Date(String(formData.get("ends_at"))).toISOString(),
    reward_pool: Number(formData.get("reward_pool") ?? 0),
    notes: String(formData.get("notes") ?? "").trim() || null,
    status: "upcoming",
    created_by: user.id,
  };

  const { error } = await supabase.from("tournaments").insert(payload);
  if (error) {
    redirect(`/admin/tournaments?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");
  redirect("/admin/tournaments");
}

export async function deleteTournamentAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("tournaments").delete().eq("id", id);
  revalidatePath("/admin/tournaments");
  redirect("/admin/tournaments");
}

export async function setUserSubscriptionAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const isSubscribed = String(formData.get("is_subscribed")) === "true";
  await supabase.from("profiles").update({ is_subscribed: isSubscribed }).eq("id", id);
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function reviewEntryAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const adminNotes = String(formData.get("admin_notes") ?? "").trim() || null;

  const status = decision === "verify" ? "verified" : "rejected";
  await supabase
    .from("entries")
    .update({
      status,
      admin_notes: adminNotes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", id);

  revalidatePath("/admin/rewards");
  redirect("/admin/rewards");
}

export async function grantRewardAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const entryId = String(formData.get("entry_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);

  const { data: entry } = await supabase
    .from("entries")
    .select("id, user_id, status")
    .eq("id", entryId)
    .maybeSingle();

  if (!entry || (entry.status !== "verified" && entry.status !== "rewarded")) {
    redirect("/admin/rewards?error=Verify the scorecard first");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    redirect("/admin/rewards?error=Enter a reward amount");
  }

  const { error } = await supabase.from("rewards").insert({
    user_id: entry.user_id,
    entry_id: entry.id,
    amount,
    kind: "tournament",
    status: "approved",
  });

  if (error) {
    redirect(`/admin/rewards?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("entries").update({ status: "rewarded" }).eq("id", entryId);
  revalidatePath("/admin/rewards");
  redirect("/admin/rewards");
}

export async function markRewardPaidAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("rewards").update({ status: "paid" }).eq("id", id);
  revalidatePath("/admin/rewards");
  redirect("/admin/rewards");
}

export async function createDrawAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const period = String(formData.get("period") ?? "");
  const prizeAmount = Number(formData.get("prize_amount") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { error } = await supabase.from("monthly_draws").insert({
    period: `${period}-01`,
    prize_amount: prizeAmount,
    notes,
    status: "open",
  });

  if (error) {
    redirect(`/admin/draws?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/draws");
  revalidatePath("/draw");
  redirect("/admin/draws");
}

export async function runDrawAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.rpc("run_monthly_draw", { p_draw_id: id });
  if (error) {
    redirect(`/admin/draws?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/admin/draws");
  revalidatePath("/draw");
  redirect("/admin/draws");
}

export async function createCharityAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const { error } = await supabase.from("charities").insert({
    name,
    slug,
    tagline: String(formData.get("tagline") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
  });

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/charities");
  redirect("/admin");
}
