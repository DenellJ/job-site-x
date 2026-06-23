import { useRef, useState } from "react";
import { useUpload } from "../hooks/useUpload";
import { saveMediaToDevice } from "../lib/saveMedia";
import type { UploadedMedia } from "../lib/types";

/**
 * Capture/select one or more photos or videos, upload them to Convex storage,
 * and show previews. Used for Section 1 start evidence, in-form site photos and
 * final completion evidence.
 *
 * Capture inputs are single-type with no `multiple` — browsers ignore the
 * `capture` hint when `multiple` is set or `accept` spans types, which is why a
 * combined input opened the gallery instead of the camera.
 */
export function MediaGallery({
  value,
  onChange,
  accent = false,
  onBeforeCapture,
}: {
  value: UploadedMedia[];
  onChange: (next: UploadedMedia[]) => void;
  label?: string; // accepted for call-site compatibility; not rendered
  accent?: boolean;
  /** Flush the surrounding form to its draft before the camera opens, so a
   *  memory-eviction reload on mobile restores everything. */
  onBeforeCapture?: () => void;
}) {
  const photoRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const upload = useUpload();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Fire the flush, then open the input. Deliberately NOT awaited: awaiting a
  // network round-trip would break the user-gesture chain and some mobile
  // browsers then refuse to open the camera/file picker.
  function open(ref: React.RefObject<HTMLInputElement | null>) {
    onBeforeCapture?.();
    ref.current?.click();
  }

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
      {/* Single-type, no `multiple` → mobile launches the camera directly. */}
      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={onPick} />
      {/* No `capture` → device file picker / gallery, multiple allowed. */}
      <input ref={uploadRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onPick} />

      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {value.map((m, i) => (
            <div
              key={i}
              className="relative border border-stone-200 rounded-lg overflow-hidden bg-stone-50"
            >
              {m.kind === "video" ? (
                m.url ? (
                  <video src={m.url} className="w-full h-28 object-cover" controls />
                ) : (
                  <div className="w-full h-28 flex items-center justify-center text-xs text-rebar">🎬 Video</div>
                )
              ) : m.url ? (
                <img src={m.url} alt="evidence" className="w-full h-28 object-cover" />
              ) : (
                <div className="w-full h-28 flex items-center justify-center text-xs text-rebar">📷 Photo</div>
              )}
              {m.url && (
                <button
                  type="button"
                  onClick={() => void saveMediaToDevice(m)}
                  className="absolute top-1 left-1 bg-ink/80 text-concrete w-6 h-6 rounded-full text-sm leading-none"
                  aria-label="Save to device"
                  title="Save to device"
                >
                  ⤓
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 bg-ink text-concrete w-6 h-6 rounded-full text-sm leading-none"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={`${accent ? "btn-accent" : "btn-ghost"} w-full`}
          disabled={busy}
          onClick={() => open(photoRef)}
        >
          📷 Take Photo
        </button>
        <button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => open(videoRef)}>
          🎥 Record Video
        </button>
      </div>
      <button
        type="button"
        className="w-full text-xs font-semibold uppercase tracking-wide text-rebar underline disabled:opacity-50"
        disabled={busy}
        onClick={() => open(uploadRef)}
      >
        {busy ? "Uploading…" : "🖼 Upload from device"}
      </button>

      {err && <p className="text-err text-sm font-bold">{err}</p>}
    </div>
  );
}
