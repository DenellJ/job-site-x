/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
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
});
