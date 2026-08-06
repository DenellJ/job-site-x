import { saveMediaToDevice } from "../lib/saveMedia";

export interface ResolvedMedia {
  kind: "photo" | "video";
  caption: string | null;
  url: string | null;
}

/** Read-only grid of photo/video evidence with resolved URLs. */
export function MediaThumbs({ media }: { media: ResolvedMedia[] }) {
  if (media.length === 0) return <p className="text-sm text-rebar">None.</p>;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {media.map((m, i) => (
        <div key={i} className="relative border-2 border-stone-300 rounded-md overflow-hidden bg-stone-50">
          {m.kind === "video" ? (
            m.url ? (
              <video src={m.url} controls className="h-40 w-full object-cover sm:h-28" />
            ) : (
              <div className="flex h-40 w-full items-center justify-center text-xs text-rebar sm:h-28">🎬 Video</div>
            )
          ) : m.url ? (
            <img src={m.url} alt={m.caption ?? "evidence"} className="h-40 w-full object-cover sm:h-28" />
          ) : (
            <div className="flex h-40 w-full items-center justify-center text-xs text-rebar sm:h-28">📷 Photo</div>
          )}
          {m.url && (
            <button
              type="button"
              onClick={() => void saveMediaToDevice(m)}
              className="absolute top-1 right-1 bg-ink/80 text-concrete w-6 h-6 rounded-full text-sm leading-none"
              aria-label="Save to device"
              title="Save to device"
            >
              ⤓
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
