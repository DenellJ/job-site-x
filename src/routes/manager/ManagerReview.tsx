import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { SignaturePad, type SignaturePadHandle } from "../../components/SignaturePad";
import { MediaThumbs } from "../../components/MediaThumbs";
import { SubmissionPill } from "../../components/StatusPill";

export default function ManagerReview() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const submissionId = id as Id<"formSubmissions">;

  const detail = useQuery(api.submissions.getDetail, { submissionId });
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const decide = useMutation(api.approvals.decide);
  const convert = useAction(api.reports.convert);

  const [comment, setComment] = useState("");
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

  async function runConvert(reconvert: boolean) {
    if (reconvert && !window.confirm("Re-generate the report? This replaces the current PDF.")) return;
    setConverting(true);
    setErr(null);
    try {
      await convert({ submissionId });
    } catch (e: any) {
      setErr(e.message ?? "Conversion failed.");
    } finally {
      setConverting(false);
    }
  }

  function download(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.download = "inspection-report.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (detail === undefined) return <p>Loading…</p>;
  if (detail === null) return <div className="card text-err font-bold">Submission not found.</div>;
  const pending = detail.status === "submitted";

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

      {pending && (
        <>
          <div className="card">
            <h2 className="section-title">✍ Manager Signature</h2>
            <SignaturePad ref={sigRef} />
          </div>
          <div className="card">
            <label className="label">Comment (required to reject)</label>
            <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={reject} className="btn-err" disabled={busy}>
              ✕ Reject
            </button>
            <button onClick={approve} className="btn-ok" disabled={busy}>
              {busy ? "Saving…" : "✓ Approve"}
            </button>
          </div>
        </>
      )}

      {/* Report conversion */}
      <div className="card space-y-3">
        <h2 className="section-title">📄 Inspection Report</h2>
        {detail.reportVersion > 0 ? (
          <p className="text-sm text-rebar">
            Converted (v{detail.reportVersion})
            {detail.reportGeneratedAt ? ` · ${new Date(detail.reportGeneratedAt).toLocaleString()}` : ""}
          </p>
        ) : (
          <p className="text-sm text-warn font-bold">Not yet converted.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {detail.reportVersion === 0 ? (
            <button onClick={() => runConvert(false)} className="btn-accent col-span-2" disabled={converting}>
              {converting ? "Converting…" : "Convert to PDF Report"}
            </button>
          ) : (
            <>
              <button onClick={() => runConvert(true)} className="btn-ghost" disabled={converting}>
                {converting ? "Converting…" : "🔄 Convert Again"}
              </button>
              <button
                onClick={() => detail.reportUrl && download(detail.reportUrl)}
                className="btn-primary"
                disabled={!detail.reportUrl}
              >
                ⬇ Download PDF
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
    </div>
  );
}
