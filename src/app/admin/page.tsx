import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createCharityAction } from "@/app/actions";
import {
  Button,
  ErrorNote,
  Field,
  inputClass,
  PageIntro,
  Panel,
} from "@/components/ui";
import type { Charity } from "@/lib/types";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: charities }, { count: users }, { count: pending }, { count: boards }] =
    await Promise.all([
      supabase.from("charities").select("*").order("name"),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase
        .from("entries")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted"),
      supabase.from("tournaments").select("*", { count: "exact", head: true }),
    ]);

  return (
    <div className="space-y-10">
      <PageIntro
        eyebrow="Control"
        title="Publish boards, admit players, release money."
        body="Tournaments you add are listed on the public calendar. Subscribers only enter the charity they chose."
      />
      <ErrorNote message={params.error} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Houses" value={(charities as Charity[] | null)?.length ?? 0} />
        <Stat label="People" value={users ?? 0} />
        <Stat label="Cards waiting" value={pending ?? 0} />
      </div>
      <p className="text-sm text-stone">{boards ?? 0} tournaments on the book.</p>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="display text-2xl">Add a charity</h2>
          <form action={createCharityAction} className="mt-5 space-y-4">
            <Field label="Name">
              <input className={inputClass()} name="name" required />
            </Field>
            <Field label="City">
              <input className={inputClass()} name="city" />
            </Field>
            <Field label="Tagline">
              <input className={inputClass()} name="tagline" />
            </Field>
            <Field label="Description">
              <textarea className={inputClass()} name="description" rows={4} />
            </Field>
            <Button type="submit">Save house</Button>
          </form>
        </Panel>
        <Panel>
          <h2 className="display text-2xl">Current houses</h2>
          <ul className="mt-5 space-y-3 text-sm">
            {((charities as Charity[]) ?? []).map((charity) => (
              <li key={charity.id} className="border-b border-line pb-3">
                <p className="text-cream">{charity.name}</p>
                <p className="text-stone">{charity.city}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Panel>
      <p className="text-xs uppercase tracking-[0.2em] text-stone">{label}</p>
      <p className="display mt-2 text-4xl">{value}</p>
    </Panel>
  );
}
