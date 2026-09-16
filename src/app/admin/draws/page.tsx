import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createDrawAction, runDrawAction } from "@/app/actions";
import { formatMoney, monthLabel } from "@/lib/utils";
import {
  Badge,
  Button,
  ErrorNote,
  Field,
  inputClass,
  PageIntro,
  Panel,
} from "@/components/ui";
import type { MonthlyDraw } from "@/lib/types";

export default async function AdminDrawsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_draws")
    .select("*, profiles(id, full_name, email)")
    .order("period", { ascending: false });
  const draws = (data as MonthlyDraw[]) ?? [];

  return (
    <div className="space-y-10">
      <PageIntro
        eyebrow="Lottery"
        title="Open a month, then draw a winner."
        body="Eligible tickets are subscribers with a verified or rewarded card submitted in that month. Running the draw also creates an approved reward."
      />
      <ErrorNote message={params.error} />
      <Panel>
        <h2 className="display text-2xl">Open a period</h2>
        <form action={createDrawAction} className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Month">
            <input className={inputClass()} type="month" name="period" required />
          </Field>
          <Field label="Prize (USD)">
            <input
              className={inputClass()}
              type="number"
              name="prize_amount"
              min={0}
              defaultValue={2500}
              required
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note">
              <input className={inputClass()} name="notes" />
            </Field>
          </div>
          <Button type="submit">Create draw</Button>
        </form>
      </Panel>

      <div className="grid gap-3">
        {draws.map((draw) => (
          <Panel key={draw.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex gap-2">
                <Badge>{draw.status}</Badge>
                <Badge>{monthLabel(draw.period)}</Badge>
              </div>
              <p className="mt-3 display text-3xl">{formatMoney(draw.prize_amount)}</p>
              {draw.profiles ? (
                <p className="mt-2 text-sm text-copper">
                  Winner: {draw.profiles.full_name} · {draw.profiles.email}
                </p>
              ) : (
                <p className="mt-2 text-sm text-stone">No winner yet.</p>
              )}
            </div>
            {draw.status === "open" ? (
              <form action={runDrawAction}>
                <input type="hidden" name="id" value={draw.id} />
                <Button type="submit">Run monthly draw</Button>
              </form>
            ) : null}
          </Panel>
        ))}
      </div>
    </div>
  );
}
