import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SubmissionPill } from "../components/StatusPill";
import { FORM_LABELS } from "../forms";

export default function MyDrafts() {
  const rows = useQuery(api.submissions.listMine);
  const deleteDraft = useMutation(api.submissions.deleteDraft);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this draft? This cannot be undone.")) return;
    await deleteDraft({ submissionId: id as Id<"formSubmissions"> });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">My Forms</h1>
          <p className="text-xs uppercase tracking-widest text-rebar mt-1">Drafts & submissions</p>
        </div>
        <Link to="/" className="btn-accent">
          + Start a Job
        </Link>
      </div>

      {rows === undefined ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card text-center text-rebar">No forms yet. Start a job to begin.</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card-job flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black uppercase tracking-tight">{FORM_LABELS[r.formType]}</span>
                  <SubmissionPill status={r.status} />
                </div>
                <div className="text-sm text-rebar mt-0.5">
                  {r.label} · {new Date(r.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.status === "draft" && (
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="btn-err !min-h-[44px] !py-2 px-3 text-sm"
                    aria-label="Delete draft"
                  >
                    🗑
                  </button>
                )}
                <Link to={`/forms/${r.id}`} className="btn-primary !min-h-[44px] !py-2 text-sm">
                  {r.status === "draft" ? "Continue →" : "View →"}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
