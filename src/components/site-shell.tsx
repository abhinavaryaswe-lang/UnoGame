import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { signOutAction } from "@/app/actions";
import { isSupabaseConfigured } from "@/lib/utils";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const { profile } = configured ? await getProfile() : { profile: null };

  return (
    <>
      {!configured ? (
        <div className="relative z-20 border-b border-coral/40 bg-coral px-4 py-2 text-center text-sm text-white">
          Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
          <code className="font-mono">.env.local</code>, then run{" "}
          <code className="font-mono">supabase/schema.sql</code>.
        </div>
      ) : null}
      <header className="relative z-20 border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="display text-2xl tracking-tight">GolfClub</span>
            <span className="hidden text-xs text-stone sm:inline">the draw</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-cream-dim">
            <Link href="/tournaments" className="hover:text-cream">
              Boards
            </Link>
            <Link href="/charities" className="hover:text-cream">
              Charities
            </Link>
            <Link href="/draw" className="hover:text-cream">
              Monthly draw
            </Link>
            {profile?.role === "admin" ? (
              <Link href="/admin" className="hover:text-cream">
                Admin
              </Link>
            ) : null}
            {profile ? (
              <>
                <Link href="/dashboard" className="hover:text-cream">
                  Locker
                </Link>
                <form action={signOutAction}>
                  <button className="text-stone hover:text-cream">Sign out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-cream">
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="rounded-full bg-cream px-4 py-2 text-ink hover:bg-white"
                >
                  Subscribe
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 text-sm text-stone sm:flex-row sm:items-center sm:justify-between">
          <p>GolfClub is not a country club. It is a score, a cause, and a ticket.</p>
          <p>Public view · Subscriber boards · Admin payouts</p>
        </div>
      </footer>
    </>
  );
}
