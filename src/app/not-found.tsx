import { PageIntro } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-24">
      <PageIntro
        eyebrow="Missing"
        title="This page is off the card."
        body="Head back to the public board or sign in to your locker."
      />
    </main>
  );
}
