import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";

const api = anyApi;

export default function FormTemplates() {
  const forms = useQuery(api.formTemplates.listForManagement);
  const initialize = useMutation(api.formTemplates.initializeDefaults);
  const create = useMutation(api.formTemplates.createFromInspection);
  const setArchived = useMutation(api.formTemplates.setArchived);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (forms?.length === 0) void initialize();
  }, [forms, initialize]);

  async function createForm() {
    setBusy(true); setErr(null);
    try {
      const formId = await create({ title: title.trim() || "New inspection form" });
      navigate(`/manager/form-builder/${formId}`);
    } catch (error: any) { setErr(error.message ?? "Could not create form."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <div>
      <h1 className="text-3xl font-black uppercase tracking-tight">Forms</h1>
      <p className="text-sm text-rebar mt-1">Create from Inspection, edit drafts, publish versions, or ask Gemini to build one from a document.</p>
    </div>
    <div className="card space-y-3">
      <h2 className="section-title">Create a form</h2>
      <p className="text-sm text-rebar">Every new form starts as an unpublished copy of the Inspection template.</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input className="input flex-1" placeholder="Form name" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn-accent" disabled={busy} onClick={() => void createForm()}>{busy ? "Creating…" : "+ New form"}</button>
      </div>
      {err && <p className="text-err text-sm font-bold">{err}</p>}
    </div>
    {forms === undefined ? <p>Loading…</p> : <div className="space-y-3">
      {forms.map((form: any) => <div key={form._id} className="card flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex gap-2 items-center flex-wrap">
            <h2 className="font-black uppercase tracking-tight">{form.title}</h2>
            <span className={`pill ${form.status === "archived" ? "bg-stone-200" : "bg-hi"}`}>{form.status}</span>
            {form.draftRevision !== null && <span className="pill bg-amber-100">draft</span>}
          </div>
          <p className="text-xs text-rebar mt-1">{form.publishedVersion ? `Published v${form.publishedVersion}` : "Not published"}</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-primary" to={`/manager/form-builder/${form._id}`}>{form.draftRevision !== null ? "Continue editing" : "View / edit"}</Link>
          <button className="btn-ghost" onClick={() => void setArchived({ formId: form._id, archived: form.status !== "archived" })}>
            {form.status === "archived" ? "Restore" : "Archive"}
          </button>
        </div>
      </div>)}
    </div>}
  </div>;
}
