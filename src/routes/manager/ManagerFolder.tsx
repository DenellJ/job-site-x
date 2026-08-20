import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { SubmissionPill } from "../../components/StatusPill";
import { FORM_LABELS } from "../../forms";
import type { FormType } from "../../lib/types";

export default function ManagerFolder({ isAdmin }: { isAdmin: boolean }) {
  const { formType } = useParams<{ formType: string }>();
  const ft = formType as FormType;
  const deleteSubmission = useMutation(api.submissions.deleteSubmission);
  const [deletingId, setDeletingId] = useState<Id<"formSubmissions"> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { results: items, status, loadMore } = usePaginatedQuery(
    api.submissions.listForManager,
    { formType: ft },
    { initialNumItems: 20 },
  );

  async function removeSubmission(item: { id: Id<"formSubmissions">; label: string }) {
    const confirmed = window.confirm(
      `Permanently delete "${item.label}"? Its form data, history, signatures, evidence, attachments, and generated report will be removed. This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeletingId(item.id);
    setErr(null);
    try {
      await deleteSubmission({ submissionId: item.id });
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Could not delete submission.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/manager" className="text-xs uppercase tracking-widest font-black text-rebar underline">
          ← Dashboard
        </Link>
        <h1 className="text-3xl font-black uppercase tracking-tight mt-1">
          📁 {FORM_LABELS[ft] ?? "Folder"}
        </h1>
      </div>

      {err && <p className="text-err text-sm font-bold">{err}</p>}

      {status === "LoadingFirstPage" ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <div className="card text-center text-rebar">No submissions in this folder.</div>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className="card-job flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black uppercase tracking-tight">{r.label}</span>
                  <SubmissionPill status={r.status} />
                  {r.reportVersion > 0 ? (
                    <span className="pill bg-green-100 text-green-900 border-green-700">
                      ✓ Report v{r.reportVersion}
                    </span>
                  ) : (
                    <span className="pill bg-amber-100 text-amber-900 border-amber-300">Needs converting</span>
                  )}
                </div>
                <div className="text-sm text-rebar mt-0.5">
                  {r.submitterUsername} · {new Date(r.submittedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2 sm:shrink-0">
                <Link
                  to={`/manager/submissions/${r.id}`}
                  className={`btn-primary !min-h-[44px] !py-2 text-sm ${deletingId === r.id ? "pointer-events-none opacity-50" : ""}`}
                  aria-disabled={deletingId === r.id}
                >
                  Review →
                </Link>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn-err !min-h-[44px] !py-2 text-sm"
                    disabled={deletingId !== null}
                    onClick={() => void removeSubmission(r)}
                  >
                    {deletingId === r.id ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {status === "CanLoadMore" && <button className="btn-ghost w-full" onClick={() => loadMore(20)}>Load more</button>}
    </div>
  );
}
