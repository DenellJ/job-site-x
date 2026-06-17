"use node";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import * as XLSX from "xlsx";

/**
 * Manager-only: export the full submissions database as an .xlsx file. Stores the
 * workbook in Convex storage and returns a short-lived download URL.
 */
export const exportDatabase = action({
  args: {},
  handler: async (ctx): Promise<{ url: string | null; count: number }> => {
    const rows = await ctx.runQuery(internal.exportData.getAllForExport, {});

    const worksheet = XLSX.utils.json_to_sheet(
      rows.length > 0
        ? rows
        : [{ Form: "", Reference: "", "Submitted By": "", Status: "", "Submitted On": "" }],
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const storageId = await ctx.storage.store(
      new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const url = await ctx.storage.getUrl(storageId);
    return { url, count: rows.length };
  },
});
