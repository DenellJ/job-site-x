import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

export default function Login() {
  const { signIn } = useAuthActions();
  const isSetupNeeded = useQuery(api.users.isSetupNeeded);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await signIn("password", { email, password, flow: "signIn" });
      // On success the app re-renders into the authenticated view.
    } catch {
      setErr("Sign in failed. Check your email and password.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-stone-100">
      <form onSubmit={submit} className="card max-w-md w-full space-y-4">
        <img src="/resscott-logo.png" alt="Resscott Limited" className="h-14 w-auto max-w-full" />
        <h1 className="text-2xl font-black uppercase">Sign In</h1>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {err && <p className="text-err text-sm font-bold">{err}</p>}
        <button className="btn-accent w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign In"}
        </button>
        <p className="text-sm text-rebar text-center">
          New here?{" "}
          <Link to="/register" className="text-ink font-black underline uppercase tracking-wide text-xs">
            Create an account
          </Link>
        </p>
        {isSetupNeeded && (
          <p className="text-sm text-rebar text-center">
            First time here?{" "}
            <Link to="/setup" className="text-ink font-black underline uppercase tracking-wide text-xs">
              Set up the first manager
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}
