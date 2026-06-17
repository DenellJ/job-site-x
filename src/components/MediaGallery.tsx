import { useRef, useState } from "react";
import { useUpload } from "../hooks/useUpload";
import type { UploadedMedia } from "../lib/types";

/**
 * Capture/select one or more photos or videos, upload them to Convex storage,
 * and show previews. Used for Section 1 start evidence, in-form attachments and
 * final completion evidence.
 */
export function MediaGallery({
  value,
  onChange,
  label = "Add photo / video",
  accent = false,
}: {
  value: UploadedMedia[];
  onChange: (next: UploadedMedia[]) => void;
  label?: string;
  accent?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const upload = useUpload();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const uploaded: UploadedMedia[] = [];
      for (const f of files) uploaded.push(await upload(f));
      onChange([...value, ...uploaded]);
    } catch (e: any) {
      setErr(e.message ?? "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function remove(index: number) {
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={onPick}
      />
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {value.map((m, i) => (
            <div
              key={i}
              className="relative border-2 border-stone-300 rounded-md overflow-hidden bg-stone-50"
            >
              {m.kind === "video" ? (
                m.url ? (
                  <video src={m.url} className="w-full h-28 object-cover" controls />
                ) : (
                  <div className="w-full h-28 flex items-center justify-center text-xs text-rebar">
                    🎬 Video
                  </div>
                )
              ) : m.url ? (
                <img src={m.url} alt="evidence" className="w-full h-28 object-cover" />
              ) : (
                <div className="w-full h-28 flex items-center justify-center text-xs text-rebar">
                  📷 Photo
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 bg-ink text-concrete w-6 h-6 rounded-sm text-sm leading-none"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        className={`${accent ? "btn-accent" : "btn-ghost"} w-full`}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Uploading…" : `📷 ${label}`}
      </button>
      {err && <p className="text-err text-sm font-bold">{err}</p>}
    </div>
  );
}
