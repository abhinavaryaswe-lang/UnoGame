export type UserRole = "subscriber" | "admin";
export type TournamentStatus = "upcoming" | "live" | "completed";
export type EntryStatus =
  | "registered"
  | "submitted"
  | "verified"
  | "rejected"
  | "rewarded";
export type RewardKind = "tournament" | "monthly_draw";
export type RewardStatus = "pending" | "approved" | "paid";
export type DrawStatus = "open" | "drawn" | "paid";
export type MatchType = 3 | 4 | 5;

export type Charity = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  charity_id: string | null;
  is_subscribed: boolean;
  created_at: string;
  updated_at: string;
  charities?: Charity | null;
};

export type Tournament = {
  id: string;
  charity_id: string;
  title: string;
  match_type: MatchType;
  venue: string | null;
  starts_at: string;
  ends_at: string;
  reward_pool: number;
  notes: string | null;
  status: TournamentStatus;
  created_at: string;
  charities?: Charity | null;
};

export type Entry = {
  id: string;
  user_id: string;
  tournament_id: string;
  target_score: number;
  actual_score: number | null;
  score_image_path: string | null;
  status: EntryStatus;
  admin_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  tournaments?: Tournament | null;
  profiles?: Profile | null;
};

export type MonthlyDraw = {
  id: string;
  period: string;
  prize_amount: number;
  status: DrawStatus;
  winner_id: string | null;
  notes: string | null;
  drawn_at: string | null;
  created_at: string;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type Reward = {
  id: string;
  user_id: string;
  entry_id: string | null;
  draw_id: string | null;
  amount: number;
  kind: RewardKind;
  status: RewardStatus;
  created_at: string;
  profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
};
