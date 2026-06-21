import { v } from "convex/values";

/** Account role. */
export const roleValidator = v.union(v.literal("admin"), v.literal("manager"), v.literal("personnel"));

/** Account approval status. Personnel self-register as "pending"; the manager
 *  approves (→ "approved", with form access) or declines (→ "declined").
 *  Managers are always created "approved". */
export const accountStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
);

/** The five Section-2 digital forms (Resscott). */
export const formTypeValidator = v.union(
  v.literal("site_visit_lighting"),
  v.literal("site_visit_solar"),
  v.literal("site_visit_water_heater"),
  v.literal("job_inspection"),
  v.literal("job_ticket"),
  v.literal("new_job_task"),
);

/** A single field in a form definition (snapshotted onto a submission). */
export const formFieldValidator = v.object({
  id: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("text"),
    v.literal("textarea"),
    v.literal("number"),
    v.literal("yesno"),
    v.literal("select"),
    v.literal("time"),
  ),
  required: v.boolean(),
  // Only present for "select" fields.
  options: v.optional(v.array(v.string())),
});

/** A single submitted field value (scalar). */
export const formValueValidator = v.union(v.string(), v.number(), v.boolean());

/** A photo/video stored in Convex storage, with an optional caption. */
export const mediaValidator = v.object({
  storageId: v.id("_storage"),
  kind: v.union(v.literal("photo"), v.literal("video")),
  caption: v.union(v.string(), v.null()),
});

/** Submission lifecycle: draft → submitted → approved | rejected. */
export const submissionStatusValidator = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("approved"),
  v.literal("rejected"),
);

/** A manager decision on a submission. */
export const decisionValidator = v.union(v.literal("approved"), v.literal("rejected"));
