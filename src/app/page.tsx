import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, formatMoney, formatDate, matchLabel } from "@/lib/utils";
import type { Charity, MonthlyDraw, Tournament } from "@/lib/types";

export default async function HomePage() {
  let charities: Charity[] = [];
  let tournaments: Tournament[] = [];
  let draw: MonthlyDraw | null = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [charityRes, tournamentRes, drawRes] = await Promise.all([
      supabase.from("charities").select("*").order("name"),
      supabase
        .from("tournaments")
        .select("*, charities(*)")
        .gte("ends_at", new Date().toISOString())
        .order("starts_at")
        .limit(6),
      supabase
        .from("monthly_draws")
        .select("*")
        .eq("status", "open")
        .order("period", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    charities = (charityRes.data as Charity[]) ?? [];
    tournaments = (tournamentRes.data as Tournament[]) ?? [];
    draw = (drawRes.data as MonthlyDraw) ?? null;
  }

  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="eyebrow">Performance · Charity · Draw</p>
          <h1 className="display mt-5 max-w-xl text-6xl leading-[0.92] text-cream sm:text-7xl">
            Post a number.
            <br />
            Fund a charity.
            <br />
            Hold a ticket.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-cream-dim">
            GolfClub tracks the score you said you would shoot, the card you actually
            posted, and the monthly draw that follows. No clubhouse chrome. Just
            proof.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white"
            >
              Become a subscriber
            </Link>
            <Link
              href="/tournaments"
              className="rounded-full border border-line px-6 py-3 text-sm text-cream"
            >
              View public boards
            </Link>
          </div>
        </div>
        <div className="rounded-[2rem] border border-line bg-gradient-to-br from-copper/20 via-ink-soft to-ink p-8">
          <p className="eyebrow">This month</p>
          <p className="display mt-4 text-5xl text-cream">
            {draw ? formatMoney(draw.prize_amount) : "Set the pot"}
          </p>
          <p className="mt-3 text-cream-dim">
            Verified scorecards become draw tickets. Public visitors can watch the
            board. Subscribers play it.
          </p>
        </div>
      </section>

      <section className="border-y border-line">
        <div className="mx-auto grid max-w-6xl gap-px bg-line md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Public",
              d: "Browse charities, upcoming boards, and the live monthly draw. No account required.",
            },
            {
              n: "02",
              t: "Subscribed",
              d: "Pick a charity, choose a 5 / 4 / 3-number match, lock a target, then upload the card.",
            },
            {
              n: "03",
              t: "Administrator",
              d: "Publish tournaments, admit or remove subscribers, verify cards, and release money.",
            },
          ].map((item) => (
            <div key={item.n} className="bg-ink px-8 py-10">
              <p className="font-mono text-xs text-copper">{item.n}</p>
              <h2 className="display mt-3 text-3xl">{item.t}</h2>
              <p className="mt-3 text-sm leading-7 text-cream-dim">{item.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="display text-3xl">Charities on the rotation</h2>
          <Link href="/charities" className="text-sm text-copper">
            All houses
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {charities.length === 0 ? (
            <p className="text-stone">Charities appear after the database is seeded.</p>
          ) : (
            charities.map((charity) => (
              <article
                key={charity.id}
                className="rounded-3xl border border-line p-6"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-stone">
                  {charity.city}
                </p>
                <h3 className="display mt-2 text-2xl">{charity.name}</h3>
                <p className="mt-2 text-cream-dim">{charity.tagline}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="display text-3xl">Upcoming numbers</h2>
        <div className="mt-8 space-y-3">
          {tournaments.length === 0 ? (
            <p className="text-stone">No live boards yet. Admins publish them from the desk.</p>
          ) : (
            tournaments.map((tournament) => (
              <article
                key={tournament.id}
                className="flex flex-col justify-between gap-4 rounded-3xl border border-line px-6 py-5 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-copper">
                    {matchLabel(tournament.match_type)}
                  </p>
                  <h3 className="mt-1 text-lg">{tournament.title}</h3>
                  <p className="text-sm text-stone">
                    {tournament.charities?.name} · {formatDate(tournament.starts_at)}
                  </p>
                </div>
                <p className="text-cream-dim">{formatMoney(tournament.reward_pool)}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
