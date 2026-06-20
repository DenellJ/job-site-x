import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { requireProfile } from "./helpers";
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
    const { userId, profile } = await requireProfile(ctx);
    const sub = await ctx.db.get(submissionId);
    if (sub === null) throw new Error("Submission not found.");
    if (profile.role !== "manager" && sub.submittedBy !== userId) {
      throw new Error("Not your submission.");
    }

    // Latest approval → the approving manager's name + drawn signature.
    const approvals = await ctx.db
      .query("approvals")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .collect();
    const decided = approvals
      .filter((a) => a.decision === "approved")
      .sort((a, b) => b._creationTime - a._creationTime)[0];
    const managerSignatureId = decided ? decided.signatureId : null;
    let managerName: string | null = null;
    if (decided) {
      const mgr = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", decided.decidedBy))
        .unique();
      managerName = mgr?.fullName ?? mgr?.username ?? null;
    }

    return {
      formType: sub.formType,
      label: sub.label,
      formLabel: FORM_LABELS[sub.formType],
      submitterUsername: sub.submitterUsername,
      submittedAt: sub._creationTime,
      status: sub.status,
      startNotes: sub.startNotes,
      formValues: sub.formValues,
      formFields: sub.formFields,
      fields: sub.formFields.map((f) => ({
        label: f.label,
        value: display(sub.formValues[f.id]),
      })),
      managerName,
      managerSignatureId,
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
