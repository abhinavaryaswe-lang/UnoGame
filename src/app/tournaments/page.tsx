import { createClient } from "@/lib/supabase/server";
import {
  formatDateTime,
  formatMoney,
  isSupabaseConfigured,
  matchLabel,
  tournamentPhase,
} from "@/lib/utils";
import { Badge, PageIntro, Panel } from "@/components/ui";
import type { Tournament } from "@/lib/types";

export default async function TournamentsPage() {
  let tournaments: Tournament[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tournaments")
      .select("*, charities(*)")
      .order("starts_at", { ascending: true });
    tournaments = (data as Tournament[]) ?? [];
  }

  const grouped = {
    5: tournaments.filter((item) => item.match_type === 5),
    4: tournaments.filter((item) => item.match_type === 4),
    3: tournaments.filter((item) => item.match_type === 3),
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <PageIntro
        eyebrow="Public board"
        title="Upcoming numbers, in the open."
        body="Everyone can see the calendar. Signing in is how you lock a target on a 5, 4, or 3-number match."
      />
      <div className="mt-12 space-y-12">
        {([5, 4, 3] as const).map((type) => (
          <section key={type}>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="display text-3xl">{matchLabel(type)}</h2>
              <span className="text-sm text-stone">{grouped[type].length} listed</span>
            </div>
            <div className="grid gap-4">
              {grouped[type].length === 0 ? (
                <p className="text-stone">Nothing posted in this format yet.</p>
              ) : (
                grouped[type].map((tournament) => (
                  <Panel
                    key={tournament.id}
                    className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge>{tournamentPhase(tournament.starts_at, tournament.ends_at)}</Badge>
                        <Badge>{tournament.charities?.name}</Badge>
                      </div>
                      <h3 className="mt-3 text-xl">{tournament.title}</h3>
                      <p className="mt-1 text-sm text-stone">
                        {tournament.venue ?? "Venue TBA"} ·{" "}
                        {formatDateTime(tournament.starts_at)} →{" "}
                        {formatDateTime(tournament.ends_at)}
                      </p>
                    </div>
                    <p className="text-cream">{formatMoney(tournament.reward_pool)}</p>
                  </Panel>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
