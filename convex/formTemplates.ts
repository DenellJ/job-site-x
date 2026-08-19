import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireApproved, requireManager } from "./helpers";
import { FORM_DEFS, FORM_TYPES, toEditableDefinition, type EditableFormDefinition } from "./formDefs";
import { formDefinitionValidator } from "./validators";

function validateDefinition(definition: EditableFormDefinition) {
  const title = definition.title.trim();
  if (!title) throw new Error("Form title is required.");
  if (definition.sections.length === 0) throw new Error("Add at least one section.");
  const ids = new Set<string>();
  let answerable = 0;
  for (const section of definition.sections) {
    if (!section.id.trim() || ids.has(section.id)) throw new Error("Section IDs must be unique.");
    ids.add(section.id);
    if (!section.title.trim()) throw new Error("Every section needs a title.");
    for (const field of section.fields) {
      if (!field.id.trim() || ids.has(field.id)) throw new Error("Block IDs must be unique.");
      ids.add(field.id);
      if (!field.label.trim()) throw new Error("Every block needs text or a label.");
      if ((field.type === "select" || field.type === "multi_select") && (!field.options || field.options.length < 1)) {
        throw new Error(`"${field.label}" needs at least one option.`);
      }
      if (field.type === "table" && (!field.columns || field.columns.length < 1)) {
        throw new Error(`"${field.label}" needs at least one column.`);
      }
      if (field.type !== "heading" && field.type !== "instructions") answerable += 1;
    }
  }
  if (answerable === 0) throw new Error("Add at least one answerable field.");
  return { ...definition, title };
}

async function ensureDefaults(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await ctx.db.query("forms").withIndex("by_legacyKey").take(20);
  const byLegacy = new Map(existing.flatMap((form) => form.legacyKey ? [[form.legacyKey, form] as const] : []));
  for (const legacyKey of FORM_TYPES) {
    if (byLegacy.has(legacyKey)) continue;
    const definition = toEditableDefinition(FORM_DEFS[legacyKey]);
    const formId = await ctx.db.insert("forms", {
      title: definition.title,
      status: "active",
      legacyKey,
      createdBy: userId,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    const versionId = await ctx.db.insert("formVersions", {
      formId,
      version: 1,
      status: "published",
      definition,
      revision: 1,
      createdBy: userId,
      updatedBy: userId,
      publishedAt: Date.now(),
    });
    await ctx.db.patch(formId, { publishedVersionId: versionId });
    byLegacy.set(legacyKey, (await ctx.db.get(formId))!);
  }

  const profiles = await ctx.db.query("profiles").take(500);
  for (const profile of profiles) {
    if (profile.role !== "personnel") continue;
    for (const legacyKey of profile.allowedForms) {
      const form = byLegacy.get(legacyKey);
      if (!form) continue;
      const assignment = await ctx.db.query("formAssignments")
        .withIndex("by_user_and_form", (q) => q.eq("userId", profile.userId).eq("formId", form._id))
        .unique();
      if (!assignment) await ctx.db.insert("formAssignments", { formId: form._id, userId: profile.userId, assignedBy: userId });
    }
  }
}

export const initializeDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireManager(ctx);
    await ensureDefaults(ctx, userId);
    return null;
  },
});

export const listForManagement = query({
  args: {},
  handler: async (ctx) => {
    await requireManager(ctx);
    const forms = await ctx.db.query("forms").order("desc").take(200);
    return await Promise.all(forms.map(async (form) => {
      const draft = form.draftVersionId ? await ctx.db.get(form.draftVersionId) : null;
      const published = form.publishedVersionId ? await ctx.db.get(form.publishedVersionId) : null;
      return { ...form, draftRevision: draft?.revision ?? null, publishedVersion: published?.version ?? null };
    }));
  },
});

export const listAvailable = query({
  args: {},
  handler: async (ctx) => {
    const { userId, profile } = await requireApproved(ctx);
    if (profile.role === "manager" || profile.role === "admin") {
      const forms = await ctx.db.query("forms").withIndex("by_status", (q) => q.eq("status", "active")).take(200);
      return forms.filter((form) => form.publishedVersionId).map((form) => ({ id: form._id, title: form.title }));
    }
    const assignments = await ctx.db.query("formAssignments").withIndex("by_user", (q) => q.eq("userId", userId)).take(200);
    const forms = await Promise.all(assignments.map((assignment) => ctx.db.get(assignment.formId)));
    return forms.filter((form) => form?.status === "active" && form.publishedVersionId).map((form) => ({ id: form!._id, title: form!.title }));
  },
});

export const getEditor = query({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    await requireManager(ctx);
    const form = await ctx.db.get(formId);
    if (!form) return null;
    const draft = form.draftVersionId ? await ctx.db.get(form.draftVersionId) : null;
    const published = form.publishedVersionId ? await ctx.db.get(form.publishedVersionId) : null;
    const messages = await ctx.db.query("formAiMessages").withIndex("by_form", (q) => q.eq("formId", formId)).order("desc").take(30);
    return { form, draft, published, messages: messages.reverse() };
  },
});

export const createFromInspection = mutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    const { userId } = await requireManager(ctx);
    await ensureDefaults(ctx, userId);
    const inspection = await ctx.db.query("forms").withIndex("by_legacyKey", (q) => q.eq("legacyKey", "job_inspection")).unique();
    if (!inspection?.publishedVersionId) throw new Error("Inspection template is unavailable.");
    const source = await ctx.db.get(inspection.publishedVersionId);
    if (!source) throw new Error("Inspection template is unavailable.");
    const cleanTitle = title.trim() || "New inspection form";
    const formId = await ctx.db.insert("forms", {
      title: cleanTitle, status: "active", createdBy: userId, updatedBy: userId, updatedAt: Date.now(),
    });
    const draftId = await ctx.db.insert("formVersions", {
      formId, version: 1, status: "draft", definition: { ...source.definition, title: cleanTitle },
      revision: 1, createdBy: userId, updatedBy: userId,
    });
    await ctx.db.patch(formId, { draftVersionId: draftId });
    return formId;
  },
});

export const ensureDraft = mutation({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const { userId } = await requireManager(ctx);
    const form = await ctx.db.get(formId);
    if (!form) throw new Error("Form not found.");
    if (form.draftVersionId) return form.draftVersionId;
    if (!form.publishedVersionId) throw new Error("No published version to edit.");
    const published = await ctx.db.get(form.publishedVersionId);
    if (!published) throw new Error("Published version not found.");
    const draftId = await ctx.db.insert("formVersions", {
      formId, version: published.version + 1, status: "draft", definition: published.definition,
      revision: 1, createdBy: userId, updatedBy: userId,
    });
    await ctx.db.patch(formId, { draftVersionId: draftId, updatedBy: userId, updatedAt: Date.now() });
    return draftId;
  },
});

export const saveDraft = mutation({
  args: { formId: v.id("forms"), definition: formDefinitionValidator, expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { userId } = await requireManager(ctx);
    const form = await ctx.db.get(args.formId);
    if (!form?.draftVersionId) throw new Error("Open a draft before editing.");
    const draft = await ctx.db.get(form.draftVersionId);
    if (!draft || draft.status !== "draft") throw new Error("Draft not found.");
    if (draft.revision !== args.expectedRevision) throw new Error("This draft changed elsewhere. Reload before saving.");
    const definition = validateDefinition(args.definition);
    const revision = draft.revision + 1;
    await ctx.db.patch(draft._id, { definition, revision, updatedBy: userId });
    await ctx.db.patch(form._id, { title: definition.title, updatedBy: userId, updatedAt: Date.now() });
    return revision;
  },
});

export const publish = mutation({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    const { userId } = await requireManager(ctx);
    const form = await ctx.db.get(formId);
    if (!form?.draftVersionId) throw new Error("There is no draft to publish.");
    const draft = await ctx.db.get(form.draftVersionId);
    if (!draft) throw new Error("Draft not found.");
    validateDefinition(draft.definition);
    await ctx.db.patch(draft._id, { status: "published", publishedAt: Date.now(), updatedBy: userId });
    await ctx.db.patch(form._id, {
      title: draft.definition.title, publishedVersionId: draft._id, draftVersionId: undefined,
      status: "active", updatedBy: userId, updatedAt: Date.now(),
    });
    return draft.version;
  },
});

export const setArchived = mutation({
  args: { formId: v.id("forms"), archived: v.boolean() },
  handler: async (ctx, { formId, archived }) => {
    const { userId } = await requireManager(ctx);
    const form = await ctx.db.get(formId);
    if (!form) throw new Error("Form not found.");
    await ctx.db.patch(formId, { status: archived ? "archived" : "active", updatedBy: userId, updatedAt: Date.now() });
    return null;
  },
});

export const deleteForm = mutation({
  args: { formId: v.id("forms") },
  handler: async (ctx, { formId }) => {
    await requireManager(ctx);
    const form = await ctx.db.get(formId);
    if (!form) throw new Error("Form not found.");
    if (form.legacyKey) throw new Error("Built-in forms cannot be deleted. Archive them instead.");

    const [versions, assignments, messages] = await Promise.all([
      ctx.db.query("formVersions").withIndex("by_form", (q) => q.eq("formId", formId)).take(501),
      ctx.db.query("formAssignments").withIndex("by_form", (q) => q.eq("formId", formId)).take(501),
      ctx.db.query("formAiMessages").withIndex("by_form", (q) => q.eq("formId", formId)).take(501),
    ]);
    if (versions.length > 500 || assignments.length > 500 || messages.length > 500) {
      throw new Error("This form has too much related history to delete safely. Archive it instead.");
    }

    for (const version of versions) await ctx.db.delete(version._id);
    for (const assignment of assignments) await ctx.db.delete(assignment._id);
    for (const message of messages) await ctx.db.delete(message._id);
    // Submissions keep their snapshotted definition, values, evidence, approvals, and reports.
    await ctx.db.delete(formId);
    return null;
  },
});

export const setAssignments = mutation({
  args: { userId: v.id("users"), formIds: v.array(v.id("forms")) },
  handler: async (ctx, args) => {
    const { userId: assignedBy } = await requireManager(ctx);
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
    if (!profile || profile.role !== "personnel") throw new Error("Only personnel can receive form assignments.");
    const existing = await ctx.db.query("formAssignments").withIndex("by_user", (q) => q.eq("userId", args.userId)).take(500);
    const wanted = new Set(args.formIds);
    for (const assignment of existing) if (!wanted.has(assignment.formId)) await ctx.db.delete(assignment._id);
    const current = new Set(existing.map((assignment) => assignment.formId));
    for (const formId of args.formIds) if (!current.has(formId)) await ctx.db.insert("formAssignments", { formId, userId: args.userId, assignedBy });
    return null;
  },
});

export const getAssignments = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireManager(ctx);
    const assignments = await ctx.db.query("formAssignments").withIndex("by_user", (q) => q.eq("userId", userId)).take(500);
    return assignments.map((assignment) => assignment.formId);
  },
});

export const getAiContext = internalQuery({
  args: { formId: v.id("forms"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
    if (!profile || (profile.role !== "manager" && profile.role !== "admin")) throw new Error("Managers only.");
    const form = await ctx.db.get(args.formId);
    if (!form) throw new Error("Form not found.");
    const versionId = form.draftVersionId ?? form.publishedVersionId;
    const version = versionId ? await ctx.db.get(versionId) : null;
    const messages = await ctx.db.query("formAiMessages").withIndex("by_form", (q) => q.eq("formId", args.formId)).order("desc").take(12);
    return { form, version, messages: messages.reverse() };
  },
});

export const applyAiDraft = internalMutation({
  args: { formId: v.id("forms"), userId: v.id("users"), prompt: v.string(), summary: v.string(), definition: formDefinitionValidator },
  handler: async (ctx, args) => {
    const definition = validateDefinition(args.definition);
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
    if (!profile || (profile.role !== "manager" && profile.role !== "admin")) throw new Error("Managers only.");
    const form = await ctx.db.get(args.formId);
    if (!form) throw new Error("Form not found.");
    let draftId = form.draftVersionId;
    if (!draftId) {
      const published = form.publishedVersionId ? await ctx.db.get(form.publishedVersionId) : null;
      draftId = await ctx.db.insert("formVersions", {
        formId: form._id, version: (published?.version ?? 0) + 1, status: "draft", definition,
        revision: 1, createdBy: args.userId, updatedBy: args.userId,
      });
    } else {
      const draft = await ctx.db.get(draftId);
      if (!draft) throw new Error("Draft not found.");
      await ctx.db.patch(draftId, { definition, revision: draft.revision + 1, updatedBy: args.userId });
    }
    await ctx.db.patch(form._id, { title: definition.title, draftVersionId: draftId, updatedBy: args.userId, updatedAt: Date.now() });
    await ctx.db.insert("formAiMessages", { formId: form._id, userId: args.userId, role: "user", text: args.prompt });
    await ctx.db.insert("formAiMessages", { formId: form._id, userId: args.userId, role: "assistant", text: args.summary });
    return draftId;
  },
});
