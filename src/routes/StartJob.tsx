import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MediaGallery } from "../components/MediaGallery";
import { FORM_LABELS } from "../forms";
import type { FormType, MediaRef, Profile, UploadedMedia } from "../lib/types";
import { toMediaRefs } from "../lib/types";

// There is no draft yet on this screen (the form type is chosen last), so we
// mirror the start evidence to localStorage. If a mobile camera capture evicts
// the page, the restored media keeps its storageId (the blob is already in
// Convex storage) — only the live preview URL is lost, so it shows the
// MediaGallery placeholder until the form is started.
const DRAFT_KEY = "startjob:draft";

function loadDraft(): { startNotes: string; startMedia: UploadedMedia[] } {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { startNotes?: string; startMedia?: MediaRef[] };
      return {
        startNotes: saved.startNotes ?? "",
        startMedia: (saved.startMedia ?? []).map((m) => ({ ...m, url: null })),
      };
    }
  } catch {
    /* ignore corrupt/full storage */
  }
  return { startNotes: "", startMedia: [] };
}

export default function StartJob({ profile }: { profile: Profile }) {
  const nav = useNavigate();
  const saveDraft = useMutation(api.submissions.saveDraft);

  const [startMedia, setStartMedia] = useState<UploadedMedia[]>(() => loadDraft().startMedia);
  const [startNotes, setStartNotes] = useState(() => loadDraft().startNotes);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Keep the localStorage mirror in sync with the working state.
  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ startNotes, startMedia: toMediaRefs(startMedia) }),
      );
    } catch {
      /* ignore quota errors */
    }
  }, [startNotes, startMedia]);

  const section1Done = startMedia.length > 0 && startNotes.trim().length > 0;

  async function startForm(formType: FormType) {
    if (!section1Done) return;
    setBusy(true);
    setErr(null);
    try {
      const id = await saveDraft({
        formType,
        startMedia: toMediaRefs(startMedia).map((m) => ({ ...m, storageId: m.storageId as Id<"_storage"> })),
        startNotes,
        formValues: {},
        attachments: [],
        finalMedia: [],
      });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      nav(`/forms/${id}`);
    } catch (e: any) {
      setErr(e.message ?? "Could not start the form.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight">Start a Job</h1>
        <p className="text-xs uppercase tracking-widest text-rebar mt-1">
          Section 1 · Job-site start evidence
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="section-title">📷 Start photo / video (required)</h2>
        <p className="text-sm text-rebar">Capture the current state of the job site before you begin.</p>
        <MediaGallery value={startMedia} onChange={setStartMedia} label="Capture start evidence" accent />
      </div>

      <div className="card space-y-2">
        <h2 className="section-title">📝 Start notes (required)</h2>
        <textarea
          className="input"
          rows={4}
          placeholder="What did you observe on arrival, and what will the job entail?"
          value={startNotes}
          onChange={(e) => setStartNotes(e.target.value)}
        />
      </div>

      <div className="card space-y-3">
        <h2 className="section-title">Section 2 · Choose a form</h2>
        {!section1Done && (
          <p className="text-sm text-warn font-bold">
            Add a start photo/video and notes above to unlock the forms.
          </p>
        )}
        {profile.allowedForms.length === 0 ? (
          <p className="text-sm text-rebar">
            No forms have been assigned to your account yet. Ask your manager to grant form access.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {profile.allowedForms.map((formType) => (
              <button
                key={formType}
                type="button"
                disabled={!section1Done || busy}
                onClick={() => startForm(formType)}
                className="btn-ghost justify-start text-left"
              >
                {FORM_LABELS[formType]} →
              </button>
            ))}
          </div>
        )}
        {err && <p className="text-err text-sm font-bold">{err}</p>}
      </div>
    </div>
  );
}
