import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const migrations = new Migrations<DataModel>((components as any).migrations);

export const backfillSubmissionFormRefs = migrations.define({
  table: "formSubmissions",
  migrateOne: async (ctx, submission) => {
    if (submission.formId) return;
    const form = await ctx.db.query("forms").withIndex("by_legacyKey", (q) => q.eq("legacyKey", submission.formType)).unique();
    if (!form) return;
    return { formId: form._id, formVersionId: form.publishedVersionId, formTitle: form.title };
  },
});

export const backfillProfileAssignments = migrations.define({
  table: "profiles",
  migrateOne: async (ctx, profile) => {
    if (profile.role !== "personnel") return;
    const staff = await ctx.db.query("profiles").withIndex("by_role", (q) => q.eq("role", "manager")).first()
      ?? await ctx.db.query("profiles").withIndex("by_role", (q) => q.eq("role", "admin")).first();
    if (!staff) return;
    for (const legacyKey of profile.allowedForms) {
      const form = await ctx.db.query("forms").withIndex("by_legacyKey", (q) => q.eq("legacyKey", legacyKey)).unique();
      if (!form) continue;
      const existing = await ctx.db.query("formAssignments")
        .withIndex("by_user_and_form", (q) => q.eq("userId", profile.userId).eq("formId", form._id)).unique();
      if (!existing) await ctx.db.insert("formAssignments", { formId: form._id, userId: profile.userId, assignedBy: staff.userId });
    }
  },
});

export const run = migrations.runner();
