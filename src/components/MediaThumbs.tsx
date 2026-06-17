export interface ResolvedMedia {
  kind: "photo" | "video";
  caption: string | null;
  url: string | null;
}

/** Read-only grid of photo/video evidence with resolved URLs. */
export function MediaThumbs({ media }: { media: ResolvedMedia[] }) {
  if (media.length === 0) return <p className="text-sm text-rebar">None.</p>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {media.map((m, i) => (
        <div key={i} className="border-2 border-stone-300 rounded-md overflow-hidden bg-stone-50">
          {m.kind === "video" ? (
            m.url ? (
              <video src={m.url} controls className="w-full h-28 object-cover" />
            ) : (
              <div className="w-full h-28 flex items-center justify-center text-xs text-rebar">🎬 Video</div>
            )
          ) : m.url ? (
            <img src={m.url} alt={m.caption ?? "evidence"} className="w-full h-28 object-cover" />
          ) : (
            <div className="w-full h-28 flex items-center justify-center text-xs text-rebar">📷 Photo</div>
          )}
        </div>
      ))}
    </div>
  );
}
