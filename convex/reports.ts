"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Id } from "./_generated/dataModel";

const PAGE_W = 595.28; // A4 in points
const PAGE_H = 841.89;
const MARGIN = 50;
const RESSCOTT_GREEN = rgb(0.353, 0.655, 0.18);
const INK = rgb(0.05, 0.04, 0.03);
const GREY = rgb(0.45, 0.45, 0.45);

const RESSCOTT_CONTACT = [
  "Office Address: #500 Munroe Road, Charlieville, Trinidad WI.",
  "Tel: +1 868 688-9950, +1 868 362 5276",
  "Email: renewable-energy@resscott.com   Website: www.resscott.com",
];

/**
 * Convert an approved/submitted form into the customer-facing Inspection Report
 * PDF (modeled on Resscott's report letterhead) and store it against the
 * submission. Re-running overwrites the PDF and bumps the version.
 */
export const convert = action({
  args: { submissionId: v.id("formSubmissions") },
  handler: async (ctx, { submissionId }): Promise<{ reportVersion: number }> => {
    const data = await ctx.runQuery(internal.reportData.getForReport, { submissionId });

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const newPage = () => {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    };
    const ensure = (needed: number) => {
      if (y - needed < MARGIN) newPage();
    };

    const wrap = (text: string, f: PDFFont, size: number, maxW: number): string[] => {
      const lines: string[] = [];
      for (const raw of text.split("\n")) {
        const words = raw.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
          lines.push("");
          continue;
        }
        let line = "";
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (f.widthOfTextAtSize(candidate, size) > maxW && line) {
            lines.push(line);
            line = word;
          } else {
            line = candidate;
          }
        }
        if (line) lines.push(line);
      }
      return lines;
    };

    const text = (
      content: string,
      opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {},
    ) => {
      const size = opts.size ?? 11;
      const f = opts.font ?? font;
      const color = opts.color ?? INK;
      const maxW = PAGE_W - MARGIN * 2;
      for (const line of wrap(content, f, size, maxW)) {
        ensure(size + 4);
        page.drawText(line, { x: MARGIN, y: y - size, size, font: f, color });
        y -= size + (opts.gap ?? 5);
      }
    };

    const heading = (label: string) => {
      y -= 8;
      ensure(24);
      page.drawText(label, { x: MARGIN, y: y - 13, size: 13, font: bold, color: RESSCOTT_GREEN });
      y -= 18;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_W - MARGIN, y },
        thickness: 1,
        color: RESSCOTT_GREEN,
      });
      y -= 10;
    };

    // ---- Letterhead ----
    page.drawText("RESSCOTT LIMITED", { x: MARGIN, y: y - 22, size: 22, font: bold, color: RESSCOTT_GREEN });
    y -= 30;
    page.drawText("INSPECTION REPORT", { x: MARGIN, y: y - 12, size: 12, font: bold, color: INK });
    y -= 22;
    for (const line of RESSCOTT_CONTACT) {
      page.drawText(line, { x: MARGIN, y: y - 9, size: 9, font, color: GREY });
      y -= 13;
    }
    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 1.5,
      color: RESSCOTT_GREEN,
    });
    y -= 14;

    // ---- Report meta ----
    const date = new Date(data.submittedAt).toLocaleDateString();
    text(`Report: ${data.formLabel} — ${data.label}`, { font: bold, size: 12 });
    text(`Date: ${date}    Prepared by: ${data.submitterUsername}    Status: ${data.status}`, {
      size: 10,
      color: GREY,
    });

    // ---- Introduction ----
    heading("Introduction");
    text(
      `This report summarises the ${data.formLabel.toLowerCase()} carried out by RESSCOTT LIMITED. ` +
        `It records the site observations, the captured field data, and the supporting photographic evidence ` +
        `gathered at the start and on completion of the job.`,
    );

    // ---- Job-Site Start Notes ----
    heading("Job-Site Start Notes");
    text(data.startNotes || "—");

    // ---- Form details ----
    heading(`${data.formLabel} — Details`);
    for (const f of data.fields) {
      ensure(16);
      const labelW = font.widthOfTextAtSize(`${f.label}: `, 10);
      page.drawText(`${f.label}: `, { x: MARGIN, y: y - 10, size: 10, font: bold, color: INK });
      for (const [i, line] of wrap(f.value, font, 10, PAGE_W - MARGIN * 2 - labelW).entries()) {
        if (i > 0) {
          ensure(14);
          y -= 13;
        }
        page.drawText(line, { x: MARGIN + labelW, y: y - 10, size: 10, font, color: INK });
      }
      y -= 16;
    }

    // ---- Photographic evidence ----
    const allMedia = [
      ...data.startMedia.map((m) => ({ ...m, group: "Start of job" })),
      ...data.attachments.map((m) => ({ ...m, group: "During job" })),
      ...data.finalMedia.map((m) => ({ ...m, group: "Job complete" })),
    ];
    if (allMedia.length > 0) {
      heading("Photographic Evidence");
      for (const m of allMedia) {
        if (m.kind === "video") {
          text(`• ${m.group}: video evidence attached${m.caption ? ` — ${m.caption}` : ""}`, { size: 10, color: GREY });
          continue;
        }
        const blob = await ctx.storage.get(m.storageId as Id<"_storage">);
        if (!blob) continue;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let img;
        try {
          img = await pdf.embedJpg(bytes);
        } catch {
          try {
            img = await pdf.embedPng(bytes);
          } catch {
            continue;
          }
        }
        const maxW = PAGE_W - MARGIN * 2;
        const maxH = 300;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        ensure(h + 22);
        page.drawText(`${m.group}${m.caption ? ` — ${m.caption}` : ""}`, {
          x: MARGIN,
          y: y - 10,
          size: 9,
          font: bold,
          color: GREY,
        });
        y -= 14;
        page.drawImage(img, { x: MARGIN, y: y - h, width: w, height: h });
        y -= h + 12;
      }
    }

    // ---- Sign-off ----
    heading("Conclusion");
    text(
      "RESSCOTT LIMITED thanks you for the opportunity to be of service. Please direct any questions " +
        "regarding this report to renewable-energy@resscott.com.",
    );
    y -= 18;
    text("For RESSCOTT LIMITED", { font: bold, size: 10 });

    const pdfBytes = await pdf.save();
    const reportStorageId = await ctx.storage.store(
      new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }),
    );
    const reportVersion: number = await ctx.runMutation(internal.reportData.saveReport, {
      submissionId,
      reportStorageId,
    });
    return { reportVersion };
  },
});
