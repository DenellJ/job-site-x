import type { Profile } from "../lib/types";

export default function PendingApproval({
  profile,
  onSignOut,
}: {
  profile: Profile;
  onSignOut: () => Promise<void>;
}) {
  const declined = profile.status === "declined";
  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-stone-100">
      <div className="card max-w-md w-full space-y-4 text-center">
        <span
          className={`inline-flex items-center justify-center w-14 h-14 rounded-sm font-black text-2xl mx-auto ${
            declined ? "bg-err text-white" : "bg-amber-100 text-amber-900"
          }`}
        >
          {declined ? "✕" : "⏳"}
        </span>
        <h1 className="text-2xl font-black uppercase">
          {declined ? "Account Declined" : "Awaiting Approval"}
        </h1>
        <p className="text-rebar text-sm">
          {declined
            ? "Your account request was declined. Please contact your manager if you think this is a mistake."
            : "Your account is waiting for a manager to approve it and assign your forms. You'll get access as soon as it's approved."}
        </p>
        <p className="text-xs uppercase tracking-widest text-rebar">
          Signed in as {profile.fullName || profile.username}
        </p>
        <button className="btn-ghost w-full" onClick={() => void onSignOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
