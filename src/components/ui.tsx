import { cn } from "@/lib/utils";

export function PageIntro({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display mt-3 text-4xl leading-tight text-cream sm:text-5xl">
        {title}
      </h1>
      {body ? <p className="mt-4 max-w-2xl text-cream-dim">{body}</p> : null}
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-line bg-ink-soft/80 p-6 shadow-[0_0_0_1px_rgba(243,234,216,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="text-cream-dim">{label}</span>
      {children}
    </label>
  );
}

export function inputClass() {
  return "w-full rounded-2xl border border-line bg-ink px-4 py-3 text-cream outline-none ring-copper/40 placeholder:text-stone focus:ring-2";
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "cream";
}) {
  const styles = {
    primary: "bg-coral text-white hover:bg-[#ff6a51]",
    cream: "bg-cream text-ink hover:bg-white",
    ghost: "border border-line text-cream hover:border-cream/40",
    danger: "border border-coral/40 text-coral hover:bg-coral/10",
  }[variant];

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ErrorNote({ message }: { message?: string | string[] }) {
  const text = Array.isArray(message) ? message[0] : message;
  if (!text) return null;
  return (
    <p className="rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
      {text}
    </p>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line px-3 py-1 text-xs uppercase tracking-[0.18em] text-cream-dim">
      {children}
    </span>
  );
}
