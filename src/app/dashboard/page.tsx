import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSubscriber } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatDateTime,
  formatMoney,
  matchCopy,
  matchLabel,
  tournamentPhase,
} from "@/lib/utils";
import { Badge, PageIntro, Panel } from "@/components/ui";
import type { Entry, Reward, Tournament } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await requireSubscriber();
  if (!profile.charity_id) redirect("/dashboard/charity");

  const supabase = await createClient();
  const [{ data: tournaments }, { data: entries }, { data: rewards }] =
    await Promise.all([
      supabase
        .from("tournaments")
        .select("*, charities(*)")
        .eq("charity_id", profile.charity_id)
        .order("starts_at"),
      supabase
        .from("entries")
        .select("*, tournaments(*, charities(*))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("rewards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  const boards = (tournaments as Tournament[]) ?? [];
  const myEntries = (entries as Entry[]) ?? [];
  const myRewards = (rewards as Reward[]) ?? [];
  const enteredIds = new Set(myEntries.map((entry) => entry.tournament_id));

  const byType = {
    5: boards.filter((item) => item.match_type === 5),
    4: boards.filter((item) => item.match_type === 4),
    3: boards.filter((item) => item.match_type === 3),
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <PageIntro
          eyebrow="Locker"
          title={`Playing for ${profile.charities?.name ?? "your charity"}.`}
          body="Choose a format, set the score you want to post, then upload the card after the round. Admin review unlocks the money."
        />
        <Link href="/dashboard/charity" className="text-sm text-copper">
          Change charity
        </Link>
      </div>
      {params.error ? (
        <p className="mt-6 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
          {params.error}
        </p>
      ) : null}

      <div className="mt-12 grid gap-10">
        {([5, 4, 3] as const).map((type) => (
          <section key={type}>
            <h2 className="display text-3xl">{matchLabel(type)}</h2>
            <p className="mt-1 text-sm text-stone">{matchCopy(type)}</p>
            <div className="mt-5 grid gap-4">
              {byType[type].length === 0 ? (
                <p className="text-stone">No {matchLabel(type)} on this house yet.</p>
              ) : (
                byType[type].map((tournament) => {
                  const phase = tournamentPhase(
                    tournament.starts_at,
                    tournament.ends_at,
                  );
                  const entry = myEntries.find(
                    (item) => item.tournament_id === tournament.id,
                  );
                  return (
                    <Panel
                      key={tournament.id}
                      className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge>{phase}</Badge>
                          <Badge>{formatMoney(tournament.reward_pool)}</Badge>
                        </div>
                        <h3 className="mt-3 text-xl">{tournament.title}</h3>
                        <p className="text-sm text-stone">
                          {tournament.venue ?? "Venue TBA"} ·{" "}
                          {formatDateTime(tournament.starts_at)}
                        </p>
                      </div>
                      {entry ? (
                        <Link
                          href={`/dashboard/entry/${entry.id}`}
                          className="rounded-full bg-cream px-5 py-2.5 text-sm text-ink"
                        >
                          {entry.status === "registered"
                            ? "Upload scorecard"
                            : `Entry: ${entry.status}`}
                        </Link>
                      ) : enteredIds.has(tournament.id) ? null : (
                        <Link
                          href={`/dashboard/play/${tournament.id}`}
                          className="rounded-full bg-coral px-5 py-2.5 text-sm text-white"
                        >
                          Play this board
                        </Link>
                      )}
                    </Panel>
                  );
                })
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="display text-3xl">Your cards</h2>
        <div className="mt-5 grid gap-3">
          {myEntries.length === 0 ? (
            <p className="text-stone">No targets locked yet.</p>
          ) : (
            myEntries.map((entry) => (
              <Panel
                key={entry.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-cream">{entry.tournaments?.title}</p>
                  <p className="text-sm text-stone">
                    Target {entry.target_score}
                    {entry.actual_score ? ` · posted ${entry.actual_score}` : ""}
                  </p>
                </div>
                <Badge>{entry.status}</Badge>
              </Panel>
            ))
          )}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="display text-3xl">Rewards</h2>
        <div className="mt-5 grid gap-3">
          {myRewards.length === 0 ? (
            <p className="text-stone">No payouts yet. Verified cards feed both match rewards and the monthly draw.</p>
          ) : (
            myRewards.map((reward) => (
              <Panel
                key={reward.id}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="capitalize">{reward.kind.replace("_", " ")}</p>
                  <p className="text-sm text-stone">{reward.status}</p>
                </div>
                <p>{formatMoney(reward.amount)}</p>
              </Panel>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
