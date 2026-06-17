import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import {
  getManagerIds,
  getPrimaryManagerId,
  requireApproved,
  requireManager,
  requireProfile,
} from "./helpers";
import { formTypeValidator, formValueValidator, mediaValidator } from "./validators";
import { deriveLabel, flatFields, FORM_LABELS } from "./formDefs";
import type { Doc } from "./_generated/dataModel";

/** Resolve storage URLs for a media array (for display). */
async function resolveMedia(ctx: QueryCtx, media: Doc<"formSubmissions">["startMedia"]) {
  return Promise.all(
    media.map(async (m) => ({
      storageId: m.storageId,
      kind: m.kind,
      caption: m.caption,
      url: await ctx.storage.getUrl(m.storageId),
    })),
  );
}

/**
 * Create or update a draft submission (Section 1 evidence + chosen form + any
 * Section 2 values/media captured so far). Status stays "draft".
 */
export const saveDraft = mutation({
  args: {
    submissionId: v.optional(v.id("formSubmissions")),
    formType: formTypeValidator,
    startMedia: v.array(mediaValidator),
    startNotes: v.string(),
    formValues: v.record(v.string(), formValueValidator),
    attachments: v.array(mediaValidator),
    finalMedia: v.array(mediaValidator),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireApproved(ctx);
    if (!profile.allowedForms.includes(args.formType)) {
      throw new Error("You do not have access to this form.");
    }
    const label = deriveLabel(args.formType, args.formValues);

    if (args.submissionId) {
      const existing = await ctx.db.get(args.submissionId);
      if (existing === null) throw new Error("Draft not found.");
      if (existing.submittedBy !== userId) throw new Error("Not your draft.");
      if (existing.status !== "draft") throw new Error("This submission can no longer be edited.");
      await ctx.db.patch(args.submissionId, {
        startMedia: args.startMedia,
        startNotes: args.startNotes,
        formValues: args.formValues,
        attachments: args.attachments,
        finalMedia: args.finalMedia,
        label,
      });
      return args.submissionId;
    }

    const managerId = await getPrimaryManagerId(ctx);
    return await ctx.db.insert("formSubmissions", {
      formType: args.formType,
      submittedBy: userId,
      submitterUsername: profile.username,
      managerId,
      status: "draft",
      label,
      startMedia: args.startMedia,
      startNotes: args.startNotes,
      formFields: flatFields(args.formType),
      formValues: args.formValues,
      attachments: args.attachments,
      finalMedia: args.finalMedia,
      reportStorageId: null,
      reportGeneratedAt: null,
      reportVersion: 0,
    });
  },
});

/**
 * Submit a draft to the manager. Enforces the work-plan gates:
 *  - Section 1: start media AND notes present.
 *  - Section 2: all required fields filled.
 *  - Final completion media present.
 */
export const submit = mutation({
  args: { submissionId: v.id("formSubmissions") },
  handler: async (ctx, args) => {
    const { userId } = await requireApproved(ctx);
    const sub = await ctx.db.get(args.submissionId);
    if (sub === null) throw new Error("Submission not found.");
    if (sub.submittedBy !== userId) throw new Error("Not your submission.");
    if (sub.status !== "draft") throw new Error("Already submitted.");

    if (sub.startMedia.length === 0) {
      throw new Error("Section 1: upload a start photo or video before submitting.");
    }
    if (!sub.startNotes.trim()) {
      throw new Error("Section 1: start notes are required.");
    }
    for (const field of sub.formFields) {
      if (field.required) {
        const value = sub.formValues[field.id];
        const empty =
          value === undefined ||
          value === null ||
          (typeof value === "string" && value.trim().length === 0);
        if (empty) throw new Error(`"${field.label}" is required.`);
      }
    }
    if (sub.finalMedia.length === 0) {
      throw new Error("Upload a final completion photo or video before submitting.");
    }

    await ctx.db.patch(args.submissionId, { status: "submitted" });

    const managerIds = await getManagerIds(ctx);
    for (const managerId of managerIds) {
      await ctx.db.insert("notifications", {
        userId: managerId,
        message: `New ${FORM_LABELS[sub.formType]} submission — ${sub.label} (by ${sub.submitterUsername}).`,
        href: "/manager",
        read: false,
      });
    }
  },
});

/** The caller's own submissions (drafts + submitted/approved/rejected), newest first. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireProfile(ctx);
    const subs = await ctx.db
      .query("formSubmissions")
      .withIndex("by_submitter", (q) => q.eq("submittedBy", userId))
      .collect();
    return subs
      .map((s) => ({
        id: s._id,
        formType: s.formType,
        label: s.label,
        status: s.status,
        updatedAt: s._creationTime,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** All non-draft submissions for the manager dashboard/folders (reactive). */
export const listForManager = query({
  args: {},
  handler: async (ctx) => {
    await requireManager(ctx);
    const subs = await ctx.db.query("formSubmissions").collect();
    return subs
      .filter((s) => s.status !== "draft")
      .map((s) => ({
        id: s._id,
        formType: s.formType,
        label: s.label,
        submitterUsername: s.submitterUsername,
        status: s.status,
        submittedAt: s._creationTime,
        reportVersion: s.reportVersion,
        reportGeneratedAt: s.reportGeneratedAt,
      }))
      .sort((a, b) => b.submittedAt - a.submittedAt);
  },
});

/** Full detail for one submission — visible to its owner or any manager. */
export const getDetail = query({
  args: { submissionId: v.id("formSubmissions") },
  handler: async (ctx, { submissionId }) => {
    const { userId, profile } = await requireProfile(ctx);
    const sub = await ctx.db.get(submissionId);
    if (sub === null) return null;
    if (profile.role !== "manager" && sub.submittedBy !== userId) {
      throw new Error("Not your submission.");
    }

    const history = (
      await ctx.db
        .query("approvals")
        .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
        .collect()
    ).sort((a, b) => b._creationTime - a._creationTime);

    return {
      id: sub._id,
      formType: sub.formType,
      formLabel: FORM_LABELS[sub.formType],
      status: sub.status,
      label: sub.label,
      submitterUsername: sub.submitterUsername,
      submittedAt: sub._creationTime,
      startNotes: sub.startNotes,
      startMedia: await resolveMedia(ctx, sub.startMedia),
      attachments: await resolveMedia(ctx, sub.attachments),
      finalMedia: await resolveMedia(ctx, sub.finalMedia),
      formFields: sub.formFields,
      formValues: sub.formValues,
      reportVersion: sub.reportVersion,
      reportGeneratedAt: sub.reportGeneratedAt,
      reportUrl: sub.reportStorageId ? await ctx.storage.getUrl(sub.reportStorageId) : null,
      history: history.map((h) => ({
        id: h._id,
        decision: h.decision,
        decidedAt: h._creationTime,
        comment: h.comment,
      })),
    };
  },
});
