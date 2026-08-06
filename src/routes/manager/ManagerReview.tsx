import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FormRenderer } from "../../components/FormRenderer";
import { SignaturePad, type SignaturePadHandle } from "../../components/SignaturePad";
import { MediaThumbs } from "../../components/MediaThumbs";
import { SubmissionPill } from "../../components/StatusPill";
import { getFormDef, isSketchValue } from "../../forms";
import type { FormType, UploadedMedia } from "../../lib/types";
import { toMediaRefs } from "../../lib/types";

type Value = string | number | boolean;

function mediaArg(items: UploadedMedia[]) {
  return toMediaRefs(items).map((media) => ({
    ...media,
    storageId: media.storageId as Id<"_storage">,
  }));
}

export default function ManagerReview() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const submissionId = id as Id<"formSubmissions">;

  const detail = useQuery(api.submissions.getDetail, { submissionId });
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const decide = useMutation(api.approvals.decide);
  const editSubmission = useMutation(api.submissions.editSubmission);
  const convert = useAction(api.reports.convert);

  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, Value>>({});
  const [editAttachments, setEditAttachments] = useState<UploadedMedia[]>([]);
  const [editReason, setEditReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sigRef = useRef<SignaturePadHandle>(null);

  async function uploadSignature(): Promise<Id<"_storage"> | null> {
    if (!sigRef.current || sigRef.current.isEmpty()) return null;
    const blob = await sigRef.current.toBlob();
    if (!blob) return null;
    const postUrl = await generateUploadUrl();
    const uploaded = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: blob,
    });
    if (!uploaded.ok) throw new Error("Signature upload failed.");
    const { storageId } = await uploaded.json();
    return storageId as Id<"_storage">;
  }

  async function approve() {
    if (sigRef.current?.isEmpty()) {
      setErr("Please draw your signature before approving.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const signatureId = await uploadSignature();
      await decide({ submissionId, decision: "approved", comment: comment || null, signatureId });
    } catch (e: any) {
      setErr(e.message ?? "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!comment.trim()) {
      setErr("A comment is required to reject.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const signatureId = await uploadSignature();
      await decide({ submissionId, decision: "rejected", comment, signatureId });
    } catch (e: any) {
      setErr(e.message ?? "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    if (!detail) return;
    setEditValues(detail.formValues as Record<string, Value>);
    setEditAttachments(detail.attachments.map((media) => ({ ...media, storageId: media.storageId as string })));
    setEditReason("");
    setErr(null);
    setEditing(true);
  }

  function setEditValue(fieldId: string, value: Value | undefined) {
    setEditValues((previous) => {
      const next = { ...previous };
      if (value === undefined) delete next[fieldId];
      else next[fieldId] = value;
      return next;
    });
  }

  async function saveEdit() {
    setBusy(true);
    setErr(null);
    try {
      await editSubmission({
        submissionId,
        formValues: editValues,
        attachments: mediaArg(editAttachments),
        reason: editReason || null,
      });
      setEditing(false);
    } catch (e: any) {
      setErr(e.message ?? "Unable to save corrections.");
    } finally {
      setBusy(false);
    }
  }

  async function runConvert(reconvert: boolean) {
    if (!detail) return;
    if (reconvert && !window.confirm("Re-generate the report? This replaces the current document.")) return;
    setConverting(true);
    setErr(null);
    try {
      const { url } = await convert({ submissionId });
      const isWord = detail.formType.startsWith("site_visit");
      if (url) download(url, `${detail.label || "report"}.${isWord ? "docx" : "pdf"}`);
    } catch (e: any) {
      setErr(e.message ?? "Conversion failed.");
    } finally {
      setConverting(false);
    }
  }

  function download(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (detail === undefined) return <p>Loading…</p>;
  if (detail === null) return <div className="card text-err font-bold">Submission not found.</div>;
  const pending = detail.status === "submitted";
  const isWord = detail.formType.startsWith("site_visit");
  const docType = isWord ? "Word" : "PDF";
  const ext = isWord ? "docx" : "pdf";
  const canEdit = detail.status === "submitted" || detail.status === "approved";
  const formDef = getFormDef(detail.formType as FormType);
  const fieldLabels = new Map(detail.formFields.map((field) => [field.id, field.label]));

  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => nav(-1)} className="text-xs uppercase tracking-widest font-black text-rebar underline">
          ← Back
        </button>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <h1 className="text-3xl font-black uppercase tracking-tight">{detail.formLabel}</h1>
          <SubmissionPill status={detail.status} />
        </div>
        <p className="text-rebar text-sm mt-1">
          {detail.label} · by {detail.submitterUsername} · {new Date(detail.submittedAt).toLocaleString()}
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="section-title">Section 1 · Start Evidence</h2>
        <p className="text-sm whitespace-pre-wrap">{detail.startNotes || "—"}</p>
        <MediaThumbs media={detail.startMedia} />
      </div>

      {editing ? (
        <div className="space-y-4">
          <FormRenderer
            sections={formDef.sections}
            values={editValues}
            onChange={setEditValue}
            attachments={editAttachments}
            onAttachmentsChange={setEditAttachments}
          />
          <div className="card space-y-3">
            <label className="label">Correction reason (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={editReason}
              onChange={(event) => setEditReason(event.target.value)}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button className="btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn-accent" onClick={saveEdit} disabled={busy}>
                {busy ? "Saving…" : "Save Corrections"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="card space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="section-title mb-0">{detail.formLabel} — Details</h2>
              {canEdit && (
                <button className="btn-ghost shrink-0" onClick={startEdit}>
                  Edit Form
                </button>
              )}
            </div>
            <ul className="space-y-2 text-sm">
              {detail.formFields
                .filter((field) => field.type !== "sketch" && !isSketchValue(detail.formValues[field.id]))
                .map((field) => {
                  const value = detail.formValues[field.id];
                  const display =
                    value === undefined || value === null
                      ? "—"
                      : typeof value === "boolean"
                        ? value
                          ? "Yes"
                          : "No"
                        : String(value);
                  return (
                    <li key={field.id} className="flex flex-col gap-1 border-b border-stone-100 pb-1 sm:flex-row sm:justify-between sm:gap-3">
                      <span className="min-w-0 break-words font-bold uppercase tracking-wide text-xs text-rebar">{field.label}</span>
                      <span className="min-w-0 break-words font-semibold sm:text-right">{display}</span>
                    </li>
                  );
                })}
            </ul>
          </div>

          {detail.formFields
            .filter((field) => isSketchValue(detail.formValues[field.id]))
            .map((field) => (
              <div className="card" key={field.id}>
                <h2 className="section-title">✏️ {field.label}</h2>
                <img
                  src={detail.formValues[field.id] as string}
                  alt={field.label}
                  className="w-full rounded-lg border border-stone-200 bg-white"
                />
              </div>
            ))}

          {detail.attachments.length > 0 && (
            <div className="card">
              <h2 className="section-title">📎 Attachments</h2>
              <MediaThumbs media={detail.attachments} />
            </div>
          )}
        </>
      )}

      <div className="card">
        <h2 className="section-title">📷 Completion Evidence</h2>
        <MediaThumbs media={detail.finalMedia} />
      </div>

      {pending && !editing && (
        <>
          <div className="card">
            <h2 className="section-title">✍ Manager Signature</h2>
            <SignaturePad ref={sigRef} />
          </div>
          <div className="card">
            <label className="label">Comment (required to reject)</label>
            <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={reject} className="btn-err" disabled={busy}>
              ✕ Reject
            </button>
            <button onClick={approve} className="btn-ok" disabled={busy}>
              {busy ? "Saving…" : "✓ Approve"}
            </button>
          </div>
        </>
      )}

      {/* Report / document generation */}
      <div className="card space-y-3">
        <h2 className="section-title">📄 {docType} Report</h2>
        {detail.reportVersion > 0 ? (
          <p className="text-sm text-rebar">
            Generated (v{detail.reportVersion})
            {detail.reportGeneratedAt ? ` · ${new Date(detail.reportGeneratedAt).toLocaleString()}` : ""}
          </p>
        ) : (
          <p className="text-sm text-warn font-bold">
            {detail.edits.length > 0 ? "A correction requires a new report." : "Not yet generated."}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {detail.reportVersion === 0 ? (
            <button onClick={() => runConvert(false)} className="btn-accent col-span-2" disabled={converting}>
              {converting ? "Generating…" : `Convert to ${docType}`}
            </button>
          ) : (
            <>
              <button onClick={() => runConvert(true)} className="btn-ghost" disabled={converting}>
                {converting ? "Generating…" : "🔄 Convert Again"}
              </button>
              <button
                onClick={() => detail.reportUrl && download(detail.reportUrl, `${detail.label || "report"}.${ext}`)}
                className="btn-primary"
                disabled={!detail.reportUrl}
              >
                ⬇ Download {docType}
              </button>
            </>
          )}
        </div>
      </div>

      {err && <p className="text-err text-sm font-bold">{err}</p>}

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

      {detail.edits.length > 0 && (
        <div className="card">
          <h2 className="section-title">Correction History</h2>
          <ul className="space-y-2 text-sm">
            {detail.edits.map((edit) => {
              const changes = [
                ...edit.fieldIds.map((fieldId) => fieldLabels.get(fieldId) ?? fieldId),
                ...(edit.attachmentsChanged ? ["Attachments"] : []),
              ];
              return (
                <li key={edit.id} className="border-l-4 border-slate-200 pl-3 py-1">
                  <div className="font-semibold">
                    {edit.editedByUsername} · {new Date(edit.editedAt).toLocaleString()}
                  </div>
                  <div className="break-words text-rebar">{changes.join(", ")}</div>
                  {edit.reason && <div className="break-words text-slate-600">{edit.reason}</div>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
