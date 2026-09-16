import { PageIntro, Panel } from "@/components/ui";

export default function InactivePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <PageIntro
        eyebrow="Access"
        title="This locker is inactive."
        body="An administrator removed your subscriber access. You can still browse public boards. Ask the desk to be added again."
      />
      <Panel className="mt-10 max-w-xl">
        <p className="text-cream-dim">
          Public pages stay open. Tournament entry, score uploads, and the monthly
          draw ticket require an active subscription.
        </p>
      </Panel>
    </main>
  );
}
