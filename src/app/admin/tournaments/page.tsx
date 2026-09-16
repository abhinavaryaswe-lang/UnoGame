import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createTournamentAction, deleteTournamentAction } from "@/app/actions";
import {
  formatDateTime,
  formatMoney,
  matchLabel,
  MATCH_TYPES,
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
import type { Charity, Tournament } from "@/lib/types";

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: charities }, { data: tournaments }] = await Promise.all([
    supabase.from("charities").select("*").order("name"),
    supabase
      .from("tournaments")
      .select("*, charities(*)")
      .order("starts_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-10">
      <PageIntro
        eyebrow="Calendar"
        title="Add upcoming tournaments by charity."
        body="Every subscriber can see the public list. Only members who chose that charity can lock a target."
      />
      <ErrorNote message={params.error} />
      <Panel>
        <h2 className="display text-2xl">New board</h2>
        <form action={createTournamentAction} className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Charity">
            <select className={inputClass()} name="charity_id" required>
              <option value="">Select house</option>
              {((charities as Charity[]) ?? []).map((charity) => (
                <option key={charity.id} value={charity.id}>
                  {charity.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Format">
            <select className={inputClass()} name="match_type" required>
              {MATCH_TYPES.map((type) => (
                <option key={type} value={type}>
                  {matchLabel(type)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input className={inputClass()} name="title" required />
          </Field>
          <Field label="Venue">
            <input className={inputClass()} name="venue" />
          </Field>
          <Field label="Starts">
            <input className={inputClass()} type="datetime-local" name="starts_at" required />
          </Field>
          <Field label="Ends">
            <input className={inputClass()} type="datetime-local" name="ends_at" required />
          </Field>
          <Field label="Reward pool (USD)">
            <input className={inputClass()} type="number" name="reward_pool" min={0} defaultValue={500} />
          </Field>
          <Field label="Notes">
            <input className={inputClass()} name="notes" />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">Publish tournament</Button>
          </div>
        </form>
      </Panel>

      <div className="grid gap-3">
        {((tournaments as Tournament[]) ?? []).map((tournament) => (
          <Panel key={tournament.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge>{matchLabel(tournament.match_type)}</Badge>
                <Badge>{tournament.charities?.name}</Badge>
              </div>
              <h3 className="mt-2 text-lg">{tournament.title}</h3>
              <p className="text-sm text-stone">
                {formatDateTime(tournament.starts_at)} → {formatDateTime(tournament.ends_at)} ·{" "}
                {formatMoney(tournament.reward_pool)}
              </p>
            </div>
            <form action={deleteTournamentAction}>
              <input type="hidden" name="id" value={tournament.id} />
              <Button variant="danger" type="submit">
                Remove
              </Button>
            </form>
          </Panel>
        ))}
      </div>
    </div>
  );
}
