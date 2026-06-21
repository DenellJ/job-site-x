import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

export default function Setup() {
  const isSetupNeeded = useQuery(api.users.isSetupNeeded);
  const setupFirstAdmin = useAction(api.users.setupFirstAdmin);
  const { signIn } = useAuthActions();

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await setupFirstAdmin({ email, password, username, fullName: fullName || null });
      // Sign in with the same credentials — the app flips to the authed view,
      // and the `/setup` route then redirects home.
      await signIn("password", { email, password, flow: "signIn" });
    } catch (e: any) {
      setErr(e.message ?? "Setup failed.");
      setBusy(false);
    }
  }

  if (isSetupNeeded === undefined) {
    return (
      <Centered>
        <p>Checking site status…</p>
      </Centered>
    );
  }

  if (!isSetupNeeded) {
    return (
      <Centered>
        <div className="card max-w-md">
          <h1 className="text-xl font-black uppercase mb-2">Already Set Up</h1>
          <p className="text-rebar mb-4">
            An admin account already exists. Please sign in.
          </p>
          <a className="btn-primary" href="/login">Go to Sign In</a>
        </div>
      </Centered>
    );
  }

  return (
    <Centered>
      <form onSubmit={submit} className="card max-w-md w-full space-y-4">
        <Brand />
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Set Up Site</h1>
          <p className="text-rebar text-sm mt-1">
            Create the first admin account. From here you'll create managers and manage users.
          </p>
        </div>
        <Field label="Username" value={username} onChange={setUsername} required />
        <Field label="Full name" value={fullName} onChange={setFullName} />
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          required
          minLength={8}
        />
        {err && <p className="text-err text-sm font-bold">{err}</p>}
        <button className="btn-accent w-full" disabled={busy}>
          {busy ? "Creating…" : "Create Admin Account"}
        </button>
      </form>
    </Centered>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  minLength
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Brand() {
  return <img src="/resscott-logo.png" alt="Resscott Limited" className="h-14 w-auto max-w-full" />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-stone-100">
      {children}
    </div>
  );
}
