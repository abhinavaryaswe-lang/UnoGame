import Link from "next/link";
import { signInAction } from "@/app/actions";
import { ErrorNote, Field, Button, inputClass, PageIntro, Panel } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-16">
      <div className="grid w-full gap-12 lg:grid-cols-2">
        <PageIntro
          eyebrow="Member door"
          title="Sign in to your locker."
          body="Subscribers pick a charity, lock a target, and post a card. Administrators verify and pay."
        />
        <Panel>
          <form action={signInAction} className="space-y-5">
            <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
            <ErrorNote message={params.error} />
            <Field label="Email">
              <input className={inputClass()} type="email" name="email" required />
            </Field>
            <Field label="Password">
              <input
                className={inputClass()}
                type="password"
                name="password"
                required
              />
            </Field>
            <Button type="submit" className="w-full">
              Enter
            </Button>
            <p className="text-sm text-stone">
              No locker yet?{" "}
              <Link href="/register" className="text-cream underline">
                Subscribe
              </Link>
            </p>
          </form>
        </Panel>
      </div>
    </main>
  );
}
