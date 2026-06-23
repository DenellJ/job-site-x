"use node";
/**
 * Builds the amendable Site Visit Report (Servus format) as a Word .docx,
 * returned as a base64 string. Plain Node module used by the `reports.convert`
 * action. No Convex APIs here.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

type ImgType = "png" | "jpg";
export interface DocImage {
  bytes: Uint8Array;
  type: ImgType;
}
export interface DocPhoto extends DocImage {
  caption: string;
}

export interface SiteVisitDocData {
  formLabel: string;
  label: string;
  submittedAt: number;
  client: string;
  location: string;
  startNotes: string;
  recommendations: string;
  fields: { label: string; value: string }[];
  managerName: string | null;
}

const GREEN = "47861f";
const GREY = "6b7280";
const INK = "1c1917";

const CONTACT = [
  "Office Address: #500 Munroe, Charlieville, Trinidad WI.",
  "Tel: +1 868 688-9950, +1 868 366-2471",
  "Email: renewable-energy@resscott.com   ·   Website: www.resscott.com",
];

const SHAMIR = [
  { text: "SHAMIR KHAN", bold: true },
  { text: "OPERATIONS DIRECTOR", color: GREEN, bold: true },
  { text: "BSc. Mechanical Engineering (UWI) · QA/QC Inspector" },
  { text: "Certified CWI Inspector, NACE, ASNT Level II, API 510 Inspector" },
  { text: "Metallographic Interpretation (ASM International) · Failure Analysis Consultant" },
];

function imageSize(bytes: Uint8Array, type: ImgType): { w: number; h: number } {
  try {
    if (type === "png") {
      const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      if (w > 0 && h > 0) return { w, h };
    } else {
      let i = 2;
      while (i < bytes.length - 8) {
        if (bytes[i] !== 0xff) {
          i++;
          continue;
        }
        const m = bytes[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          const h = (bytes[i + 5] << 8) | bytes[i + 6];
          const w = (bytes[i + 7] << 8) | bytes[i + 8];
          if (w > 0 && h > 0) return { w, h };
        }
        i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
      }
    }
  } catch {
    /* fall through */
  }
  return { w: 600, h: 400 };
}

function imagePara(img: DocImage, maxW: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) {
  const { w, h } = imageSize(img.bytes, img.type);
  const scale = Math.min(maxW / w, 1);
  return new Paragraph({
    alignment: align,
    children: [
      new ImageRun({
        type: img.type,
        data: img.bytes,
        transformation: { width: Math.round(w * scale), height: Math.round(h * scale) },
      }),
    ],
  });
}

function line(text: string, opts: { bold?: boolean; size?: number; color?: string; gapAfter?: number } = {}) {
  return new Paragraph({
    spacing: { after: opts.gapAfter ?? 80 },
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 21, color: opts.color ?? INK })],
  });
}

function heading(text: string) {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN } },
    children: [new TextRun({ text, bold: true, size: 24, color: GREEN })],
  });
}

function kvTable(rows: { label: string; value: string }[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (r) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 38, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text: r.label, bold: true, size: 18 })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: r.value || "—", size: 18 })] })],
            }),
          ],
        }),
    ),
  });
}

export async function buildSiteVisitDocx(
  data: SiteVisitDocData,
  logo: DocImage,
  mgrSig: DocImage | null,
  photos: DocPhoto[],
  sketch: DocImage | null = null,
): Promise<string> {
  const date = new Date(data.submittedAt).toLocaleDateString();
  const children: (Paragraph | Table)[] = [];

  // Letterhead
  children.push(imagePara(logo, 240));
  for (const c of CONTACT) children.push(line(c, { size: 16, color: GREY, gapAfter: 20 }));
  children.push(
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GREEN } }, spacing: { after: 160 }, children: [] }),
  );

  children.push(line(`Date: ${date}`, { gapAfter: 160 }));
  children.push(line("Attn:", { bold: true, gapAfter: 20 }));
  children.push(line(data.client, { gapAfter: 20 }));
  children.push(line(data.location, { gapAfter: 160 }));
  children.push(line(`Site Visit Report — ${data.formLabel}`, { bold: true, size: 26, gapAfter: 120 }));

  children.push(heading("Introduction"));
  children.push(
    line(
      `RESSCOTT LIMITED was engaged by the client to conduct a ${data.formLabel.toLowerCase()} at the above location. ` +
        `The purpose was to assess the facility (existing electrical loads, facilities and structures) to incorporate a ` +
        `suitable renewable-energy solution, reducing the client's energy consumption and carbon footprint. The observations ` +
        `and captured data are summarised below.`,
    ),
  );

  children.push(heading("Proposal Summary"));
  children.push(
    kvTable([
      { label: "Project Number", value: "TBD" },
      { label: "Description", value: `${data.formLabel}${data.client ? ` — ${data.client}` : ""}` },
      { label: "Monthly Carbon Reduction (Kg CO₂)", value: "TBD" },
      { label: "Quotation Number", value: "TBD" },
      { label: "Cost (TTD)", value: "TBD" },
      { label: "Justification", value: "TBD" },
    ]),
  );
  children.push(line("(Complete the proposal figures above before issuing to the client.)", { size: 15, color: GREY, gapAfter: 120 }));

  children.push(heading("Summary of Findings"));
  children.push(kvTable(data.fields));

  if (sketch) {
    children.push(heading("Site Sketch"));
    children.push(imagePara(sketch, 420));
  }

  children.push(heading("Site Visit Notes"));
  children.push(line(data.startNotes || "—"));

  children.push(heading("Conclusion & Recommendations"));
  children.push(line(data.recommendations || "—"));

  if (photos.length > 0) {
    children.push(heading("Photographic Evidence"));
    for (const ph of photos) {
      children.push(imagePara(ph, 420));
      children.push(line(ph.caption, { size: 15, color: GREY, gapAfter: 120 }));
    }
  }

  children.push(heading("Regards"));
  if (mgrSig) children.push(imagePara(mgrSig, 180));
  children.push(line(`${data.managerName ?? "Approving Manager"} — Approving Manager, RESSCOTT Limited`, { bold: true, gapAfter: 160 }));
  for (const s of SHAMIR) {
    children.push(
      new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: s.text, bold: s.bold, color: s.color ?? GREY, size: s.bold ? 20 : 15 })],
      }),
    );
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBase64String(doc);
}
