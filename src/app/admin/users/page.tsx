import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setUserSubscriptionAction } from "@/app/actions";
import { Badge, Button, PageIntro, Panel } from "@/components/ui";
import type { Profile } from "@/lib/types";

export default async function AdminUsersPage() {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*, charities(*)")
    .order("created_at", { ascending: false });
  const profiles = (data as Profile[]) ?? [];

  return (
    <div className="space-y-10">
      <PageIntro
        eyebrow="People"
        title="Add and remove subscribed users."
        body="Registration creates a subscriber. Toggle access to admit someone onto the boards or pull them off. Promote yourself in SQL if you need a first administrator."
      />
      <div className="grid gap-3">
        {profiles.map((profile) => (
          <Panel
            key={profile.id}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-cream">{profile.full_name}</p>
              <p className="text-sm text-stone">{profile.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>{profile.role}</Badge>
                <Badge>{profile.is_subscribed ? "subscribed" : "removed"}</Badge>
                {profile.charities ? <Badge>{profile.charities.name}</Badge> : null}
              </div>
            </div>
            {profile.id === user.id || profile.role === "admin" ? (
              <p className="text-sm text-stone">Admin seat</p>
            ) : (
              <form action={setUserSubscriptionAction}>
                <input type="hidden" name="id" value={profile.id} />
                <input
                  type="hidden"
                  name="is_subscribed"
                  value={profile.is_subscribed ? "false" : "true"}
                />
                <Button
                  type="submit"
                  variant={profile.is_subscribed ? "danger" : "cream"}
                >
                  {profile.is_subscribed ? "Remove subscriber" : "Add subscriber"}
                </Button>
              </form>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
