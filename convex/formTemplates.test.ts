/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { FORM_DEFS, toEditableDefinition } from "./formDefs";
import { isEmptyFormValue } from "./formValues";

const modules = import.meta.glob("./**/*.ts");

describe("versioned form definitions", () => {
  test("inspection becomes an editable definition with stable section ids", () => {
    const definition = toEditableDefinition(FORM_DEFS.job_inspection);
    expect(definition.title).toBe("Inspection");
    expect(definition.sections.length).toBeGreaterThan(1);
    expect(new Set(definition.sections.map((section) => section.id)).size).toBe(definition.sections.length);
  });

  test("dynamic array answers have correct empty semantics", () => {
    expect(isEmptyFormValue([])).toBe(true);
    expect(isEmptyFormValue([""])).toBe(true);
    expect(isEmptyFormValue(["Checked"])).toBe(false);
    expect(isEmptyFormValue([{
      equipment: "", quantity: 1, totalWatts: 300, hoursPerDay: 8, wattHoursPerDay: 2400,
    }])).toBe(true);
    expect(isEmptyFormValue([{
      equipment: "Panel", quantity: null, totalWatts: null, hoursPerDay: null, wattHoursPerDay: null,
    }])).toBe(false);
    expect(isEmptyFormValue([{ Item: "", Result: "" }])).toBe(true);
    expect(isEmptyFormValue([{ Item: "Panel", Result: "OK" }])).toBe(false);
  });

  test("schema accepts a draft and immutable published form version", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      const definition = toEditableDefinition(FORM_DEFS.job_inspection);
      const formId = await ctx.db.insert("forms", {
        title: definition.title, status: "active", createdBy: userId, updatedBy: userId, updatedAt: Date.now(),
      });
      const versionId = await ctx.db.insert("formVersions", {
        formId, version: 1, status: "published", definition, revision: 1,
        createdBy: userId, updatedBy: userId, publishedAt: Date.now(),
      });
      await ctx.db.patch(formId, { publishedVersionId: versionId });
      return await ctx.db.get(formId);
    });
    expect(result?.publishedVersionId).toBeDefined();
  });

  test("manager deletes custom form configuration while preserving snapshotted submissions", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", {
        userId: managerId, username: "manager", fullName: "Site Manager",
        role: "manager", status: "approved", allowedForms: [],
      });
      const workerId = await ctx.db.insert("users", {});
      const definition = { ...toEditableDefinition(FORM_DEFS.job_inspection), title: "Custom inspection" };
      const formId = await ctx.db.insert("forms", {
        title: definition.title, status: "active", createdBy: managerId, updatedBy: managerId, updatedAt: Date.now(),
      });
      const versionId = await ctx.db.insert("formVersions", {
        formId, version: 1, status: "published", definition, revision: 1,
        createdBy: managerId, updatedBy: managerId, publishedAt: Date.now(),
      });
      await ctx.db.patch(formId, { publishedVersionId: versionId });
      await ctx.db.insert("formAssignments", { formId, userId: workerId, assignedBy: managerId });
      await ctx.db.insert("formAiMessages", { formId, userId: managerId, role: "assistant", text: "Draft created." });
      const submissionId = await ctx.db.insert("formSubmissions", {
        formType: "job_inspection", formId, formVersionId: versionId, formDefinition: definition,
        formTitle: definition.title, submittedBy: workerId, submitterUsername: "Worker",
        managerId, status: "draft", label: "Historical job", startMedia: [], startNotes: "Started",
        formFields: definition.sections.flatMap((section) => section.fields), formValues: {}, attachments: [], finalMedia: [],
        reportStorageId: null, reportGeneratedAt: null, reportVersion: 0,
      });
      return { managerId, formId, submissionId };
    });

    const asManager = t.withIdentity({ subject: `${seeded.managerId}|test-session` });
    await asManager.mutation(api.formTemplates.deleteForm, { formId: seeded.formId });

    const remaining = await t.run(async (ctx) => ({
      form: await ctx.db.get(seeded.formId),
      versions: await ctx.db.query("formVersions").withIndex("by_form", (q) => q.eq("formId", seeded.formId)).take(10),
      assignments: await ctx.db.query("formAssignments").withIndex("by_form", (q) => q.eq("formId", seeded.formId)).take(10),
      messages: await ctx.db.query("formAiMessages").withIndex("by_form", (q) => q.eq("formId", seeded.formId)).take(10),
      submission: await ctx.db.get(seeded.submissionId),
    }));
    expect(remaining.form).toBeNull();
    expect(remaining.versions).toEqual([]);
    expect(remaining.assignments).toEqual([]);
    expect(remaining.messages).toEqual([]);
    expect(remaining.submission).toMatchObject({ formTitle: "Custom inspection", label: "Historical job" });
  });

  test("deleteForm protects built-in forms and rejects personnel", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", {
        userId: managerId, username: "manager", fullName: "Manager",
        role: "manager", status: "approved", allowedForms: [],
      });
      const personnelId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", {
        userId: personnelId, username: "worker", fullName: "Worker",
        role: "personnel", status: "approved", allowedForms: [],
      });
      const builtInId = await ctx.db.insert("forms", {
        title: "Inspection", status: "active", legacyKey: "job_inspection",
        createdBy: managerId, updatedBy: managerId, updatedAt: Date.now(),
      });
      const customId = await ctx.db.insert("forms", {
        title: "Custom", status: "active", createdBy: managerId, updatedBy: managerId, updatedAt: Date.now(),
      });
      return { managerId, personnelId, builtInId, customId };
    });

    const asManager = t.withIdentity({ subject: `${seeded.managerId}|test-session` });
    await expect(asManager.mutation(api.formTemplates.deleteForm, { formId: seeded.builtInId })).rejects.toThrow();
    const asPersonnel = t.withIdentity({ subject: `${seeded.personnelId}|test-session` });
    await expect(asPersonnel.mutation(api.formTemplates.deleteForm, { formId: seeded.customId })).rejects.toThrow();
    const formsRemain = await t.run(async (ctx) => ({
      builtIn: await ctx.db.get(seeded.builtInId), custom: await ctx.db.get(seeded.customId),
    }));
    expect(formsRemain.builtIn).not.toBeNull();
    expect(formsRemain.custom).not.toBeNull();
  });

  test("admin can delete a custom form", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {});
      await ctx.db.insert("profiles", {
        userId: adminId, username: "admin", fullName: "Admin",
        role: "admin", status: "approved", allowedForms: [],
      });
      const formId = await ctx.db.insert("forms", {
        title: "Admin custom form", status: "archived", createdBy: adminId, updatedBy: adminId, updatedAt: Date.now(),
      });
      return { adminId, formId };
    });
    const asAdmin = t.withIdentity({ subject: `${seeded.adminId}|test-session` });
    await asAdmin.mutation(api.formTemplates.deleteForm, { formId: seeded.formId });
    expect(await t.run((ctx) => ctx.db.get(seeded.formId))).toBeNull();
  });
});
