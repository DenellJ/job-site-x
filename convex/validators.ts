import { v } from "convex/values";

/** Account role. */
export const roleValidator = v.union(v.literal("admin"), v.literal("manager"), v.literal("personnel"));

/** Account status. Pending/declined remain for historical compatibility;
 * newly provisioned accounts are created approved by authorized staff. */
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

export const formStatusValidator = v.union(v.literal("active"), v.literal("archived"));
export const formVersionStatusValidator = v.union(v.literal("draft"), v.literal("published"));

export const formFieldTypeValidator = v.union(
  v.literal("text"), v.literal("textarea"), v.literal("number"), v.literal("yesno"),
  v.literal("select"), v.literal("multi_select"), v.literal("time"), v.literal("date"),
  v.literal("heading"), v.literal("instructions"), v.literal("signature"), v.literal("media"),
  v.literal("file"), v.literal("sketch"), v.literal("table"), v.literal("load_table"),
);

/** A single field in a form definition (snapshotted onto a submission). */
export const formFieldValidator = v.object({
  id: v.string(),
  label: v.string(),
  type: formFieldTypeValidator,
  required: v.boolean(),
  // Only present for "select" fields.
  options: v.optional(v.array(v.string())),
  helpText: v.optional(v.string()),
  columns: v.optional(v.array(v.string())),
});

export const formSectionValidator = v.object({
  id: v.string(),
  title: v.string(),
  note: v.optional(v.string()),
  media: v.optional(v.boolean()),
  fields: v.array(formFieldValidator),
});

export const formDefinitionValidator = v.object({
  title: v.string(),
  sections: v.array(formSectionValidator),
});

export const loadScheduleRowValidator = v.object({
  equipment: v.string(),
  quantity: v.union(v.number(), v.null()),
  totalWatts: v.union(v.number(), v.null()),
  hoursPerDay: v.union(v.number(), v.null()),
  wattHoursPerDay: v.union(v.number(), v.null()),
});

/** A submitted field value. Scalars remain valid for historical snapshots. */
export const formValueValidator = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.array(v.string()),
  v.array(v.record(v.string(), v.string())),
  v.array(loadScheduleRowValidator),
);

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
