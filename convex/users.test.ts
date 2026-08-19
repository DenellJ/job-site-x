/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { FORM_DEFS, toEditableDefinition } from "./formDefs";

const modules = import.meta.glob("./**/*.ts");

describe("user form access", () => {
  test("assignments are unique and keep legacy access synchronized", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", {
        userId: managerId, username: "manager", fullName: "Manager",
        role: "manager", status: "approved", allowedForms: [],
      });
      const workerId = await ctx.db.insert("users", {});
      const profileId = await ctx.db.insert("profiles", {
        userId: workerId, username: "worker", fullName: "Worker",
        role: "personnel", status: "approved", allowedForms: [],
      });
      const definition = toEditableDefinition(FORM_DEFS.job_inspection);
      const builtInId = await ctx.db.insert("forms", {
        title: "Inspection", status: "active", legacyKey: "job_inspection",
        createdBy: managerId, updatedBy: managerId, updatedAt: Date.now(),
      });
      const builtInVersionId = await ctx.db.insert("formVersions", {
        formId: builtInId, version: 1, status: "published", definition, revision: 1,
        createdBy: managerId, updatedBy: managerId, publishedAt: Date.now(),
      });
      await ctx.db.patch(builtInId, { publishedVersionId: builtInVersionId });
      const customId = await ctx.db.insert("forms", {
        title: "Custom safety check", status: "active",
        createdBy: managerId, updatedBy: managerId, updatedAt: Date.now(),
      });
      const customVersionId = await ctx.db.insert("formVersions", {
        formId: customId, version: 1, status: "published",
        definition: { ...definition, title: "Custom safety check" }, revision: 1,
        createdBy: managerId, updatedBy: managerId, publishedAt: Date.now(),
      });
      await ctx.db.patch(customId, { publishedVersionId: customVersionId });
      return { managerId, workerId, profileId, builtInId, customId };
    });

    const asManager = t.withIdentity({ subject: `${seeded.managerId}|test-session` });
    await asManager.mutation(api.formTemplates.setAssignments, {
      userId: seeded.workerId,
      formIds: [seeded.builtInId, seeded.customId, seeded.builtInId],
    });
    let access = await t.run(async (ctx) => ({
      profile: await ctx.db.get(seeded.profileId),
      assignments: await ctx.db.query("formAssignments")
        .withIndex("by_user", (q) => q.eq("userId", seeded.workerId)).take(10),
    }));
    expect(access.assignments).toHaveLength(2);
    expect(access.profile?.allowedForms).toEqual(["job_inspection"]);

    await asManager.mutation(api.formTemplates.setAssignments, {
      userId: seeded.workerId,
      formIds: [seeded.customId],
    });
    access = await t.run(async (ctx) => ({
      profile: await ctx.db.get(seeded.profileId),
      assignments: await ctx.db.query("formAssignments")
        .withIndex("by_user", (q) => q.eq("userId", seeded.workerId)).take(10),
    }));
    expect(access.assignments.map((assignment) => assignment.formId)).toEqual([seeded.customId]);
    expect(access.profile?.allowedForms).toEqual([]);
  });
});

describe("role-safe user deletion", () => {
  test("manager deletes contractor access and auth data but preserves work history", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", {
        userId: managerId, username: "manager", fullName: "Manager",
        role: "manager", status: "approved", allowedForms: [],
      });
      const workerId = await ctx.db.insert("users", { email: "worker@example.com" });
      const profileId = await ctx.db.insert("profiles", {
        userId: workerId, username: "worker", fullName: "Worker",
        role: "personnel", status: "approved", allowedForms: ["job_inspection"],
      });
      const accountId = await ctx.db.insert("authAccounts", {
        userId: workerId, provider: "password", providerAccountId: "worker@example.com", secret: "hash",
      });
      const codeId = await ctx.db.insert("authVerificationCodes", {
        accountId, provider: "password", code: "code", expirationTime: Date.now() + 60_000,
      });
      const rateLimitId = await ctx.db.insert("authRateLimits", {
        identifier: accountId, lastAttemptTime: Date.now(), attemptsLeft: 5,
      });
      const sessionId = await ctx.db.insert("authSessions", {
        userId: workerId, expirationTime: Date.now() + 60_000,
      });
      const refreshTokenId = await ctx.db.insert("authRefreshTokens", {
        sessionId, expirationTime: Date.now() + 60_000,
      });
      const verifierId = await ctx.db.insert("authVerifiers", { sessionId, signature: "signature" });
      const notificationId = await ctx.db.insert("notifications", {
        userId: workerId, message: "Hello", href: null, read: false,
      });
      const definition = toEditableDefinition(FORM_DEFS.job_inspection);
      const formId = await ctx.db.insert("forms", {
        title: "Inspection", status: "active", legacyKey: "job_inspection",
        createdBy: managerId, updatedBy: managerId, updatedAt: Date.now(),
      });
      const assignmentId = await ctx.db.insert("formAssignments", { formId, userId: workerId, assignedBy: managerId });
      const submissionId = await ctx.db.insert("formSubmissions", {
        formType: "job_inspection", submittedBy: workerId, submitterUsername: "Worker",
        managerId, status: "submitted", label: "Historical job", startMedia: [], startNotes: "Started",
        formFields: definition.sections.flatMap((section) => section.fields), formValues: {},
        attachments: [], finalMedia: [], reportStorageId: null, reportGeneratedAt: null, reportVersion: 0,
      });
      const approvalId = await ctx.db.insert("approvals", {
        submissionId, decidedBy: managerId, decision: "approved", comment: null, signatureId: null,
      });
      return {
        managerId, workerId, profileId, accountId, codeId, rateLimitId, sessionId,
        refreshTokenId, verifierId, notificationId, assignmentId, submissionId, approvalId,
      };
    });

    const asManager = t.withIdentity({ subject: `${seeded.managerId}|test-session` });
    await asManager.mutation(api.users.deleteUser, { userId: seeded.workerId });
    const remaining = await t.run(async (ctx) => ({
      user: await ctx.db.get(seeded.workerId),
      profile: await ctx.db.get(seeded.profileId),
      account: await ctx.db.get(seeded.accountId),
      code: await ctx.db.get(seeded.codeId),
      rateLimit: await ctx.db.get(seeded.rateLimitId),
      session: await ctx.db.get(seeded.sessionId),
      refreshToken: await ctx.db.get(seeded.refreshTokenId),
      verifier: await ctx.db.get(seeded.verifierId),
      notification: await ctx.db.get(seeded.notificationId),
      assignment: await ctx.db.get(seeded.assignmentId),
      submission: await ctx.db.get(seeded.submissionId),
      approval: await ctx.db.get(seeded.approvalId),
    }));
    expect(remaining).toMatchObject({
      user: null, profile: null, account: null, code: null, rateLimit: null,
      session: null, refreshToken: null, verifier: null, notification: null, assignment: null,
    });
    expect(remaining.submission).toMatchObject({ submitterUsername: "Worker", label: "Historical job" });
    expect(remaining.approval).toMatchObject({ decision: "approved" });
  });

  test("manager cannot delete staff and personnel cannot delete users", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", { userId: managerId, username: "manager", fullName: "Manager", role: "manager", status: "approved", allowedForms: [] });
      const otherManagerId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", { userId: otherManagerId, username: "manager2", fullName: "Manager 2", role: "manager", status: "approved", allowedForms: [] });
      const workerId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", { userId: workerId, username: "worker", fullName: "Worker", role: "personnel", status: "approved", allowedForms: [] });
      return { managerId, otherManagerId, workerId };
    });
    const asManager = t.withIdentity({ subject: `${ids.managerId}|test-session` });
    await expect(asManager.mutation(api.users.deleteUser, { userId: ids.otherManagerId })).rejects.toThrow("Only admins");
    const asWorker = t.withIdentity({ subject: `${ids.workerId}|test-session` });
    await expect(asWorker.mutation(api.users.deleteUser, { userId: ids.otherManagerId })).rejects.toThrow("Managers only");
  });

  test("admin can delete other staff but cannot delete self or leave no admin", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", { userId: adminId, username: "admin", fullName: "Admin", role: "admin", status: "approved", allowedForms: [] });
      const otherAdminId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", { userId: otherAdminId, username: "admin2", fullName: "Admin 2", role: "admin", status: "approved", allowedForms: [] });
      const managerId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", { userId: managerId, username: "manager", fullName: "Manager", role: "manager", status: "approved", allowedForms: [] });
      return { adminId, otherAdminId, managerId };
    });
    const asAdmin = t.withIdentity({ subject: `${ids.adminId}|test-session` });
    await expect(asAdmin.mutation(api.users.deleteUser, { userId: ids.adminId })).rejects.toThrow("own account");
    await asAdmin.mutation(api.users.deleteUser, { userId: ids.managerId });
    expect(await t.run((ctx) => ctx.db.get(ids.managerId))).toBeNull();
    await asAdmin.mutation(api.users.deleteUser, { userId: ids.otherAdminId });
    expect(await t.run((ctx) => ctx.db.get(ids.otherAdminId))).toBeNull();
    await expect(asAdmin.mutation(api.users.deleteUser, { userId: ids.adminId })).rejects.toThrow("own account");
  });
});
