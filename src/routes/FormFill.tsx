import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FormRenderer } from "../components/FormRenderer";
import { MediaGallery } from "../components/MediaGallery";
import { MediaThumbs } from "../components/MediaThumbs";
import { SubmissionPill } from "../components/StatusPill";
import { getFormDef } from "../forms";
import type { FormType, UploadedMedia } from "../lib/types";
import { toMediaRefs } from "../lib/types";

type Value = string | number | boolean;

function mediaArg(items: { storageId: string; kind: "photo" | "video"; caption: string | null; url?: string | null }[]) {
  return toMediaRefs(items as UploadedMedia[]).map((m) => ({
    ...m,
    storageId: m.storageId as Id<"_storage">,
  }));
}

export default function FormFill() {
  const { id } = useParams<{ id: string }>();
  const submissionId = id as Id<"formSubmissions">;
  const nav = useNavigate();

  const detail = useQuery(api.submissions.getDetail, { submissionId });
  const saveDraft = useMutation(api.submissions.saveDraft);
  const submitMut = useMutation(api.submissions.submit);

  const [seeded, setSeeded] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, Value>>({});
  const [attachments, setAttachments] = useState<UploadedMedia[]>([]);
  const [finalMedia, setFinalMedia] = useState<UploadedMedia[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (detail && !seeded) {
      setFormValues((detail.formValues ?? {}) as Record<string, Value>);
      setAttachments(detail.attachments.map((m) => ({ ...m, storageId: m.storageId as string })));
      setFinalMedia(detail.finalMedia.map((m) => ({ ...m, storageId: m.storageId as string })));
      setSeeded(true);
    }
  }, [detail, seeded]);

  if (detail === undefined) return <p>Loading…</p>;
  if (detail === null) return <div className="card text-err font-bold">Submission not found.</div>;

  const def = getFormDef(detail.formType as FormType);
  const isDraft = detail.status === "draft";

  function setValue(fieldId: string, value: Value | undefined) {
    setFormValues((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[fieldId];
      else next[fieldId] = value;
      return next;
    });
  }

  async function persist() {
    if (!detail) return;
    await saveDraft({
      submissionId,
      formType: detail.formType as FormType,
      startMedia: mediaArg(detail.startMedia),
      startNotes: detail.startNotes,
      formValues,
      attachments: mediaArg(attachments),
      finalMedia: mediaArg(finalMedia),
    });
  }

  async function onSave() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await persist();
      setMsg("Draft saved.");
    } catch (e: any) {
      setErr(e.message ?? "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await persist();
      await submitMut({ submissionId });
      nav("/mine");
    } catch (e: any) {
      setErr(e.message ?? "Submit failed.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => nav("/mine")} className="text-xs uppercase tracking-widest font-black text-rebar underline">
          ← My Forms
        </button>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <h1 className="text-3xl font-black uppercase tracking-tight">{detail.formLabel}</h1>
          <SubmissionPill status={detail.status} />
        </div>
        <p className="text-rebar text-sm mt-1">{detail.label}</p>
      </div>

      {/* Section 1 — captured start evidence (read-only here) */}
      <div className="card space-y-3">
        <h2 className="section-title">Section 1 · Start Evidence</h2>
        <p className="text-sm whitespace-pre-wrap">{detail.startNotes || "—"}</p>
        <MediaThumbs media={detail.startMedia} />
      </div>

      {isDraft ? (
        <>
          <FormRenderer sections={def.sections} values={formValues} onChange={setValue} />

          <div className="card space-y-3">
            <h2 className="section-title">📎 Attachments (optional)</h2>
            <p className="text-sm text-rebar">Attach any photos or videos that support this form.</p>
            <MediaGallery value={attachments} onChange={setAttachments} label="Add attachment" />
          </div>

          <div className="card space-y-3">
            <h2 className="section-title">📷 Final completion evidence (required)</h2>
            <p className="text-sm text-rebar">
              Upload a final photo/video confirming the job is complete. Required before you can submit.
            </p>
            <MediaGallery value={finalMedia} onChange={setFinalMedia} label="Capture completion evidence" accent />
          </div>

          {err && <p className="text-err text-sm font-bold">{err}</p>}
          {msg && <p className="text-ok text-sm font-bold">{msg}</p>}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={onSave} className="btn-ghost" disabled={busy}>
              💾 Save Draft
            </button>
            <button onClick={onSubmit} className="btn-accent" disabled={busy || finalMedia.length === 0}>
              {busy ? "Submitting…" : "Submit →"}
            </button>
          </div>
          {finalMedia.length === 0 && (
            <p className="text-xs text-warn font-bold text-center">
              Submit unlocks once final completion evidence is added.
            </p>
          )}
        </>
      ) : (
        <ReadOnlyView detail={detail} />
      )}
    </div>
  );
}

type SubmissionDetail = NonNullable<FunctionReturnType<typeof api.submissions.getDetail>>;

function ReadOnlyView({ detail }: { detail: SubmissionDetail }) {
  return (
    <>
      <div className="card">
        <h2 className="section-title">{detail.formLabel} — Details</h2>
        <ul className="space-y-2 text-sm">
          {detail.formFields.map((f) => {
            const v = detail.formValues[f.id];
            const display =
              v === undefined || v === null ? "—" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);
            return (
              <li key={f.id} className="flex justify-between gap-3 border-b border-stone-100 pb-1">
                <span className="font-bold uppercase tracking-wide text-xs text-rebar">{f.label}</span>
                <span className="font-semibold text-right">{display}</span>
              </li>
            );
          })}
        </ul>
      </div>
      {detail.attachments.length > 0 && (
        <div className="card">
          <h2 className="section-title">📎 Attachments</h2>
          <MediaThumbs media={detail.attachments} />
        </div>
      )}
      <div className="card">
        <h2 className="section-title">📷 Completion Evidence</h2>
        <MediaThumbs media={detail.finalMedia} />
      </div>
      {detail.history.length > 0 && (
        <div className="card">
          <h2 className="section-title">📋 Decision History</h2>
          <ul className="space-y-2 text-sm">
            {detail.history.map((h) => (
              <li key={h.id} className="border-l-4 pl-3 py-1 border-slate-200">
                <div className="font-semibold capitalize">
                  {h.decision} · {new Date(h.decidedAt).toLocaleString()}
                </div>
                {h.comment && <div className="text-slate-600">{h.comment}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
