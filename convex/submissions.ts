import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import {
  getManagerIds,
  getPrimaryManagerId,
  requireAdmin,
  requireApproved,
  requireManager,
  requireProfile,
} from "./helpers";
import { formTypeValidator, formValueValidator, mediaValidator } from "./validators";
import { deriveLabel, flatFields, FORM_LABELS } from "./formDefs";
import type { FormValue } from "./formDefs";
import { isEmptyFormValue, MAX_LOAD_ROWS } from "./formValues";
import type { Doc, Id } from "./_generated/dataModel";

function isValidIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Validate values against the definition snapshotted on the submission. */
function validateFormValues(formFields: Doc<"formSubmissions">["formFields"], formValues: Record<string, FormValue>) {
  const fieldsById = new Map(formFields.map((field) => [field.id, field]));

  for (const [fieldId, value] of Object.entries(formValues)) {
    const field = fieldsById.get(fieldId);
    if (!field) throw new Error(`"${fieldId}" is not a field on this form.`);

    if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`"${field.label}" must be a number.`);
    }
    if (field.type === "yesno" && typeof value !== "boolean") {
      throw new Error(`"${field.label}" must be Yes or No.`);
    }
    if (field.type === "multi_select" && (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !field.options?.includes(item)))) {
      throw new Error(`"${field.label}" has an invalid selection.`);
    }
    if (field.type === "table" && (!Array.isArray(value) || value.some((row) => typeof row !== "object" || row === null))) {
      throw new Error(`"${field.label}" has an invalid table value.`);
    }
    if (
      (field.type === "text" || field.type === "textarea" || field.type === "time" || field.type === "date" || field.type === "select") &&
      typeof value !== "string"
    ) {
      throw new Error(`"${field.label}" has an invalid value.`);
    }
    if (field.type === "select" && value !== "" && !field.options?.includes(value as string)) {
      throw new Error(`"${field.label}" has an invalid selection.`);
    }
    if (field.type === "date" && typeof value === "string" && value !== "" && !isValidIsoDate(value)) {
      throw new Error(`"${field.label}" must be a valid date.`);
    }
    if (field.type === "sketch" && (typeof value !== "string" || !value.startsWith("data:image"))) {
      throw new Error(`"${field.label}" must be a sketch image.`);
    }
    if (field.type === "load_table") {
      if (!Array.isArray(value) || value.length > MAX_LOAD_ROWS) {
        throw new Error(`"${field.label}" must contain no more than ${MAX_LOAD_ROWS} rows.`);
      }
      for (const row of value) {
        if (!row || typeof row !== "object" || typeof row.equipment !== "string") {
          throw new Error(`"${field.label}" contains an invalid row.`);
        }
        for (const numberValue of [row.quantity, row.totalWatts, row.hoursPerDay, row.wattHoursPerDay]) {
          if (numberValue !== null && (typeof numberValue !== "number" || !Number.isFinite(numberValue) || numberValue < 0)) {
            throw new Error(`"${field.label}" contains an invalid number.`);
          }
        }
      }
    }
  }

  for (const field of formFields) {
    if (field.required && isEmptyFormValue(formValues[field.id])) {
      throw new Error(`"${field.label}" is required.`);
    }
  }
}

function attachmentsChanged(
  previous: Doc<"formSubmissions">["attachments"],
  next: Doc<"formSubmissions">["attachments"],
) {
  return (
    previous.length !== next.length ||
    previous.some(
      (media, index) =>
        media.storageId !== next[index].storageId ||
        media.kind !== next[index].kind ||
        media.caption !== next[index].caption,
    )
  );
}

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
    formId: v.optional(v.id("forms")),
    startMedia: v.array(mediaValidator),
    startNotes: v.string(),
    formValues: v.record(v.string(), formValueValidator),
    attachments: v.array(mediaValidator),
    finalMedia: v.array(mediaValidator),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireApproved(ctx);
    if (args.submissionId) {
      const existing = await ctx.db.get(args.submissionId);
      if (existing === null) throw new Error("Draft not found.");
      if (existing.submittedBy !== userId) throw new Error("Not your draft.");
      if (existing.status === "approved") throw new Error("Approved forms can no longer be edited.");
      await ctx.db.patch(args.submissionId, {
        startMedia: args.startMedia, startNotes: args.startNotes, formValues: args.formValues,
        attachments: args.attachments, finalMedia: args.finalMedia,
        label: deriveLabel(existing.formType, args.formValues),
      });
      return args.submissionId;
    }
    let dynamicForm = args.formId ? await ctx.db.get(args.formId) : null;
    let dynamicVersion = dynamicForm?.publishedVersionId ? await ctx.db.get(dynamicForm.publishedVersionId) : null;
    if (args.formId) {
      if (!dynamicForm || dynamicForm.status !== "active" || !dynamicVersion) throw new Error("This form is not available.");
      if (profile.role === "personnel") {
        const assignment = await ctx.db.query("formAssignments")
          .withIndex("by_user_and_form", (q) => q.eq("userId", userId).eq("formId", args.formId!)).unique();
        if (!assignment) throw new Error("You do not have access to this form.");
      }
    } else if (!profile.allowedForms.includes(args.formType)) {
      throw new Error("You do not have access to this form.");
    }
    const label = deriveLabel(args.formType, args.formValues);

    const managerId = await getPrimaryManagerId(ctx);
    return await ctx.db.insert("formSubmissions", {
      formType: args.formType,
      formId: dynamicForm?._id,
      formVersionId: dynamicVersion?._id,
      formDefinition: dynamicVersion?.definition,
      formTitle: dynamicForm?.title,
      submittedBy: userId,
      submitterUsername: profile.fullName || profile.username,
      managerId,
      status: "draft",
      label,
      startMedia: args.startMedia,
      startNotes: args.startNotes,
      formFields: dynamicVersion ? dynamicVersion.definition.sections.flatMap((section) => section.fields) : flatFields(args.formType),
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
    if (sub.status !== "draft" && sub.status !== "rejected") {
      throw new Error("This form can no longer be submitted.");
    }

    if (sub.startMedia.length === 0) {
      throw new Error("Section 1: upload a start photo or video before submitting.");
    }
    if (!sub.startNotes.trim()) {
      throw new Error("Section 1: start notes are required.");
    }
    validateFormValues(sub.formFields, sub.formValues);
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

export const editSubmission = mutation({
  args: {
    submissionId: v.id("formSubmissions"),
    formValues: v.record(v.string(), formValueValidator),
    attachments: v.array(mediaValidator),
    reason: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireManager(ctx);
    const sub = await ctx.db.get(args.submissionId);
    if (sub === null) throw new Error("Submission not found.");
    if (sub.status !== "submitted" && sub.status !== "approved") {
      throw new Error("Only submitted or approved forms can be corrected by staff.");
    }

    validateFormValues(sub.formFields, args.formValues);
    const fieldIds = sub.formFields
      .filter((field) => JSON.stringify(sub.formValues[field.id]) !== JSON.stringify(args.formValues[field.id]))
      .map((field) => field.id);
    const mediaChanged = attachmentsChanged(sub.attachments, args.attachments);
    if (fieldIds.length === 0 && !mediaChanged) return false;

    if (sub.reportStorageId) await ctx.storage.delete(sub.reportStorageId);
    await ctx.db.patch(args.submissionId, {
      formValues: args.formValues,
      attachments: args.attachments,
      label: deriveLabel(sub.formType, args.formValues),
      reportStorageId: null,
      reportGeneratedAt: null,
      reportVersion: 0,
    });
    await ctx.db.insert("formEdits", {
      submissionId: args.submissionId,
      editedBy: userId,
      editedByUsername: profile.fullName || profile.username,
      fieldIds,
      attachmentsChanged: mediaChanged,
      reason: args.reason?.trim() || null,
    });
    await ctx.db.insert("notifications", {
      userId: sub.submittedBy,
      message: `${profile.fullName || profile.username} corrected your ${FORM_LABELS[sub.formType]} submission.${args.reason?.trim() ? ` ${args.reason.trim()}` : ""}`,
      href: "/mine",
      read: false,
    });
    return true;
  },
});

/** Delete one of the caller's own drafts (and its uploaded media). Drafts only. */
export const deleteDraft = mutation({
  args: { submissionId: v.id("formSubmissions") },
  handler: async (ctx, { submissionId }) => {
    const { userId } = await requireApproved(ctx);
    const sub = await ctx.db.get(submissionId);
    if (sub === null) throw new Error("Submission not found.");
    if (sub.submittedBy !== userId) throw new Error("Not your submission.");
    if (sub.status !== "draft") throw new Error("Only drafts can be deleted.");
    for (const m of [...sub.startMedia, ...sub.attachments, ...sub.finalMedia]) {
      await ctx.storage.delete(m.storageId);
    }
    await ctx.db.delete(submissionId);
  },
});

/** Permanently delete a non-draft submission and all directly linked data. */
export const deleteSubmission = mutation({
  args: { submissionId: v.id("formSubmissions") },
  handler: async (ctx, { submissionId }) => {
    await requireAdmin(ctx);
    const sub = await ctx.db.get(submissionId);
    if (sub === null) throw new Error("Submission not found.");
    if (sub.status === "draft") {
      throw new Error("Drafts cannot be deleted from the dashboard.");
    }

    const [approvals, edits] = await Promise.all([
      ctx.db
        .query("approvals")
        .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
        .take(501),
      ctx.db
        .query("formEdits")
        .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
        .take(501),
    ]);
    if (approvals.length > 500 || edits.length > 500) {
      throw new Error("This submission has too much history to delete safely.");
    }

    const storageIds = new Set<Id<"_storage">>();
    for (const media of [...sub.startMedia, ...sub.attachments, ...sub.finalMedia]) {
      storageIds.add(media.storageId);
    }
    if (sub.reportStorageId) storageIds.add(sub.reportStorageId);
    for (const approval of approvals) {
      if (approval.signatureId) storageIds.add(approval.signatureId);
    }

    for (const approval of approvals) await ctx.db.delete(approval._id);
    for (const edit of edits) await ctx.db.delete(edit._id);
    for (const storageId of storageIds) await ctx.storage.delete(storageId);
    await ctx.db.delete(submissionId);
    return null;
  },
});

/** The caller's own submissions (drafts + submitted/approved/rejected), newest first. */
export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const { userId } = await requireProfile(ctx);
    const result = await ctx.db
      .query("formSubmissions")
      .withIndex("by_submitter", (q) => q.eq("submittedBy", userId))
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((s) => ({
        id: s._id,
        formType: s.formType,
        formTitle: s.formTitle,
        label: s.label,
        status: s.status,
        updatedAt: s._creationTime,
      })),
    };
  },
});

/** Paginated non-draft submissions for one manager folder. */
export const listForManager = query({
  args: { formType: formTypeValidator, paginationOpts: paginationOptsValidator },
  handler: async (ctx, { formType, paginationOpts }) => {
    await requireManager(ctx);
    const result = await ctx.db
      .query("formSubmissions")
      .withIndex("by_formType", (q) => q.eq("formType", formType))
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.filter((s) => s.status !== "draft").map((s) => ({
        id: s._id,
        formType: s.formType,
        label: s.label,
        submitterUsername: s.submitterUsername,
        status: s.status,
        submittedAt: s._creationTime,
        reportVersion: s.reportVersion,
        reportGeneratedAt: s.reportGeneratedAt,
      })),
    };
  },
});

/** Bounded folder summary for the dashboard. */
export const managerSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireManager(ctx);
    const rows = await ctx.db.query("formSubmissions").order("desc").take(1000);
    const summary: Record<string, { count: number; needsConverting: number }> = {};
    for (const row of rows) {
      if (row.status === "draft") continue;
      const item = summary[row.formType] ?? { count: 0, needsConverting: 0 };
      item.count += 1;
      if (row.reportVersion === 0) item.needsConverting += 1;
      summary[row.formType] = item;
    }
    return summary;
  },
});

/** Full detail for one submission — visible to its owner or any manager. */
export const getDetail = query({
  args: { submissionId: v.id("formSubmissions") },
  handler: async (ctx, { submissionId }) => {
    const { userId, profile } = await requireProfile(ctx);
    const sub = await ctx.db.get(submissionId);
    if (sub === null) return null;
    if (profile.role === "personnel" && sub.submittedBy !== userId) {
      throw new Error("Not your submission.");
    }

    const history = (
      await ctx.db
        .query("approvals")
        .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
        .order("desc")
        .take(100)
    ).sort((a, b) => b._creationTime - a._creationTime);
    const edits = (
      await ctx.db
        .query("formEdits")
        .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
        .order("desc")
        .take(100)
    ).sort((a, b) => b._creationTime - a._creationTime);

    return {
      id: sub._id,
      formType: sub.formType,
      formId: sub.formId,
      formDefinition: sub.formDefinition,
      formLabel: sub.formTitle ?? FORM_LABELS[sub.formType],
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
      edits: edits.map((edit) => ({
        id: edit._id,
        editedByUsername: edit.editedByUsername,
        fieldIds: edit.fieldIds,
        attachmentsChanged: edit.attachmentsChanged,
        reason: edit.reason,
        editedAt: edit._creationTime,
      })),
    };
  },
});
