"use node";

import { GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { anyApi } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const responseJsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    definition: {
      type: "object",
      properties: {
        title: { type: "string" },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" }, title: { type: "string" }, note: { type: "string" }, media: { type: "boolean" },
              fields: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" }, label: { type: "string" },
                    type: { type: "string", enum: ["text", "textarea", "number", "yesno", "select", "multi_select", "time", "date", "heading", "instructions", "signature", "media", "file", "sketch", "table", "load_table"] },
                    required: { type: "boolean" }, options: { type: "array", items: { type: "string" } },
                    helpText: { type: "string" }, columns: { type: "array", items: { type: "string" } },
                  },
                  required: ["id", "label", "type", "required"],
                },
              },
            },
            required: ["id", "title", "fields"],
          },
        },
      },
      required: ["title", "sections"],
    },
  },
  required: ["summary", "definition"],
};

export const importOrRevise = action({
  args: {
    formId: v.id("forms"),
    prompt: v.string(),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ draftId: string; summary: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");
    const context: any = await ctx.runQuery(anyApi.formTemplates.getAiContext, { formId: args.formId, userId });
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
    if (!apiKey) {
      if (args.storageId) await ctx.storage.delete(args.storageId);
      throw new Error("Gemini is not configured. Set GEMINI_API_KEY in Convex.");
    }
    if (!args.prompt.trim()) throw new Error("Tell Gemini what form to create or change.");

    let filePart: { inlineData: { mimeType: string; data: string } } | null = null;
    let extractedWord = "";
    try {
      if (args.storageId) {
        const blob = await ctx.storage.get(args.storageId);
        if (!blob) throw new Error("Uploaded source file was not found.");
        if (blob.size > 20 * 1024 * 1024) throw new Error("Source files must be 20 MB or smaller.");
        const buffer = Buffer.from(await blob.arrayBuffer());
        const mime = args.mimeType ?? blob.type;
        if (mime === "application/pdf" || args.fileName?.toLowerCase().endsWith(".pdf")) {
          filePart = { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } };
        } else if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || args.fileName?.toLowerCase().endsWith(".docx")) {
          const extracted = await mammoth.convertToHtml({ buffer });
          extractedWord = extracted.value;
        } else {
          throw new Error("Upload a PDF or DOCX file. Legacy .doc files must be converted first.");
        }
      }

      const current = context.version?.definition ?? null;
      const history = context.messages.map((message: { role: string; text: string }) => `${message.role}: ${message.text}`).join("\n");
      const instruction = [
        "You are a form-building agent. Return a practical, responsive data-entry form, not a pixel canvas.",
        "Preserve the source's branding text, headings, instructions, field order, choices, tables, and page-section intent.",
        "Use concise snake_case IDs unique across the whole form. Never publish; only propose an editable draft.",
        `User request: ${args.prompt.trim()}`,
        current ? `Current editable definition:\n${JSON.stringify(current)}` : "",
        history ? `Recent conversation:\n${history}` : "",
        extractedWord ? `Extracted DOCX HTML:\n${extractedWord.slice(0, 200000)}` : "",
      ].filter(Boolean).join("\n\n");

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model,
        contents: filePart ? [filePart, { text: instruction }] : instruction,
        config: { responseMimeType: "application/json", responseJsonSchema },
      });
      if (!response.text) throw new Error("Gemini returned an empty response.");
      const parsed = JSON.parse(response.text) as { summary: string; definition: unknown };
      const draftId: string = await ctx.runMutation(anyApi.formTemplates.applyAiDraft, {
        formId: args.formId, userId, prompt: args.prompt.trim(), summary: parsed.summary,
        definition: parsed.definition as never,
      });
      return { draftId, summary: parsed.summary };
    } finally {
      if (args.storageId) await ctx.storage.delete(args.storageId);
    }
  },
});
