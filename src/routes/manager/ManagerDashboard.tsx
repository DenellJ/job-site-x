import { useState } from "react";
import { Link } from "react-router-dom";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FORM_LABELS, FORM_TYPES } from "../../forms";

export default function ManagerDashboard() {
  const rows = useQuery(api.submissions.listForManager);
  const exportDb = useAction(api.exportExcel.exportDatabase);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onExport() {
    setBusy(true);
    setErr(null);
    try {
      const { url, count } = await exportDb();
      if (!url || count === 0) {
        setErr("There are no submissions to export yet.");
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = "resscott-submissions.xlsx";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      setErr(e.message ?? "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Dashboard</h1>
          <p className="text-xs uppercase tracking-widest text-rebar mt-1">Submissions by form type</p>
        </div>
        <button className="btn-ghost" onClick={onExport} disabled={busy}>
          {busy ? "Exporting…" : "⬇ Export Excel"}
        </button>
      </div>

      {err && <p className="text-err text-sm font-bold">{err}</p>}

      {rows === undefined ? (
        <p>Loading…</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {FORM_TYPES.map((t) => {
            const items = (rows ?? []).filter((r) => r.formType === t);
            const needs = items.filter((r) => r.reportVersion === 0).length;
            return (
              <Link to={`/manager/forms/${t}`} key={t} className="card-job">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black uppercase tracking-tight">📁 {FORM_LABELS[t]}</span>
                  <span className="pill bg-stone-100 text-ink border-ink">{items.length}</span>
                </div>
                <div className="text-sm text-rebar mt-1">
                  {items.length === 0
                    ? "No submissions"
                    : needs > 0
                    ? `${needs} need converting`
                    : "All reports converted"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
