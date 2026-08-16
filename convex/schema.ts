import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  accountStatusValidator,
  formDefinitionValidator,
  formFieldValidator,
  formStatusValidator,
  formTypeValidator,
  formValueValidator,
  formVersionStatusValidator,
  mediaValidator,
  roleValidator,
  submissionStatusValidator,
} from "./validators";

export default defineSchema({
  // Convex Auth tables: `users`, `authAccounts`, `authSessions`, etc.
  ...authTables,

  // App profile, one per auth user.
  //  - `status`: retained for compatibility with historical pending/declined
  //    accounts. Newly provisioned staff-created accounts are approved immediately.
  //  - `allowedForms`: the Section-2 forms this user may complete.
  // "Is the site set up?" = does any manager profile exist (`by_role`).
  profiles: defineTable({
    userId: v.id("users"),
    username: v.string(),
    fullName: v.union(v.string(), v.null()),
    role: roleValidator,
    status: accountStatusValidator,
    allowedForms: v.array(formTypeValidator),
  })
    .index("by_user", ["userId"])
    .index("by_role", ["role"])
    .index("by_status", ["status"]),

  forms: defineTable({
    title: v.string(),
    status: formStatusValidator,
    legacyKey: v.optional(formTypeValidator),
    publishedVersionId: v.optional(v.id("formVersions")),
    draftVersionId: v.optional(v.id("formVersions")),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_legacyKey", ["legacyKey"]),

  formVersions: defineTable({
    formId: v.id("forms"),
    version: v.number(),
    status: formVersionStatusValidator,
    definition: formDefinitionValidator,
    revision: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    publishedAt: v.optional(v.number()),
  })
    .index("by_form", ["formId"])
    .index("by_form_and_status", ["formId", "status"]),

  formAssignments: defineTable({
    formId: v.id("forms"),
    userId: v.id("users"),
    assignedBy: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_form", ["formId"])
    .index("by_user_and_form", ["userId", "formId"]),

  formAiMessages: defineTable({
    formId: v.id("forms"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("error")),
    text: v.string(),
  }).index("by_form", ["formId"]),

  // One per job a technician works: Section 1 start evidence + a chosen Section 2
  // form + final completion evidence. Lifecycle: draft → submitted → approved|rejected.
  formSubmissions: defineTable({
    formType: formTypeValidator,
    formId: v.optional(v.id("forms")),
    formVersionId: v.optional(v.id("formVersions")),
    formDefinition: v.optional(formDefinitionValidator),
    formTitle: v.optional(v.string()),
    submittedBy: v.id("users"),
    submitterUsername: v.string(),
    managerId: v.id("users"), // primary manager (single tenant) — for the record
    status: submissionStatusValidator,
    label: v.string(), // display label, derived from a key field (e.g. client name)

    // Section 1 — Job-Site Start Evidence (mandatory gate before Section 2).
    startMedia: v.array(mediaValidator),
    startNotes: v.string(),

    // Section 2 — the digital form.
    formFields: v.array(formFieldValidator), // snapshot of the def at create time
    formValues: v.record(v.string(), formValueValidator),
    attachments: v.array(mediaValidator), // photos/videos attached while filling

    // Mandatory final completion evidence (gate before submit).
    finalMedia: v.array(mediaValidator),

    // Customer-facing Inspection Report conversion state.
    reportStorageId: v.union(v.id("_storage"), v.null()),
    reportGeneratedAt: v.union(v.number(), v.null()),
    reportVersion: v.number(), // 0 = not yet converted
  })
    .index("by_submitter", ["submittedBy"])
    .index("by_status", ["status"])
    .index("by_formType", ["formType"]),

  approvals: defineTable({
    submissionId: v.id("formSubmissions"),
    decidedBy: v.id("users"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    comment: v.union(v.string(), v.null()),
    signatureId: v.union(v.id("_storage"), v.null()),
  }).index("by_submission", ["submissionId"]),

  formEdits: defineTable({
    submissionId: v.id("formSubmissions"),
    editedBy: v.id("users"),
    editedByUsername: v.string(),
    fieldIds: v.array(v.string()),
    attachmentsChanged: v.boolean(),
    reason: v.union(v.string(), v.null()),
  }).index("by_submission", ["submissionId"]),

  // Per-user notification inbox (reactive).
  notifications: defineTable({
    userId: v.id("users"),
    message: v.string(),
    href: v.union(v.string(), v.null()),
    read: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_read", ["userId", "read"]),
});
