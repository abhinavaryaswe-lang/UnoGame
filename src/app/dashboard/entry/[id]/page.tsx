import { notFound } from "next/navigation";
import { requireSubscriber } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { submitScoreAction } from "@/app/actions";
import { formatDateTime, matchLabel, tournamentPhase } from "@/lib/utils";
import {
  Badge,
  Button,
  ErrorNote,
  Field,
  inputClass,
  PageIntro,
  Panel,
} from "@/components/ui";
import { ScoreUpload } from "@/components/score-upload";
import type { Entry } from "@/lib/types";

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { user } = await requireSubscriber();
  const supabase = await createClient();
  const { data } = await supabase
    .from("entries")
    .select("*, tournaments(*, charities(*))")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const entry = data as Entry | null;
  if (!entry?.tournaments) notFound();

  const tournament = entry.tournaments;
  const phase = tournamentPhase(tournament.starts_at, tournament.ends_at);
  const canUpload =
    phase === "completed" &&
    ["registered", "submitted", "rejected"].includes(entry.status);

  if (phase !== "completed" && entry.status === "registered") {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <PageIntro
          eyebrow={matchLabel(tournament.match_type)}
          title="Target locked."
          body={`You are in for ${tournament.title}. Come back after ${formatDateTime(tournament.ends_at)} to upload the scorecard.`}
        />
        <Panel className="mt-10 space-y-3">
          <Badge>target {entry.target_score}</Badge>
          <p className="text-cream-dim">
            Admin review happens only after the image is in. Keep the original card.
          </p>
        </Panel>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <PageIntro
        eyebrow={matchLabel(tournament.match_type)}
        title={tournament.title}
        body="Upload a photo of the posted card. An administrator checks it before any reward is released."
      />
      <Panel className="mt-10 space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge>{entry.status}</Badge>
          <Badge>target {entry.target_score}</Badge>
          {entry.actual_score ? <Badge>posted {entry.actual_score}</Badge> : null}
        </div>
        {entry.admin_notes ? (
          <p className="text-sm text-copper">Desk note: {entry.admin_notes}</p>
        ) : null}
        <ErrorNote message={query.error} />
        {canUpload ? (
          <form action={submitScoreAction} className="space-y-5">
            <input type="hidden" name="entry_id" value={entry.id} />
            <Field label="Posted score">
              <input
                className={inputClass()}
                type="number"
                name="actual_score"
                min={1}
                required
                defaultValue={entry.actual_score ?? undefined}
              />
            </Field>
            <Field label="Scorecard image">
              <ScoreUpload
                userId={user.id}
                entryId={entry.id}
                currentPath={entry.score_image_path}
              />
            </Field>
            <Button type="submit">Send for review</Button>
          </form>
        ) : (
          <p className="text-cream-dim">
            This card is with the desk. If it is rejected you can upload again.
          </p>
        )}
      </Panel>
    </main>
  );
}
