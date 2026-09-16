import { createClient } from "@/lib/supabase/server";

export async function ScorecardPreview({ path }: { path: string | null }) {
  if (!path) return <p className="text-sm text-stone">No image uploaded.</p>;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("scorecards")
    .createSignedUrl(path, 60 * 30);
  if (!data?.signedUrl) {
    return <p className="text-sm text-stone">Could not open scorecard.</p>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={data.signedUrl}
      alt="Submitted scorecard"
      className="max-h-96 w-full rounded-2xl object-contain bg-black"
    />
  );
}
