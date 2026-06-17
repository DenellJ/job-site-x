import type { SubmissionStatus } from "../lib/types";

const submissionClass: Record<SubmissionStatus, string> = {
  draft: "bg-stone-100 text-rebar border-stone-300",
  submitted: "bg-hi text-ink border-ink",
  approved: "bg-green-100 text-green-900 border-green-700",
  rejected: "bg-red-100 text-red-900 border-red-700",
};

const submissionLabel: Record<SubmissionStatus, string> = {
  draft: "✎ Draft",
  submitted: "⏳ Submitted",
  approved: "✓ Approved",
  rejected: "✕ Rejected",
};

export function SubmissionPill({ status }: { status: SubmissionStatus }) {
  return <span className={`pill ${submissionClass[status]}`}>{submissionLabel[status]}</span>;
}
