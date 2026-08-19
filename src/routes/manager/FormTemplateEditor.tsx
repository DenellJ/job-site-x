import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import type { EditableFormDefinition, FormFieldDef, FormFieldType } from "../../../convex/formDefs";
import { FormRenderer } from "../../components/FormRenderer";

const api = anyApi;

const BLOCK_TYPES: Array<{ value: FormFieldType; label: string }> = [
  ["text", "Short text"], ["textarea", "Long text"], ["number", "Number"], ["date", "Date"],
  ["time", "Time"], ["yesno", "Yes / No"], ["select", "Single choice"], ["multi_select", "Multiple choice"],
  ["heading", "Heading"], ["instructions", "Instructions"], ["signature", "Signature"], ["media", "Photos / video"],
  ["file", "File upload"], ["sketch", "Sketch"], ["table", "Table"], ["load_table", "Solar load table"],
].map(([value, label]) => ({ value: value as FormFieldType, label }));

function id(prefix: string) { return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`; }

export default function FormTemplateEditor() {
  const { id: routeId } = useParams<{ id: string }>();
  const formId = routeId as Id<"forms">;
  const detail = useQuery(api.formTemplates.getEditor, { formId });
  const ensureDraft = useMutation(api.formTemplates.ensureDraft);
  const saveDraft = useMutation(api.formTemplates.saveDraft);
  const publish = useMutation(api.formTemplates.publish);
  const uploadUrl = useMutation(api.storage.generateFormImportUploadUrl);
  const importForm = useAction(api.formImport.importOrRevise);
  const [definition, setDefinition] = useState<EditableFormDefinition | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [locked, setLocked] = useState(true);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const version = detail?.draft ?? detail?.published;
    if (version && definition === null) {
      setDefinition(version.definition as EditableFormDefinition);
      setRevision(detail?.draft?.revision ?? null);
    }
  }, [detail, definition]);

  if (detail === undefined) return <p>Loading…</p>;
  if (detail === null) return <div className="card text-err">Form not found.</div>;
  if (!definition) return <p>Loading definition…</p>;

  const hasDraft = Boolean(detail.draft);
  function change(next: EditableFormDefinition) { setDefinition(next); setMessage(null); }
  function updateSection(index: number, patch: Partial<EditableFormDefinition["sections"][number]>) {
    change({ ...definition!, sections: definition!.sections.map((section, i) => i === index ? { ...section, ...patch } : section) });
  }
  function updateField(sectionIndex: number, fieldIndex: number, patch: Partial<FormFieldDef>) {
    const section = definition!.sections[sectionIndex];
    updateSection(sectionIndex, { fields: section.fields.map((field, i) => i === fieldIndex ? { ...field, ...patch } : field) });
  }
  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction; if (target < 0 || target >= definition!.sections.length) return;
    const sections = [...definition!.sections]; [sections[index], sections[target]] = [sections[target], sections[index]]; change({ ...definition!, sections });
  }
  function moveField(sectionIndex: number, fieldIndex: number, direction: -1 | 1) {
    const fields = [...definition!.sections[sectionIndex].fields]; const target = fieldIndex + direction;
    if (target < 0 || target >= fields.length) return; [fields[fieldIndex], fields[target]] = [fields[target], fields[fieldIndex]];
    updateSection(sectionIndex, { fields });
  }
  function moveFieldToSection(sectionIndex: number, fieldIndex: number, targetSectionIndex: number) {
    if (sectionIndex === targetSectionIndex) return;
    const sections = definition!.sections.map((section) => ({ ...section, fields: [...section.fields] }));
    const [field] = sections[sectionIndex].fields.splice(fieldIndex, 1);
    sections[targetSectionIndex].fields.push(field);
    change({ ...definition!, sections });
  }
  async function openDraft() { setBusy(true); try { await ensureDraft({ formId }); setDefinition(null); } finally { setBusy(false); } }
  async function save() {
    if (revision === null) return false;
    setBusy(true); setError(null);
    try { const next = await saveDraft({ formId, definition, expectedRevision: revision }); setRevision(next); setMessage("Draft saved."); return true; }
    catch (e: any) { setError(e.message ?? "Save failed."); return false; } finally { setBusy(false); }
  }
  async function publishNow() {
    setBusy(true); setError(null);
    try { if (revision !== null && !(await save())) return; await publish({ formId }); setMessage("Published. New jobs will use this version."); setDefinition(null); }
    catch (e: any) { setError(e.message ?? "Publish failed."); } finally { setBusy(false); }
  }
  async function askGemini() {
    if (!prompt.trim()) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      let storageId: Id<"_storage"> | undefined;
      if (file) {
        const url = await uploadUrl();
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!response.ok) throw new Error("Source upload failed.");
        storageId = (await response.json()).storageId as Id<"_storage">;
      }
      const result = await importForm({ formId, prompt, storageId, fileName: file?.name, mimeType: file?.type });
      setMessage(result.summary); setPrompt(""); setFile(null); setDefinition(null);
    } catch (e: any) { setError(e.message ?? "Gemini import failed."); } finally { setBusy(false); }
  }

  if (!hasDraft) return <div className="space-y-5">
    <Link to="/manager/form-builder" className="text-xs font-black uppercase underline">← Forms</Link>
    <div className="card space-y-3"><h1 className="text-2xl font-black uppercase">{detail.form.title}</h1><p className="text-sm text-rebar">Published version {detail.published?.version}. Create a draft to make changes safely.</p><button className="btn-accent" disabled={busy} onClick={() => void openDraft()}>Edit as new draft</button></div>
  </div>;

  return <div className="space-y-5">
    <div className="flex justify-between gap-3 flex-wrap">
      <div><Link to="/manager/form-builder" className="text-xs font-black uppercase underline">← Forms</Link><h1 className="text-3xl font-black uppercase mt-1">{definition.title}</h1><p className="text-xs text-rebar">Unpublished draft · revision {revision}</p></div>
      <div className="flex gap-2 flex-wrap">
        <button className={`btn ${locked ? "bg-ink text-white" : "bg-hi text-ink"}`} onClick={() => setLocked(!locked)}>{locked ? "🔒 Locked · edit text" : "🔓 Unlocked · move blocks"}</button>
        <button className="btn-ghost" onClick={() => setPreview(!preview)}>{preview ? "Back to editor" : "Preview"}</button>
        <button className="btn-ghost" disabled={busy} onClick={() => void save()}>Save draft</button>
        <button className="btn-accent" disabled={busy} onClick={() => void publishNow()}>Publish</button>
      </div>
    </div>
    {error && <p className="text-err text-sm font-bold">{error}</p>}{message && <p className="text-ok text-sm font-bold">{message}</p>}

    <div className="card space-y-3 border-l-4 border-l-hi2">
      <h2 className="section-title">Gemini form agent</h2>
      <p className="text-sm text-rebar">Attach a PDF or DOCX, or ask Gemini to revise this draft. The source file is deleted after processing.</p>
      <input className="input" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <textarea className="input" rows={3} placeholder="Example: Make an editable form like the attached document and preserve its sections and tables." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <button className="btn-accent w-full" disabled={busy || !prompt.trim()} onClick={() => void askGemini()}>{busy ? "Gemini is working…" : "Ask Gemini"}</button>
      {detail.messages.length > 0 && <div className="space-y-2 pt-2 border-t border-stone-200">{detail.messages.map((item: any) => <div key={item._id} className={`text-sm rounded p-2 ${item.role === "user" ? "bg-stone-100" : "bg-hi/30"}`}><strong>{item.role === "user" ? "You" : "Gemini"}:</strong> {item.text}</div>)}</div>}
    </div>

    {preview ? <FormRenderer sections={definition.sections} values={{}} onChange={() => {}} attachments={[]} onAttachmentsChange={() => {}} /> : <>
      <div className="card space-y-3">
        <label className="label">Form title</label><input className="input" disabled={!locked} value={definition.title} onChange={(e) => change({ ...definition, title: e.target.value })} />
      </div>
      <div className="space-y-4">
        {definition.sections.map((section, sectionIndex) => <div key={section.id} className="card space-y-3 border-l-4 border-l-ink">
          <div className="flex gap-2 items-center">
            {locked ? <input className="input font-black" value={section.title} onChange={(e) => updateSection(sectionIndex, { title: e.target.value })} /> : <span className="font-black flex-1">↕ {section.title}</span>}
            {!locked && <><button className="btn-ghost" onClick={() => moveSection(sectionIndex, -1)}>↑</button><button className="btn-ghost" onClick={() => moveSection(sectionIndex, 1)}>↓</button></>}
            {locked && <button className="text-err font-bold" onClick={() => change({ ...definition, sections: definition.sections.filter((_, i) => i !== sectionIndex) })}>Remove</button>}
          </div>
          {locked && <textarea className="input" rows={2} placeholder="Section note (optional)" value={section.note ?? ""} onChange={(e) => updateSection(sectionIndex, { note: e.target.value || undefined })} />}
          <div className="space-y-2">
            {section.fields.map((field, fieldIndex) => <div key={field.id} className="rounded-lg border border-stone-200 p-3 bg-stone-50">
              {locked ? <div className="grid sm:grid-cols-[1fr_190px] gap-2">
                <input className="input" value={field.label} onChange={(e) => updateField(sectionIndex, fieldIndex, { label: e.target.value })} />
                <select className="input" value={field.type} onChange={(e) => updateField(sectionIndex, fieldIndex, { type: e.target.value as FormFieldType })}>{BLOCK_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
                <input className="input" placeholder="Help text" value={field.helpText ?? ""} onChange={(e) => updateField(sectionIndex, fieldIndex, { helpText: e.target.value || undefined })} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={(e) => updateField(sectionIndex, fieldIndex, { required: e.target.checked })} /> Required</label>
                {(field.type === "select" || field.type === "multi_select") && <input className="input sm:col-span-2" placeholder="Options, separated by commas" value={(field.options ?? []).join(", ")} onChange={(e) => updateField(sectionIndex, fieldIndex, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />}
                {field.type === "table" && <input className="input sm:col-span-2" placeholder="Table columns, separated by commas" value={(field.columns ?? []).join(", ")} onChange={(e) => updateField(sectionIndex, fieldIndex, { columns: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />}
                <button className="text-err text-sm font-bold text-left" onClick={() => updateSection(sectionIndex, { fields: section.fields.filter((_, i) => i !== fieldIndex) })}>Remove block</button>
              </div> : <div className="flex items-center gap-2 flex-wrap"><span className="flex-1 font-semibold">↕ {field.label} <span className="text-xs text-rebar">({field.type})</span></span><select className="input !w-auto" aria-label="Move block to section" value={sectionIndex} onChange={(e) => moveFieldToSection(sectionIndex, fieldIndex, Number(e.target.value))}>{definition.sections.map((target, index) => <option key={target.id} value={index}>{target.title}</option>)}</select><button className="btn-ghost" onClick={() => moveField(sectionIndex, fieldIndex, -1)}>↑</button><button className="btn-ghost" onClick={() => moveField(sectionIndex, fieldIndex, 1)}>↓</button></div>}
            </div>)}
          </div>
          {locked && <button className="btn-ghost w-full" onClick={() => updateSection(sectionIndex, { fields: [...section.fields, { id: id("field"), label: "New field", type: "text", required: false }] })}>+ Add block</button>}
        </div>)}
      </div>
      {locked && <button className="btn-ghost w-full" onClick={() => change({ ...definition, sections: [...definition.sections, { id: id("section"), title: "New section", fields: [] }] })}>+ Add section</button>}
    </>}


  </div>;
}
