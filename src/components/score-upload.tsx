"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, inputClass } from "@/components/ui";

export function ScoreUpload({
  userId,
  entryId,
  currentPath,
}: {
  userId: string;
  entryId: string;
  currentPath: string | null;
}) {
  const [path, setPath] = useState(currentPath ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const objectPath = `${userId}/${entryId}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("scorecards")
      .upload(objectPath, file, { upsert: true, contentType: file.type });
    setBusy(false);
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    setPath(objectPath);
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="score_image_path" value={path} />
      <input
        type="file"
        accept="image/*"
        className={inputClass()}
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {busy ? <p className="text-sm text-stone">Uploading scorecard…</p> : null}
      {path ? (
        <p className="text-sm text-copper">Scorecard attached. Submit for review.</p>
      ) : null}
      {error ? <p className="text-sm text-coral">{error}</p> : null}
      {!path ? (
        <Button type="button" variant="ghost" disabled>
          Waiting for image
        </Button>
      ) : null}
    </div>
  );
}
