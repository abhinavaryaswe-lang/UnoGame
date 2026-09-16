import { notFound, redirect } from "next/navigation";
import { requireSubscriber } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { joinTournamentAction } from "@/app/actions";
import {
  formatDateTime,
  formatMoney,
  matchLabel,
  tournamentPhase,
} from "@/lib/utils";
import {
  Badge,
  Button,
  ErrorNote,
  Field,
  inputClass,
  PageIntro,
  Panel,
} from "@/components/ui";
import type { Tournament } from "@/lib/types";

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { user, profile } = await requireSubscriber();
  if (!profile.charity_id) redirect("/dashboard/charity");

  const supabase = await createClient();
  const { data } = await supabase
    .from("tournaments")
    .select("*, charities(*)")
    .eq("id", id)
    .maybeSingle();
  const tournament = data as Tournament | null;
  if (!tournament) notFound();
  if (tournament.charity_id !== profile.charity_id) redirect("/dashboard");

  const { data: existing } = await supabase
    .from("entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("tournament_id", tournament.id)
    .maybeSingle();
  if (existing) redirect(`/dashboard/entry/${existing.id}`);

  const phase = tournamentPhase(tournament.starts_at, tournament.ends_at);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <PageIntro
        eyebrow={matchLabel(tournament.match_type)}
        title={tournament.title}
        body={`Set the target you intend to shoot. After ${formatDateTime(tournament.ends_at)} you will upload the scorecard image for review.`}
      />
      <Panel className="mt-10 space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge>{phase}</Badge>
          <Badge>{tournament.charities?.name}</Badge>
          <Badge>{formatMoney(tournament.reward_pool)}</Badge>
        </div>
        <p className="text-sm text-stone">
          {tournament.venue ?? "Venue TBA"} · {formatDateTime(tournament.starts_at)}{" "}
          → {formatDateTime(tournament.ends_at)}
        </p>
        {tournament.notes ? (
          <p className="text-cream-dim">{tournament.notes}</p>
        ) : null}
        <ErrorNote message={query.error} />
        <form action={joinTournamentAction} className="space-y-5">
          <input type="hidden" name="tournament_id" value={tournament.id} />
          <Field label="Target score">
            <input
              className={inputClass()}
              type="number"
              name="target_score"
              min={1}
              required
              placeholder="The number you want to post"
            />
          </Field>
          <Button type="submit">Lock target and enter</Button>
        </form>
      </Panel>
    </main>
  );
}
