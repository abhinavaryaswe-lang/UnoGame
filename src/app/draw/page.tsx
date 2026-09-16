import { createClient } from "@/lib/supabase/server";
import { formatMoney, isSupabaseConfigured, monthLabel } from "@/lib/utils";
import { Badge, PageIntro, Panel } from "@/components/ui";
import type { MonthlyDraw } from "@/lib/types";

export default async function DrawPage() {
  let draws: MonthlyDraw[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("monthly_draws")
      .select("*, profiles(id, full_name, email)")
      .order("period", { ascending: false });
    draws = (data as MonthlyDraw[]) ?? [];
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <PageIntro
        eyebrow="The pot"
        title="A monthly draw for every verified card."
        body="Play a charity board, post your score image, wait for admin review. A verified card is a ticket. The draw is public; the payout is not automatic until an administrator allows it."
      />
      <div className="mt-12 grid gap-4">
        {draws.length === 0 ? (
          <p className="text-stone">No draw periods yet.</p>
        ) : (
          draws.map((draw) => (
            <Panel key={draw.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex gap-2">
                  <Badge>{draw.status}</Badge>
                  <Badge>{monthLabel(draw.period)}</Badge>
                </div>
                <p className="mt-3 text-cream-dim">{draw.notes}</p>
                {draw.profiles ? (
                  <p className="mt-2 text-sm text-copper">
                    Drawn: {draw.profiles.full_name}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-stone">Winner not drawn yet.</p>
                )}
              </div>
              <p className="display text-4xl">{formatMoney(draw.prize_amount)}</p>
            </Panel>
          ))
        )}
      </div>
    </main>
  );
}
