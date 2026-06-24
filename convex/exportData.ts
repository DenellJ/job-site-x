import { internalQuery } from "./_generated/server";
import { requireManager } from "./helpers";
import { FORM_LABELS, isSketchValue } from "./formDefs";

function display(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Manager-only: every non-draft submission as a flat row for the Excel export. */
export const getAllForExport = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireManager(ctx);
    const subs = await ctx.db.query("formSubmissions").collect();
    return subs
      .filter((s) => s.status !== "draft")
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((s) => {
        const details = s.formFields
          .filter((f) => f.type !== "sketch" && !isSketchValue(s.formValues[f.id]))
          .map((f) => `${f.label}: ${display(s.formValues[f.id])}`)
          .join(" | ");
        return {
          Form: FORM_LABELS[s.formType],
          Reference: s.label,
          "Submitted By": s.submitterUsername,
          Status: s.status,
          "Submitted On": new Date(s._creationTime).toLocaleString(),
          "Start Notes": s.startNotes,
          "Report Converted": s.reportVersion > 0 ? "Yes" : "No",
          "Report Version": s.reportVersion,
          "Report Date": s.reportGeneratedAt ? new Date(s.reportGeneratedAt).toLocaleString() : "",
          Details: details,
        };
      });
  },
});
