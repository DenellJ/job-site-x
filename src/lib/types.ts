import type { FormType } from "../forms";

export type { FormType } from "../forms";

export type UserRole = "manager" | "personnel";
export type AccountStatus = "pending" | "approved" | "declined";
export type SubmissionStatus = "draft" | "submitted" | "approved" | "rejected";

/** A photo/video reference passed to mutations. */
export interface MediaRef {
  storageId: string;
  kind: "photo" | "video";
  caption: string | null;
}

/** A media item held in the client: a `MediaRef` plus a preview URL. */
export interface UploadedMedia extends MediaRef {
  url: string | null;
}

/** The signed-in user's profile, as returned by `api.users.me`. */
export interface Profile {
  id: string; // Convex Id<"users"> (a branded string)
  username: string;
  fullName: string | null;
  role: UserRole;
  status: AccountStatus;
  allowedForms: FormType[];
}

/** Strip a client `UploadedMedia` down to the `MediaRef` shape for a mutation. */
export function toMediaRefs(items: UploadedMedia[]): MediaRef[] {
  return items.map(({ storageId, kind, caption }) => ({ storageId, kind, caption }));
}
