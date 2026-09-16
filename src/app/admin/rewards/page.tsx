import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  grantRewardAction,
  markRewardPaidAction,
  reviewEntryAction,
} from "@/app/actions";
import { formatMoney } from "@/lib/utils";
import {
  Badge,
  Button,
  ErrorNote,
  Field,
  inputClass,
  PageIntro,
  Panel,
} from "@/components/ui";
import { ScorecardPreview } from "@/components/scorecard-preview";
import type { Entry, Reward } from "@/lib/types";

export default async function AdminRewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: entries }, { data: rewards }] = await Promise.all([
    supabase
      .from("entries")
      .select("*, profiles(*), tournaments(*, charities(*))")
      .in("status", ["submitted", "verified", "rewarded", "rejected"])
      .order("submitted_at", { ascending: false }),
    supabase
      .from("rewards")
      .select("*, profiles(id, full_name, email)")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-10">
      <PageIntro
        eyebrow="Payouts"
        title="Check the card, then allow the reward."
        body="Verify or reject a submitted image. Verified scores can receive a tournament payout and remain eligible for the monthly draw."
      />
      <ErrorNote message={params.error} />

      <section className="space-y-4">
        <h2 className="display text-2xl">Scorecards</h2>
        {((entries as Entry[]) ?? []).map((entry) => (
          <Panel key={entry.id} className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-cream">{entry.profiles?.full_name}</p>
                <p className="text-sm text-stone">{entry.profiles?.email}</p>
                <p className="mt-2 text-sm text-cream-dim">
                  {entry.tournaments?.title} · target {entry.target_score} · posted{" "}
                  {entry.actual_score ?? "—"}
                </p>
              </div>
              <Badge>{entry.status}</Badge>
            </div>
            <ScorecardPreview path={entry.score_image_path} />
            {entry.status === "submitted" ? (
              <form action={reviewEntryAction} className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
                <input type="hidden" name="id" value={entry.id} />
                <Field label="Note">
                  <input className={inputClass()} name="admin_notes" />
                </Field>
                <Button name="decision" value="verify" type="submit" className="self-end">
                  Verify
                </Button>
                <Button
                  name="decision"
                  value="reject"
                  type="submit"
                  variant="danger"
                  className="self-end"
                >
                  Reject
                </Button>
              </form>
            ) : null}
            {entry.status === "verified" ? (
              <form action={grantRewardAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <input type="hidden" name="entry_id" value={entry.id} />
                <Field label="Allow reward (USD)">
                  <input
                    className={inputClass()}
                    type="number"
                    name="amount"
                    min={1}
                    required
                    defaultValue={Number(entry.tournaments?.reward_pool ?? 100)}
                  />
                </Field>
                <Button type="submit">Allow reward</Button>
              </form>
            ) : null}
          </Panel>
        ))}
        {((entries as Entry[]) ?? []).length === 0 ? (
          <p className="text-stone">No cards in the tray.</p>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="display text-2xl">Reward ledger</h2>
        {((rewards as Reward[]) ?? []).map((reward) => (
          <Panel key={reward.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p>{reward.profiles?.full_name}</p>
              <p className="text-sm capitalize text-stone">
                {reward.kind.replace("_", " ")} · {reward.status}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p>{formatMoney(reward.amount)}</p>
              {reward.status !== "paid" ? (
                <form action={markRewardPaidAction}>
                  <input type="hidden" name="id" value={reward.id} />
                  <Button type="submit" variant="ghost">
                    Mark paid
                  </Button>
                </form>
              ) : null}
            </div>
          </Panel>
        ))}
      </section>
    </div>
  );
}
