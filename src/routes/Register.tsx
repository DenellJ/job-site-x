import { useState } from "react";
import { Link } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Register() {
  const registerRequest = useAction(api.users.registerRequest);

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await registerRequest({ email, password, username, fullName: fullName || null });
      setDone(true);
    } catch (e: any) {
      setErr(e.message ?? "Registration failed. That email may already be in use.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-stone-100">
      <div className="card max-w-md w-full space-y-4">
        <Brand />
        {done ? (
          <>
            <h1 className="text-2xl font-black uppercase">Request Sent</h1>
            <p className="text-rebar text-sm">
              Your account request was sent to the manager for approval. You'll be able to sign in
              once it's approved and your forms are assigned.
            </p>
            <Link to="/login" className="btn-primary w-full">
              Back to Sign In
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h1 className="text-2xl font-black uppercase">Create Account</h1>
            <p className="text-sm text-rebar -mt-2">
              Sign up as a contractor / user. A manager approves your account and assigns your forms.
            </p>
            <div>
              <label className="label">Username</label>
              <input className="input" required value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="label">Full name</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={4} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            {err && <p className="text-err text-sm font-bold">{err}</p>}
            <button className="btn-accent w-full" disabled={busy}>
              {busy ? "Submitting…" : "Request Account"}
            </button>
            <p className="text-sm text-rebar text-center">
              Already have an account?{" "}
              <Link to="/login" className="text-ink font-black underline uppercase tracking-wide text-xs">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Brand() {
  return <img src="/resscott-logo.png" alt="Resscott Limited" className="h-14 w-auto max-w-full" />;
}
