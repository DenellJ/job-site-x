import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { requireManager } from "./helpers";
import { FORM_LABELS } from "./formDefs";

/** Stringify a submitted field value for display in the report. */
function display(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const s = String(value);
  return s.trim() === "" ? "—" : s;
}

/** Manager-only: gather everything the PDF action needs for one submission. */
export const getForReport = internalQuery({
  args: { submissionId: v.id("formSubmissions") },
  handler: async (ctx, { submissionId }) => {
    await requireManager(ctx);
    const sub = await ctx.db.get(submissionId);
    if (sub === null) throw new Error("Submission not found.");
    return {
      label: sub.label,
      formLabel: FORM_LABELS[sub.formType],
      submitterUsername: sub.submitterUsername,
      submittedAt: sub._creationTime,
      status: sub.status,
      startNotes: sub.startNotes,
      fields: sub.formFields.map((f) => ({
        label: f.label,
        value: display(sub.formValues[f.id]),
      })),
      startMedia: sub.startMedia.map((m) => ({ storageId: m.storageId, kind: m.kind, caption: m.caption })),
      attachments: sub.attachments.map((m) => ({ storageId: m.storageId, kind: m.kind, caption: m.caption })),
      finalMedia: sub.finalMedia.map((m) => ({ storageId: m.storageId, kind: m.kind, caption: m.caption })),
    };
  },
});

/** Store a freshly generated report PDF against the submission and bump its version. */
export const saveReport = internalMutation({
  args: {
    submissionId: v.id("formSubmissions"),
    reportStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.submissionId);
    if (sub === null) throw new Error("Submission not found.");
    await ctx.db.patch(args.submissionId, {
      reportStorageId: args.reportStorageId,
      reportGeneratedAt: Date.now(),
      reportVersion: sub.reportVersion + 1,
    });
    return sub.reportVersion + 1;
  },
});
