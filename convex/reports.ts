"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import type { Id } from "./_generated/dataModel";
import { RESSCOTT_LOGO_PNG_BASE64 } from "./resscottLogo";
import { getFormDef, isSiteVisit, type FormType } from "./formDefs";
import { buildSiteVisitDocx, type DocImage, type DocPhoto } from "./wordReport";

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_FLOOR = MARGIN + 22;
const DOCX_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const GREEN = rgb(0.353, 0.655, 0.18);
const INK = rgb(0.1, 0.09, 0.08);
const GREY = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.8, 0.8, 0.78);

const CONTACT =
  "Office Address: #500 Munroe, Charlieville, Trinidad WI.   Tel: +1 868 688-9950, +1 868 366-2471   Email: renewable-energy@resscott.com   Website: www.resscott.com";

const BENEFITS = [
  "Repairs are made to manufacturer specifications, or a change-out is done.",
  "Maintains the equipment integrity.",
  "Complies with Manufacturer / OSHA regulations.",
  "Maintains warranty.",
  "All work done is stated on a service certificate and used for history.",
];
const DECLARATION =
  "I ______________________________________________________ accept the product of RESSCOTT Limited in good working condition. All components and fire-safe elements were identified to me and I agree to the terms and conditions of this product.";
const TERMS =
  "The RESSCOTT company keeps detailed inspection photos and reports in-house to identify any tamper or alterations that may be observed; the said report will be used as a comparison during inspection. The Client/user must operate the product within its specifications and standard operating procedure (SOP). The product is not to be used outside its specifications or SOP so as not to hinder safety or compromise any fire-safe elements or warranty. All components are designed to the specific needs of the client and shall not be altered in any form or fashion; alterations done by the client can lead to failure and immediately void the warranty and trade name of the supplier. Clients are advised to review their documentation before acceptance of our products/services, as RESSCOTT Limited is not responsible for any discrepancies thereafter. Mobilization and technicians' fees must be charged when items under warranty are to be changed out. RESSCOTT Ltd can provide virtual diagnostic services. Any defects noted — the equipment can be changed out in accordance with its warranty period.";
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

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function fmtDate(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}
function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function imgType(bytes: Uint8Array): "png" | "jpg" {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 ? "png" : "jpg";
}
function display(v: string | number | boolean | undefined): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  const s = String(v);
  return s.trim() === "" ? "—" : s;
}

export const convert = action({
  args: { submissionId: v.id("formSubmissions") },
  handler: async (ctx, { submissionId }): Promise<{ reportVersion: number; url: string | null }> => {
    const data = await ctx.runQuery(internal.reportData.getForReport, { submissionId });
    const formType = data.formType as FormType;
    const def = getFormDef(formType);
    const values = data.formValues as Record<string, string | number | boolean>;

    const fetchBytes = async (storageId: string): Promise<Uint8Array | null> => {
      const blob = await ctx.storage.get(storageId as Id<"_storage">);
      if (!blob) return null;
      return new Uint8Array(await blob.arrayBuffer());
    };

    // Manager's drawn signature (present once approved).
    let mgrSigBytes: Uint8Array | null = null;
    if (data.managerSignatureId) mgrSigBytes = await fetchBytes(data.managerSignatureId as string);

    // All captured photos, in order, with captions.
    const mediaList = [
      ...data.startMedia.map((m) => ({ ...m, group: "Start of job" })),
      ...data.attachments.map((m) => ({ ...m, group: "Site photo" })),
      ...data.finalMedia.map((m) => ({ ...m, group: "On completion" })),
    ];

    let storageId: Id<"_storage">;

    if (isSiteVisit(formType)) {
      // ---------------- Word (Servus letter) ----------------
      const photos: DocPhoto[] = [];
      let n = 1;
      for (const m of mediaList) {
        if (m.kind === "video") continue;
        const bytes = await fetchBytes(m.storageId);
        if (!bytes) continue;
        photos.push({ bytes, type: imgType(bytes), caption: `Photo ${n++}: ${m.group}${m.caption ? ` — ${m.caption}` : ""}` });
      }
      // The site sketch is an inline PNG data URL — decode it into image bytes.
      let sketchImg: DocImage | null = null;
      if (data.sketch) {
        const comma = data.sketch.indexOf(",");
        if (comma !== -1) sketchImg = { bytes: b64ToBytes(data.sketch.slice(comma + 1)), type: "png" };
      }
      const b64 = await buildSiteVisitDocx(
        {
          formLabel: data.formLabel,
          label: data.label,
          submittedAt: data.submittedAt,
          client: (values["client_name"] as string) || data.label,
          location: (values["client_location"] as string) || "—",
          startNotes: data.startNotes,
          recommendations: (values["additional_notes"] as string) || data.startNotes || "—",
          fields: data.fields,
          managerName: data.managerName,
        },
        { bytes: b64ToBytes(RESSCOTT_LOGO_PNG_BASE64), type: "png" },
        mgrSigBytes ? { bytes: mgrSigBytes, type: imgType(mgrSigBytes) } : null,
        photos,
        sketchImg,
      );
      storageId = await ctx.storage.store(new Blob([b64ToBytes(b64)], { type: DOCX_CT }));
    } else {
      // ---------------- PDF (pdf-lib) ----------------
      const certificate = formType === "job_inspection";
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
      const logo = await pdf.embedPng(RESSCOTT_LOGO_PNG_BASE64);
      let mgrSig: PDFImage | null = null;
      if (mgrSigBytes) {
        try {
          mgrSig = imgType(mgrSigBytes) === "png" ? await pdf.embedPng(mgrSigBytes) : await pdf.embedJpg(mgrSigBytes);
        } catch {
          mgrSig = null;
        }
      }
      const ref = `IR-RES${fmtDate(data.submittedAt).replace(/\//g, "")}-${String(submissionId).slice(-4).toUpperCase()}`;

      const state = { page: pdf.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN };
      const wrap = (t: string, f: PDFFont, size: number, maxW: number): string[] => {
        const out: string[] = [];
        for (const raw of (t || "").split("\n")) {
          const words = raw.split(/\s+/).filter(Boolean);
          if (words.length === 0) {
            out.push("");
            continue;
          }
          let ln = "";
          for (const w of words) {
            const cand = ln ? `${ln} ${w}` : w;
            if (f.widthOfTextAtSize(cand, size) > maxW && ln) {
              out.push(ln);
              ln = w;
            } else ln = cand;
          }
          if (ln) out.push(ln);
        }
        return out;
      };

      const certHeader = () => {
        const lh = 24;
        const lw = (logo.width / logo.height) * lh;
        state.page.drawImage(logo, { x: MARGIN, y: PAGE_H - MARGIN - lh, width: lw, height: lh });
        state.page.drawText("INSPECTION REPORT", { x: MARGIN + lw + 14, y: PAGE_H - MARGIN - 13, size: 14, font: bold, color: INK });
        state.page.drawText(`JOB #: ${ref}`, { x: MARGIN + lw + 14, y: PAGE_H - MARGIN - 27, size: 9, font, color: GREY });
        state.page.drawLine({ start: { x: MARGIN, y: PAGE_H - MARGIN - 40 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN - 40 }, thickness: 1, color: GREEN });
        state.y = PAGE_H - MARGIN - 54;
      };
      let onNewPage = () => {
        state.page = pdf.addPage([PAGE_W, PAGE_H]);
        state.y = PAGE_H - MARGIN;
      };
      const ensure = (need: number) => {
        if (state.y - need < FOOTER_FLOOR) onNewPage();
      };
      const para = (content: string, o: { size?: number; font?: PDFFont; color?: RGB; gap?: number; indent?: number } = {}) => {
        const size = o.size ?? 10.5;
        const f = o.font ?? font;
        const indent = o.indent ?? 0;
        for (const ln of wrap(content, f, size, CONTENT_W - indent)) {
          ensure(size + 4);
          state.page.drawText(ln, { x: MARGIN + indent, y: state.y - size, size, font: f, color: o.color ?? INK });
          state.y -= size + (o.gap ?? 4);
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
        state.page.drawLine({ start: { x: MARGIN, y: state.y }, end: { x: PAGE_W - MARGIN, y: state.y }, thickness: 1, color: GREEN });
        state.y -= 10;
      };
      const bullets = (items: string[]) => {
        for (const it of items)
          for (const [i, ln] of wrap(it, font, 10, CONTENT_W - 16).entries()) {
            ensure(14);
            if (i === 0) state.page.drawText("•", { x: MARGIN + 2, y: state.y - 10, size: 10, font, color: GREEN });
            state.page.drawText(ln, { x: MARGIN + 16, y: state.y - 10, size: 10, font, color: INK });
            state.y -= 13;
          }
      };
      const kvTable = (rows: { label: string; value: string }[]) => {
        const labelW = CONTENT_W * 0.4;
        for (const r of rows) {
          const lL = wrap(r.label, bold, 9, labelW - 6);
          const vL = wrap(r.value || "—", font, 9, CONTENT_W - labelW - 8);
          const rowH = Math.max(lL.length, vL.length) * 11 + 6;
          ensure(rowH);
          const top = state.y;
          lL.forEach((ln, i) => state.page.drawText(ln, { x: MARGIN + 2, y: top - 11 - i * 11, size: 9, font: bold, color: INK }));
          vL.forEach((ln, i) => state.page.drawText(ln, { x: MARGIN + labelW + 6, y: top - 11 - i * 11, size: 9, font, color: INK }));
          state.y = top - rowH;
          state.page.drawLine({ start: { x: MARGIN, y: state.y + 2 }, end: { x: PAGE_W - MARGIN, y: state.y + 2 }, thickness: 0.4, color: LINE });
        }
      };
      const componentTable = (rows: { label: string; status: string; comment: string }[]) => {
        const c1 = MARGIN + 2;
        const c2 = MARGIN + CONTENT_W * 0.42;
        const c3 = MARGIN + CONTENT_W * 0.62;
        ensure(16);
        state.page.drawText("Component", { x: c1, y: state.y - 10, size: 8, font: bold, color: GREY });
        state.page.drawText("Status", { x: c2, y: state.y - 10, size: 8, font: bold, color: GREY });
        state.page.drawText("Comments", { x: c3, y: state.y - 10, size: 8, font: bold, color: GREY });
        state.y -= 14;
        for (const r of rows) {
          const lL = wrap(r.label, font, 8.5, CONTENT_W * 0.4);
          const cL = wrap(r.comment || "—", font, 8.5, CONTENT_W * 0.36);
          const rowH = Math.max(lL.length, cL.length, 1) * 10 + 5;
          ensure(rowH);
          const top = state.y;
          lL.forEach((ln, i) => state.page.drawText(ln, { x: c1, y: top - 9 - i * 10, size: 8.5, font, color: INK }));
          state.page.drawText(r.status || "—", { x: c2, y: top - 9, size: 8.5, font: bold, color: INK });
          cL.forEach((ln, i) => state.page.drawText(ln, { x: c3, y: top - 9 - i * 10, size: 8.5, font, color: INK }));
          state.y = top - rowH;
          state.page.drawLine({ start: { x: MARGIN, y: state.y + 2 }, end: { x: PAGE_W - MARGIN, y: state.y + 2 }, thickness: 0.3, color: LINE });
        }
      };
      const photoBlock = async (storageIdStr: string, kind: string, caption: string) => {
        if (kind === "video") {
          ensure(14);
          para(`${caption} — video evidence attached`, { size: 9, color: GREY });
          return;
        }
        const bytes = await fetchBytes(storageIdStr);
        if (!bytes) return;
        let img: PDFImage;
        try {
          img = imgType(bytes) === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        } catch {
          return;
        }
        const scale = Math.min(CONTENT_W / img.width, 340 / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        ensure(h + 16);
        state.page.drawImage(img, { x: MARGIN, y: state.y - h, width: w, height: h });
        state.y -= h + 3;
        state.page.drawText(caption, { x: MARGIN, y: state.y - 9, size: 8, font: italic, color: GREY });
        state.y -= 15;
      };
      const signatures = (officers: typeof OFFICERS) => {
        gap(6);
        ensure(60 + officers.length * 50);
        if (mgrSig) {
          const sh = 38;
          const sw = Math.min(mgrSig.width * (sh / mgrSig.height), 200);
          state.page.drawImage(mgrSig, { x: MARGIN, y: state.y - sh, width: sw, height: sh });
          state.y -= sh + 2;
        } else gap(26);
        state.page.drawLine({ start: { x: MARGIN, y: state.y }, end: { x: MARGIN + 200, y: state.y }, thickness: 0.6, color: INK });
        state.y -= 12;
        para(`${data.managerName ?? "Approving Manager"} — Approving Manager, RESSCOTT Limited`, { size: 9, font: bold });
        gap(8);
        for (const o of officers) {
          ensure(16 + o.creds.length * 10);
          para(o.name, { size: 10, font: bold });
          para(o.title, { size: 9, font: bold, color: GREEN, gap: 2 });
          for (const c of o.creds) para(c, { size: 7.5, color: GREY, gap: 1 });
          gap(8);
        }
      };

      // ---- header + meta ----
      if (certificate) {
        onNewPage = () => {
          state.page = pdf.addPage([PAGE_W, PAGE_H]);
          certHeader();
        };
        certHeader();
        para(CONTACT, { size: 8, color: GREY, gap: 8 });
        para(`SUBJECT: ${data.formLabel} — ${data.label}`, { font: bold, size: 11 });
        para(`CERTIFICATE #: ${ref}      DATE: ${fmtDate(data.submittedAt)}`, { size: 10, color: GREY });
      } else {
        const lh = 30;
        const lw = (logo.width / logo.height) * lh;
        state.page.drawImage(logo, { x: MARGIN, y: PAGE_H - MARGIN - lh, width: lw, height: lh });
        state.page.drawText(data.formLabel, { x: MARGIN + lw + 14, y: PAGE_H - MARGIN - 20, size: 16, font: bold, color: INK });
        state.page.drawLine({ start: { x: MARGIN, y: PAGE_H - MARGIN - 44 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN - 44 }, thickness: 1, color: GREEN });
        state.y = PAGE_H - MARGIN - 58;
        para(CONTACT, { size: 8, color: GREY, gap: 6 });
        para(`${data.label}      Date: ${fmtDate(data.submittedAt)}      Prepared by: ${data.submitterUsername}`, { size: 10, color: GREY });
      }

      // ---- sections, driven by the form definition ----
      for (const section of def.sections) {
        if (section.media) {
          if (mediaList.length === 0) continue;
          heading(section.title);
          let n = 1;
          for (const m of mediaList) await photoBlock(m.storageId, m.kind, `Photo #${n++}: ${m.group}${m.caption ? ` — ${m.caption}` : ""}`);
          continue;
        }
        // split into component pairs (status + comment) and plain fields
        const pairs: { label: string; status: string; comment: string }[] = [];
        const plain: { label: string; value: string }[] = [];
        const consumed = new Set<string>();
        for (const f of section.fields) {
          if (consumed.has(f.id)) continue;
          if (f.id.endsWith("_status")) {
            const base = f.id.slice(0, -"_status".length);
            const commentId = `${base}_comment`;
            consumed.add(commentId);
            pairs.push({ label: f.label, status: display(values[f.id]), comment: display(values[commentId]) });
          } else {
            plain.push({ label: f.label, value: display(values[f.id]) });
          }
        }
        heading(section.title);
        if (plain.length) kvTable(plain);
        if (pairs.length) componentTable(pairs);
      }

      // ---- certificate boilerplate + signatories ----
      if (certificate) {
        heading("The Benefits To This Service");
        bullets(BENEFITS);
        heading("Limitations");
        bullets(["None"]);
        heading("Disclaimer & Declaration");
        para(DECLARATION, { size: 9 });
        gap(4);
        para("Terms and Conditions", { font: bold, size: 9 });
        para(TERMS, { size: 8, color: GREY });
        heading("Signed — call for verification");
        signatures(OFFICERS);
      } else {
        heading("Sign-off");
        signatures([]);
      }

      // ---- footer + running page numbers (certificate only) ----
      if (certificate) {
        const pages = pdf.getPages();
        pages.forEach((p, i) => {
          p.drawLine({ start: { x: MARGIN, y: FOOTER_FLOOR - 8 }, end: { x: PAGE_W - MARGIN, y: FOOTER_FLOOR - 8 }, thickness: 0.4, color: LINE });
          p.drawText("Doc #: SOW-001-0817-Rev 0", { x: MARGIN, y: FOOTER_FLOOR - 20, size: 8, font, color: GREY });
          const pn = `Page ${i + 1} of ${pages.length}`;
          p.drawText(pn, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(pn, 8), y: FOOTER_FLOOR - 20, size: 8, font, color: GREY });
        });
      }

      const pdfBytes = await pdf.save();
      storageId = await ctx.storage.store(new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }));
    }

    const reportVersion: number = await ctx.runMutation(internal.reportData.saveReport, {
      submissionId,
      reportStorageId: storageId,
    });
    const url = await ctx.storage.getUrl(storageId);
    return { reportVersion, url };
  },
});
