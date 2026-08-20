/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { FORM_DEFS } from "./formDefs";

const modules = import.meta.glob("./**/*.ts");
const fields = FORM_DEFS.job_inspection.sections.flatMap((section) => section.fields);

describe("admin dashboard submission deletion", () => {
  test("admin deletes every dashboard status and all directly linked data", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", {
        userId: adminId,
        username: "admin",
        fullName: "Admin",
        role: "admin",
        status: "approved",
        allowedForms: [],
      });
      const workerId = await ctx.db.insert("users", {});
      const evidenceId = await ctx.storage.store(new Blob(["evidence"], { type: "image/jpeg" }));
      const completionId = await ctx.storage.store(new Blob(["complete"], { type: "image/jpeg" }));
      const reportId = await ctx.storage.store(new Blob(["report"], { type: "application/pdf" }));
      const signatureId = await ctx.storage.store(new Blob(["signature"], { type: "image/png" }));

      const approvedId = await ctx.db.insert("formSubmissions", {
        formType: "job_inspection",
        submittedBy: workerId,
        submitterUsername: "Worker",
        managerId: adminId,
        status: "approved",
        label: "Approved job",
        startMedia: [{ storageId: evidenceId, kind: "photo", caption: null }],
        startNotes: "Started",
        formFields: fields,
        formValues: {},
        // Reuse one storage ID to verify deletion deduplicates references.
        attachments: [{ storageId: evidenceId, kind: "photo", caption: null }],
        finalMedia: [{ storageId: completionId, kind: "photo", caption: null }],
        reportStorageId: reportId,
        reportGeneratedAt: Date.now(),
        reportVersion: 1,
      });
      const approvalId = await ctx.db.insert("approvals", {
        submissionId: approvedId,
        decidedBy: adminId,
        decision: "approved",
        comment: null,
        signatureId,
      });
      const editId = await ctx.db.insert("formEdits", {
        submissionId: approvedId,
        editedBy: adminId,
        editedByUsername: "Admin",
        fieldIds: [],
        attachmentsChanged: true,
        reason: null,
      });

      const submittedId = await ctx.db.insert("formSubmissions", {
        formType: "job_inspection",
        submittedBy: workerId,
        submitterUsername: "Worker",
        managerId: adminId,
        status: "submitted",
        label: "Submitted job",
        startMedia: [],
        startNotes: "Started",
        formFields: fields,
        formValues: {},
        attachments: [],
        finalMedia: [],
        reportStorageId: null,
        reportGeneratedAt: null,
        reportVersion: 0,
      });
      const rejectedId = await ctx.db.insert("formSubmissions", {
        formType: "job_inspection",
        submittedBy: workerId,
        submitterUsername: "Worker",
        managerId: adminId,
        status: "rejected",
        label: "Rejected job",
        startMedia: [],
        startNotes: "Started",
        formFields: fields,
        formValues: {},
        attachments: [],
        finalMedia: [],
        reportStorageId: null,
        reportGeneratedAt: null,
        reportVersion: 0,
      });
      return {
        adminId,
        approvedId,
        submittedId,
        rejectedId,
        approvalId,
        editId,
        storageIds: [evidenceId, completionId, reportId, signatureId],
      };
    });

    const asAdmin = t.withIdentity({ subject: `${seeded.adminId}|test-session` });
    await asAdmin.mutation(api.submissions.deleteSubmission, { submissionId: seeded.approvedId });

    const afterApproved = await t.run(async (ctx) => ({
      submission: await ctx.db.get(seeded.approvedId),
      approval: await ctx.db.get(seeded.approvalId),
      edit: await ctx.db.get(seeded.editId),
      storage: await Promise.all(
        seeded.storageIds.map((storageId) => ctx.db.system.get("_storage", storageId)),
      ),
    }));
    expect(afterApproved).toEqual({
      submission: null,
      approval: null,
      edit: null,
      storage: [null, null, null, null],
    });

    const folder = await asAdmin.query(api.submissions.listForManager, {
      formType: "job_inspection",
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(folder.page.map((item) => item.id)).not.toContain(seeded.approvedId);
    expect((await asAdmin.query(api.submissions.managerSummary, {})).job_inspection?.count).toBe(2);

    await asAdmin.mutation(api.submissions.deleteSubmission, { submissionId: seeded.submittedId });
    await asAdmin.mutation(api.submissions.deleteSubmission, { submissionId: seeded.rejectedId });
    expect(await t.run((ctx) => ctx.db.get(seeded.submittedId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(seeded.rejectedId))).toBeNull();
  });

  test("drafts and non-admin callers are rejected without data loss", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", { userId: adminId, username: "admin", fullName: "Admin", role: "admin", status: "approved", allowedForms: [] });
      const managerId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", { userId: managerId, username: "manager", fullName: "Manager", role: "manager", status: "approved", allowedForms: [] });
      const personnelId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", { userId: personnelId, username: "worker", fullName: "Worker", role: "personnel", status: "approved", allowedForms: [] });
      const declinedAdminId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", { userId: declinedAdminId, username: "declined", fullName: "Declined Admin", role: "admin", status: "declined", allowedForms: [] });
      const common = {
        formType: "job_inspection" as const,
        submittedBy: personnelId,
        submitterUsername: "Worker",
        managerId,
        startMedia: [],
        startNotes: "Started",
        formFields: fields,
        formValues: {},
        attachments: [],
        finalMedia: [],
        reportStorageId: null,
        reportGeneratedAt: null,
        reportVersion: 0,
      };
      const draftId = await ctx.db.insert("formSubmissions", { ...common, status: "draft", label: "Draft job" });
      const submittedId = await ctx.db.insert("formSubmissions", { ...common, status: "submitted", label: "Submitted job" });
      return { adminId, managerId, personnelId, declinedAdminId, draftId, submittedId };
    });

    const asAdmin = t.withIdentity({ subject: `${seeded.adminId}|test-session` });
    const asManager = t.withIdentity({ subject: `${seeded.managerId}|test-session` });
    const asPersonnel = t.withIdentity({ subject: `${seeded.personnelId}|test-session` });
    const asDeclinedAdmin = t.withIdentity({ subject: `${seeded.declinedAdminId}|test-session` });
    await expect(asAdmin.mutation(api.submissions.deleteSubmission, { submissionId: seeded.draftId })).rejects.toThrow("Drafts cannot be deleted");
    await expect(asManager.mutation(api.submissions.deleteSubmission, { submissionId: seeded.submittedId })).rejects.toThrow("Admins only");
    await expect(asPersonnel.mutation(api.submissions.deleteSubmission, { submissionId: seeded.submittedId })).rejects.toThrow("Admins only");
    await expect(t.mutation(api.submissions.deleteSubmission, { submissionId: seeded.submittedId })).rejects.toThrow("Not authenticated");
    await expect(asDeclinedAdmin.mutation(api.submissions.deleteSubmission, { submissionId: seeded.submittedId })).rejects.toThrow("not approved");

    const remaining = await t.run(async (ctx) => ({
      draft: await ctx.db.get(seeded.draftId),
      submitted: await ctx.db.get(seeded.submittedId),
    }));
    expect(remaining.draft).not.toBeNull();
    expect(remaining.submitted).not.toBeNull();
  });
});
