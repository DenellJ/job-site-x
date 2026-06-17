import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { UploadedMedia } from "../lib/types";

/**
 * Upload a file to Convex storage (generate URL → POST → storageId) and return
 * an `UploadedMedia` with a local preview URL. Reused by every media gallery.
 */
export function useUpload() {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  return async function upload(file: File): Promise<UploadedMedia> {
    const postUrl = await generateUploadUrl();
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error("Upload failed.");
    const { storageId } = await res.json();
    return {
      storageId: storageId as string,
      kind: file.type.startsWith("video") ? "video" : "photo",
      caption: null,
      url: URL.createObjectURL(file),
    };
  };
}
