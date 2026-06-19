"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import type { Id } from "./_generated/dataModel";
import { RESSCOTT_LOGO_PNG_BASE64 } from "./resscottLogo";

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_FLOOR = MARGIN + 22;

const GREEN = rgb(0.353, 0.655, 0.18);
const INK = rgb(0.1, 0.09, 0.08);
const GREY = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.8, 0.8, 0.78);

const CONTACT =
  "Office Address: #500 Munroe, Charlieville, Trinidad WI.   Tel: +1 868 688-9950, +1 868 366-2471   Email: renewable-energy@resscott.com   Website: www.resscott.com";

const LETTER_TYPES = new Set(["site_visit", "solar_water_heater"]);

const BENEFITS = [
  "Repairs are made to manufacturer specifications, or a change-out is done.",
  "Maintains the equipment integrity.",
  "Complies with Manufacturer / OSHA regulations.",
  "Maintains warranty.",
  "All work done is stated on a service certificate and used for history.",
];
const RECOMMENDATION_DEFAULT =
  "Client to conduct a 6-month assessment to ensure safe operation and to identify any abnormal operation. Cleaning frequency will depend on site conditions.";
const DECLARATION =
  "I ______________________________________________________ accept the product of RESSCOTT Limited in good working condition. All components and fire-safe elements were identified to me and I agree to the terms and conditions of this product.";
const TERMS =
  "The RESSCOTT company keeps detailed inspection photos and reports in-house to identify any tamper or alterations that may be observed; the said report will be used as a comparison during inspection. The Client/user must operate the product within its specifications and standard operating procedure (SOP). The product is not to be used outside its specifications or SOP so as not to hinder safety or compromise any fire-safe elements or warranty. All components of this product are designed to the specific needs of the client and shall not be altered in any form or fashion. Alterations done by the client can lead to failure and immediately void the warranty and trade name of the supplier. Clients are advised that they must review their documentation before acceptance of our products/services, as RESSCOTT Limited is not responsible for any discrepancies thereafter. Mobilization and technicians' fees must be charged when items under warranty are to be changed out. RESSCOTT Ltd can provide virtual diagnostic services to ensure client satisfaction. Any defects noted — the equipment can be changed out in accordance with its warranty period.";

const OFFICERS = [
  {
    name: "GRAEME JONES",
    title: "MANAGING DIRECTOR",
    creds: [
      "MBA Project Management · BSc. Mechanical Engineering (UWI)",
      "Registered Professional Engineer (BOETT) · QA/QC Inspector",
      "ASQ CRE, CMQ/OE, CSSGB · PMI PMP · ASNT Level 1 · Failure Analysis Engineer",
    ],
  },
  {
    name: "SHAMIR KHAN",
    title: "OPERATIONS DIRECTOR",
    creds: [
      "BSc. Mechanical Engineering (UWI) · QA/QC Inspector",
      "Certified CWI Inspector, NACE, ASNT Level II, API 510 Inspector",
      "Metallographic Interpretation (ASM International) · Failure Analysis Consultant",
    ],
  },
];

type RGB = ReturnType<typeof rgb>;
type Media = { storageId: string; kind: "photo" | "video"; caption: string | null };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function fmtDate(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}

export const convert = action({
  args: { submissionId: v.id("formSubmissions") },
  handler: async (ctx, { submissionId }): Promise<{ reportVersion: number }> => {
    const data = await ctx.runQuery(internal.reportData.getForReport, { submissionId });

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
    const logo = await pdf.embedPng(RESSCOTT_LOGO_PNG_BASE64);

    // Manager's drawn signature (only present once approved).
    let mgrSig: PDFImage | null = null;
    if (data.managerSignatureId) {
      const blob = await ctx.storage.get(data.managerSignatureId as Id<"_storage">);
      if (blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        try {
          mgrSig = await pdf.embedPng(bytes);
        } catch {
          try {
            mgrSig = await pdf.embedJpg(bytes);
          } catch {
            mgrSig = null;
          }
        }
      }
    }

    const isLetter = LETTER_TYPES.has(data.formType);
    const ref = `IR-RES${fmtDate(data.submittedAt).replace(/\//g, "")}-${String(submissionId)
      .slice(-4)
      .toUpperCase()}`;

    const state = { page: pdf.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN };
    let onNewPage = () => {
      state.page = pdf.addPage([PAGE_W, PAGE_H]);
      state.y = PAGE_H - MARGIN;
    };

    // ---------- low-level helpers ----------
    const wrap = (t: string, f: PDFFont, size: number, maxW: number): string[] => {
      const out: string[] = [];
      for (const raw of (t || "").split("\n")) {
        const words = raw.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
          out.push("");
          continue;
        }
        let line = "";
        for (const w of words) {
          const cand = line ? `${line} ${w}` : w;
          if (f.widthOfTextAtSize(cand, size) > maxW && line) {
            out.push(line);
            line = w;
          } else line = cand;
        }
        if (line) out.push(line);
      }
      return out;
    };
    const ensure = (need: number) => {
      if (state.y - need < FOOTER_FLOOR) onNewPage();
    };
    const para = (
      content: string,
      opts: { size?: number; font?: PDFFont; color?: RGB; gap?: number; indent?: number } = {},
    ) => {
      const size = opts.size ?? 10.5;
      const f = opts.font ?? font;
      const color = opts.color ?? INK;
      const x = MARGIN + (opts.indent ?? 0);
      for (const ln of wrap(content, f, size, CONTENT_W - (opts.indent ?? 0))) {
        ensure(size + 4);
        state.page.drawText(ln, { x, y: state.y - size, size, font: f, color });
        state.y -= size + (opts.gap ?? 4);
      }
    };
    const gap = (h: number) => {
      state.y -= h;
    };
    const heading = (label: string) => {
      gap(8);
      ensure(22);
      state.page.drawText(label, { x: MARGIN, y: state.y - 12, size: 12, font: bold, color: GREEN });
      state.y -= 16;
      state.page.drawLine({
        start: { x: MARGIN, y: state.y },
        end: { x: PAGE_W - MARGIN, y: state.y },
        thickness: 1,
        color: GREEN,
      });
      state.y -= 10;
    };
    const bullets = (items: string[]) => {
      for (const it of items) {
        for (const [i, ln] of wrap(it, font, 10, CONTENT_W - 16).entries()) {
          ensure(14);
          if (i === 0) state.page.drawText("•", { x: MARGIN + 2, y: state.y - 10, size: 10, font, color: GREEN });
          state.page.drawText(ln, { x: MARGIN + 16, y: state.y - 10, size: 10, font, color: INK });
          state.y -= 13;
        }
      }
    };
    // Two-column label / value table with hairline rows.
    const fieldTable = (rows: { label: string; value: string }[]) => {
      const labelW = CONTENT_W * 0.4;
      for (const r of rows) {
        const lLines = wrap(r.label, bold, 9, labelW - 6);
        const vLines = wrap(r.value || "—", font, 9, CONTENT_W - labelW - 8);
        const rowH = Math.max(lLines.length, vLines.length) * 11 + 6;
        ensure(rowH);
        const top = state.y;
        lLines.forEach((ln, i) =>
          state.page.drawText(ln, { x: MARGIN + 2, y: top - 11 - i * 11, size: 9, font: bold, color: INK }),
        );
        vLines.forEach((ln, i) =>
          state.page.drawText(ln, { x: MARGIN + labelW + 6, y: top - 11 - i * 11, size: 9, font, color: INK }),
        );
        state.y = top - rowH;
        state.page.drawLine({
          start: { x: MARGIN, y: state.y + 2 },
          end: { x: PAGE_W - MARGIN, y: state.y + 2 },
          thickness: 0.4,
          color: LINE,
        });
      }
    };
    const photoBlock = async (m: Media, caption: string) => {
      if (m.kind === "video") {
        ensure(16);
        para(`${caption} — video evidence attached${m.caption ? `: ${m.caption}` : ""}`, { size: 9, color: GREY });
        return;
      }
      const blob = await ctx.storage.get(m.storageId as Id<"_storage">);
      if (!blob) return;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let img: PDFImage;
      try {
        img = await pdf.embedJpg(bytes);
      } catch {
        try {
          img = await pdf.embedPng(bytes);
        } catch {
          return;
        }
      }
      const scale = Math.min(CONTENT_W / img.width, 360 / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      ensure(h + 16);
      state.page.drawImage(img, { x: MARGIN, y: state.y - h, width: w, height: h });
      state.y -= h + 4;
      const cap = m.caption ? `${caption}: ${m.caption}` : caption;
      state.page.drawText(cap, { x: MARGIN, y: state.y - 9, size: 8, font: italic, color: GREY });
      state.y -= 16;
    };
    const signatures = (officers: typeof OFFICERS) => {
      gap(6);
      ensure(70 + officers.length * 52);
      if (mgrSig) {
        const sh = 38;
        const sw = Math.min(mgrSig.width * (sh / mgrSig.height), 200);
        state.page.drawImage(mgrSig, { x: MARGIN, y: state.y - sh, width: sw, height: sh });
        state.y -= sh + 2;
      } else {
        state.y -= 26;
      }
      state.page.drawLine({
        start: { x: MARGIN, y: state.y },
        end: { x: MARGIN + 200, y: state.y },
        thickness: 0.6,
        color: INK,
      });
      state.y -= 12;
      para(`${data.managerName ?? "Approving Manager"} — Approving Manager, RESSCOTT Limited`, {
        size: 9,
        font: bold,
      });
      gap(8);
      for (const o of officers) {
        ensure(16 + o.creds.length * 10);
        para(o.name, { size: 10, font: bold });
        para(o.title, { size: 9, font: bold, color: GREEN, gap: 2 });
        for (const c of o.creds) para(c, { size: 7.5, color: GREY, gap: 1 });
        gap(8);
      }
    };

    // ---------- letterhead variants ----------
    const drawCertHeader = () => {
      const lh = 24;
      const lw = (logo.width / logo.height) * lh;
      state.page.drawImage(logo, { x: MARGIN, y: PAGE_H - MARGIN - lh, width: lw, height: lh });
      state.page.drawText("INSPECTION REPORT", {
        x: MARGIN + lw + 14,
        y: PAGE_H - MARGIN - 13,
        size: 14,
        font: bold,
        color: INK,
      });
      state.page.drawText(`JOB #: ${ref}`, {
        x: MARGIN + lw + 14,
        y: PAGE_H - MARGIN - 27,
        size: 9,
        font,
        color: GREY,
      });
      state.page.drawLine({
        start: { x: MARGIN, y: PAGE_H - MARGIN - 40 },
        end: { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN - 40 },
        thickness: 1,
        color: GREEN,
      });
      state.y = PAGE_H - MARGIN - 54;
    };

    // ================= LETTER (Servus) =================
    if (isLetter) {
      // Letterhead (page 1 only)
      const lh = 44;
      const lw = (logo.width / logo.height) * lh;
      state.page.drawImage(logo, { x: MARGIN, y: PAGE_H - MARGIN - lh, width: lw, height: lh });
      let cy = PAGE_H - MARGIN - lh - 10;
      for (const ln of wrap(CONTACT, font, 8, CONTENT_W)) {
        state.page.drawText(ln, { x: MARGIN, y: cy, size: 8, font, color: GREY });
        cy -= 11;
      }
      state.page.drawLine({
        start: { x: MARGIN, y: cy - 2 },
        end: { x: PAGE_W - MARGIN, y: cy - 2 },
        thickness: 1.2,
        color: GREEN,
      });
      state.y = cy - 18;

      const client = (data.formValues["client_name"] as string) || data.label;
      const location = (data.formValues["client_location"] as string) || "—";

      para(`Date: ${fmtDate(data.submittedAt)}`, { size: 10, gap: 8 });
      para("Attn:", { font: bold, size: 10, gap: 2 });
      para(client, { size: 10, gap: 1 });
      para(location, { size: 10 });
      gap(6);
      para(`Site Visit Report — ${data.formLabel}`, { font: bold, size: 13 });

      heading("Introduction");
      para(
        `RESSCOTT LIMITED was engaged by the client to conduct a ${data.formLabel.toLowerCase()} at the above ` +
          `location. The purpose was to assess the facility (existing electrical loads, facilities and structures) ` +
          `to incorporate a suitable renewable-energy solution, reducing energy consumption and the client's carbon ` +
          `footprint. The observations and captured data are summarised below.`,
      );

      heading("Site Visit Notes");
      para(data.startNotes || "—");

      heading("Summary of Findings");
      fieldTable(data.fields);

      heading("Conclusion & Recommendations");
      const recs = (data.formValues["recommendations"] as string) || RECOMMENDATION_DEFAULT;
      para(recs);

      const photos: Array<{ m: Media; cap: string }> = [
        ...data.startMedia.map((m) => ({ m, cap: "Start of visit" })),
        ...data.attachments.map((m) => ({ m, cap: "Site photo" })),
        ...data.finalMedia.map((m) => ({ m, cap: "On completion" })),
      ];
      if (photos.length > 0) {
        heading("Photographic Evidence");
        for (const p of photos) await photoBlock(p.m, p.cap);
      }

      heading("Regards");
      signatures([OFFICERS[1]]); // Shamir Khan on the site-visit letter
    } else {
      // ================= CERTIFICATE (IR-RES) =================
      onNewPage = () => {
        state.page = pdf.addPage([PAGE_W, PAGE_H]);
        drawCertHeader();
      };
      drawCertHeader();

      para(CONTACT, { size: 8, color: GREY, gap: 8 });
      para(`SUBJECT: ${data.formLabel} — ${data.label}`, { font: bold, size: 11 });
      para(`CERTIFICATE #: ${ref}      DATE: ${fmtDate(data.submittedAt)}`, { size: 10, color: GREY });

      heading("Details");
      fieldTable([
        { label: "OCCUPIER", value: (data.formValues["client_name"] as string) || (data.formValues["client_site"] as string) || "--" },
        { label: "ADDRESS", value: (data.formValues["client_location"] as string) || (data.formValues["site_location"] as string) || "--" },
        { label: "DESCRIPTION", value: data.formLabel + ((data.formValues["system_type"] as string) ? ` — ${data.formValues["system_type"]}` : "") },
        { label: "LOCATION", value: "Same as occupier" },
        { label: "DATE OF EXAMINATION", value: fmtDate(data.submittedAt) },
        { label: "PREPARED BY", value: data.submitterUsername },
      ]);

      heading("Inspection");
      fieldTable(
        data.formFields.map((f) => {
          const raw = data.formValues[f.id];
          let value: string;
          if (f.type === "yesno") value = raw === true ? "Tested & OK" : raw === false ? "Faulty" : "N/A";
          else value = raw === undefined || raw === null || raw === "" ? "—" : String(raw);
          return { label: f.label, value };
        }),
      );

      heading("Job-Site Notes");
      para(data.startNotes || "—");

      const photos: Array<{ m: Media; cap: string }> = [
        ...data.startMedia.map((m) => ({ m, cap: "Start of job" })),
        ...data.attachments.map((m) => ({ m, cap: "Inspection photo" })),
        ...data.finalMedia.map((m) => ({ m, cap: "On completion" })),
      ];
      if (photos.length > 0) {
        heading("Photos");
        let n = 1;
        for (const p of photos) {
          await photoBlock(p.m, `Photo #${n}: ${p.cap}`);
          n++;
        }
      }

      heading("The Benefits To This Service");
      bullets(BENEFITS);
      heading("Limitations");
      bullets(["None"]);
      heading("Recommendations");
      bullets([(data.formValues["recommendations"] as string) || RECOMMENDATION_DEFAULT]);

      heading("Disclaimer & Declaration");
      para(DECLARATION, { size: 9 });
      gap(4);
      para("Terms and Conditions", { font: bold, size: 9 });
      para(TERMS, { size: 8, color: GREY });

      heading("Signed — call for verification");
      signatures(OFFICERS);

      // Per-page footer with running page numbers.
      const pages = pdf.getPages();
      pages.forEach((p, i) => {
        p.drawLine({
          start: { x: MARGIN, y: FOOTER_FLOOR - 8 },
          end: { x: PAGE_W - MARGIN, y: FOOTER_FLOOR - 8 },
          thickness: 0.4,
          color: LINE,
        });
        p.drawText("Doc #: SOW-001-0817-Rev 0", { x: MARGIN, y: FOOTER_FLOOR - 20, size: 8, font, color: GREY });
        const pn = `Page ${i + 1} of ${pages.length}`;
        p.drawText(pn, {
          x: PAGE_W - MARGIN - font.widthOfTextAtSize(pn, 8),
          y: FOOTER_FLOOR - 20,
          size: 8,
          font,
          color: GREY,
        });
      });
    }

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
