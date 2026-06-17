import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireManager } from "./helpers";
import { decisionValidator } from "./validators";
import { FORM_LABELS } from "./formDefs";

/**
 * Approve or reject a submitted form. In one mutation: write the approval record
 * (with the manager's signature + optional comment), set the submission status,
 * and notify the submitter.
 */
export const decide = mutation({
  args: {
    submissionId: v.id("formSubmissions"),
    decision: decisionValidator,
    comment: v.union(v.string(), v.null()),
    signatureId: v.union(v.id("_storage"), v.null()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireManager(ctx);
    const sub = await ctx.db.get(args.submissionId);
    if (sub === null) throw new Error("Submission not found.");
    if (sub.status !== "submitted") throw new Error("This submission is not awaiting a decision.");

    await ctx.db.insert("approvals", {
      submissionId: args.submissionId,
      decidedBy: userId,
      decision: args.decision,
      comment: args.comment,
      signatureId: args.signatureId,
    });

    await ctx.db.patch(args.submissionId, { status: args.decision });

    await ctx.db.insert("notifications", {
      userId: sub.submittedBy,
      message:
        args.decision === "approved"
          ? `${FORM_LABELS[sub.formType]} "${sub.label}" was approved.`
          : `${FORM_LABELS[sub.formType]} "${sub.label}" was rejected: ${args.comment ?? ""}`,
      href: "/mine",
      read: false,
    });
  },
});
