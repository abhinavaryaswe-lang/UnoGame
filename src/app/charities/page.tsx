import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/utils";
import { PageIntro, Panel } from "@/components/ui";
import type { Charity } from "@/lib/types";

export default async function CharitiesPage() {
  let charities: Charity[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.from("charities").select("*").order("name");
    charities = (data as Charity[]) ?? [];
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <PageIntro
        eyebrow="Houses"
        title="Tournament organising companies — the charities."
        body="Each charity hosts boards. Public visitors can read the mission. Subscribers choose one house and play its matches."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {charities.map((charity) => (
          <Panel key={charity.id}>
            <p className="text-xs uppercase tracking-[0.2em] text-stone">
              {charity.city}
            </p>
            <h2 className="display mt-3 text-3xl">{charity.name}</h2>
            <p className="mt-2 text-copper">{charity.tagline}</p>
            <p className="mt-4 text-sm leading-7 text-cream-dim">
              {charity.description}
            </p>
          </Panel>
        ))}
        {charities.length === 0 ? (
          <p className="text-stone">No charities seeded yet.</p>
        ) : null}
      </div>
    </main>
  );
}
