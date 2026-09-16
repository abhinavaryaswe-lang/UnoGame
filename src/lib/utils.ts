import type { MatchType } from "@/lib/types";

export const MATCH_TYPES: MatchType[] = [5, 4, 3];

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function matchLabel(type: number) {
  return `${type}-number match`;
}

export function matchCopy(type: number) {
  if (type === 5) return "Full-field format. Five counting numbers, widest board.";
  if (type === 4) return "Standard field. Four counting numbers, tighter board.";
  return "Compact field. Three counting numbers, sharpest board.";
}

export function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function monthLabel(period: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(period));
}

export function tournamentPhase(startsAt: string, endsAt: string) {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (now < start) return "upcoming" as const;
  if (now > end) return "completed" as const;
  return "live" as const;
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
