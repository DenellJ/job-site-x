/**
 * Save a captured/stored photo or video to the user's device. Prefers the
 * native share sheet (so mobile users get "Save to Photos / Files"); falls back
 * to a direct download, and finally to opening the file in a new tab for a
 * long-press save. `url` may be a local object URL (just captured) or a Convex
 * storage URL (loaded from a draft).
 */
export async function saveMediaToDevice(media: { url: string | null; kind: "photo" | "video" }): Promise<void> {
  const { url, kind } = media;
  if (!url) return;

  const nav = navigator as Navigator & {
    canShare?: (data?: { files?: File[] }) => boolean;
    share?: (data?: { files?: File[]; title?: string }) => Promise<void>;
  };

  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || (kind === "video" ? "mp4" : "jpg")).replace("jpeg", "jpg");
    const filename = `resscott-${kind}-${Date.now()}.${ext}`;
    const file = new File([blob], filename, { type: blob.type });

    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: filename });
      return;
    }

    const dlUrl = URL.createObjectURL(blob);
    triggerDownload(dlUrl, filename);
    setTimeout(() => URL.revokeObjectURL(dlUrl), 10_000);
  } catch {
    // Share cancelled, or fetch/download blocked — let the user save manually.
    window.open(url, "_blank");
  }
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
