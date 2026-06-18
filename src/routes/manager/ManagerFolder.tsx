import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SubmissionPill } from "../../components/StatusPill";
import { FORM_LABELS } from "../../forms";
import type { FormType } from "../../lib/types";

export default function ManagerFolder() {
  const { formType } = useParams<{ formType: string }>();
  const ft = formType as FormType;
  const rows = useQuery(api.submissions.listForManager);
  const items = (rows ?? []).filter((r) => r.formType === ft);

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

      {rows === undefined ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <div className="card text-center text-rebar">No submissions in this folder.</div>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className="card-job flex items-center gap-3">
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
              <Link to={`/manager/submissions/${r.id}`} className="btn-primary !min-h-[44px] !py-2 text-sm">
                Review →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
