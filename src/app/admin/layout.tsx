import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Desk" },
  { href: "/admin/tournaments", label: "Tournaments" },
  { href: "/admin/users", label: "Subscribers" },
  { href: "/admin/rewards", label: "Cards & payouts" },
  { href: "/admin/draws", label: "Monthly draw" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-52">
        <p className="eyebrow">Administrator</p>
        <nav className="mt-4 grid gap-2 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn("rounded-full border border-transparent px-4 py-2 text-cream-dim hover:border-line hover:text-cream")}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
