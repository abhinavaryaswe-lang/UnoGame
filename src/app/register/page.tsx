import Link from "next/link";
import { signUpAction } from "@/app/actions";
import { ErrorNote, Field, Button, inputClass, PageIntro, Panel } from "@/components/ui";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-16">
      <div className="grid w-full gap-12 lg:grid-cols-2">
        <PageIntro
          eyebrow="Subscribe"
          title="Register, then choose the house you play for."
          body="After you sign in you pick a charity. That charity’s 5, 4, and 3-number matches become your board."
        />
        <Panel>
          <form action={signUpAction} className="space-y-5">
            <ErrorNote message={params.error} />
            <Field label="Full name">
              <input className={inputClass()} name="full_name" required />
            </Field>
            <Field label="Email">
              <input className={inputClass()} type="email" name="email" required />
            </Field>
            <Field label="Password">
              <input
                className={inputClass()}
                type="password"
                name="password"
                minLength={6}
                required
              />
            </Field>
            <Button type="submit" className="w-full">
              Create subscriber
            </Button>
            <p className="text-sm text-stone">
              Already inside?{" "}
              <Link href="/login" className="text-cream underline">
                Sign in
              </Link>
            </p>
          </form>
        </Panel>
      </div>
    </main>
  );
}
