import { requireSubscriber } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chooseCharityAction } from "@/app/actions";
import { Button, ErrorNote, PageIntro, Panel } from "@/components/ui";
import type { Charity } from "@/lib/types";

export default async function ChooseCharityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const { profile } = await requireSubscriber();
  const supabase = await createClient();
  const { data } = await supabase.from("charities").select("*").order("name");
  const charities = (data as Charity[]) ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <PageIntro
        eyebrow="Affiliation"
        title="Choose the charity you want to play."
        body="Your locker only shows 5, 4, and 3-number matches hosted by this house. You can switch later; live entries stay on the original board."
      />
      <div className="mt-8">
        <ErrorNote message={params.error} />
      </div>
      <form action={chooseCharityAction} className="mt-8 grid gap-4">
        {charities.map((charity) => (
          <label key={charity.id} className="block">
            <Panel className="flex cursor-pointer items-start gap-4 hover:border-cream/30">
              <input
                type="radio"
                name="charity_id"
                value={charity.id}
                defaultChecked={profile.charity_id === charity.id}
                className="mt-2 accent-[#ff4d2e]"
                required
              />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-stone">
                  {charity.city}
                </p>
                <h2 className="display mt-1 text-2xl">{charity.name}</h2>
                <p className="mt-2 text-sm text-cream-dim">{charity.description}</p>
              </div>
            </Panel>
          </label>
        ))}
        <Button type="submit" className="mt-2 w-fit">
          Lock this house
        </Button>
      </form>
    </main>
  );
}
