import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FORM_LABELS, FORM_TYPES } from "../../forms";
import type { FormType, UserRole } from "../../lib/types";

export default function ManagerUsers() {
  const pending = useQuery(api.users.listPendingUsers) ?? [];
  const users = useQuery(api.users.listProfiles) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight">Users</h1>
        <p className="text-xs uppercase tracking-widest text-rebar mt-1">Requests, access & accounts</p>
      </div>

      <section className="card space-y-3">
        <h2 className="section-title">⏳ Pending Requests ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-rebar">No pending account requests.</p>
        ) : (
          <ul className="space-y-4">
            {pending.map((u) => (
              <PendingRow key={u.id} user={u} />
            ))}
          </ul>
        )}
      </section>

      <CreateAccount />

      <section className="card">
        <h2 className="section-title">Existing Accounts</h2>
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <AccountRow key={u.id} user={u} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function FormAccessPicker({ value, onChange }: { value: FormType[]; onChange: (next: FormType[]) => void }) {
  function toggle(t: FormType) {
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {FORM_TYPES.map((t) => (
        <button
          type="button"
          key={t}
          onClick={() => toggle(t)}
          className={`pill cursor-pointer ${
            value.includes(t) ? "bg-ink text-concrete border-ink" : "bg-white text-ink border-stone-300"
          }`}
        >
          {value.includes(t) ? "✓ " : ""}
          {FORM_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

function PendingRow({
  user,
}: {
  user: { id: string; username: string; fullName: string | null; requestedAt: number };
}) {
  const approveUser = useMutation(api.users.approveUser);
  const declineUser = useMutation(api.users.declineUser);
  const [forms, setForms] = useState<FormType[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setErr(null);
    try {
      await approveUser({ userId: user.id as Id<"users">, allowedForms: forms });
    } catch (e: any) {
      setErr(e.message ?? "Approve failed.");
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setErr(null);
    try {
      await declineUser({ userId: user.id as Id<"users"> });
    } catch (e: any) {
      setErr(e.message ?? "Decline failed.");
      setBusy(false);
    }
  }

  return (
    <li className="border-2 border-stone-200 rounded-md p-3 space-y-2">
      <div className="font-bold">
        {user.fullName || user.username} <span className="text-xs text-rebar">@{user.username}</span>
      </div>
      <div>
        <label className="label">Grant access to forms</label>
        <FormAccessPicker value={forms} onChange={setForms} />
      </div>
      {err && <p className="text-err text-sm font-bold">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-err !min-h-[44px]" onClick={decline} disabled={busy}>
          Decline
        </button>
        <button className="btn-ok !min-h-[44px]" onClick={approve} disabled={busy}>
          {busy ? "…" : "Approve"}
        </button>
      </div>
    </li>
  );
}

function AccountRow({
  user,
}: {
  user: {
    id: string;
    username: string;
    fullName: string | null;
    role: UserRole;
    status: "pending" | "approved" | "declined";
    allowedForms: FormType[];
  };
}) {
  const updateUserForms = useMutation(api.users.updateUserForms);
  const [editing, setEditing] = useState(false);
  const [forms, setForms] = useState<FormType[]>(user.allowedForms);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateUserForms({ userId: user.id as Id<"users">, allowedForms: forms });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  const statusClass =
    user.status === "approved"
      ? "bg-green-100 text-green-900 border-green-700"
      : user.status === "pending"
      ? "bg-amber-100 text-amber-900 border-amber-300"
      : "bg-red-100 text-red-900 border-red-700";

  return (
    <li className="py-3 space-y-2">
      <div className="flex items-center gap-3">
        <span className="inline-flex w-8 h-8 bg-stone-100 border-2 border-stone-300 rounded-sm items-center justify-center font-black uppercase">
          {(user.fullName || user.username).slice(0, 1)}
        </span>
        <div className="flex-1">
          <div className="font-bold">{user.fullName || user.username}</div>
          <div className="text-xs text-rebar">@{user.username}</div>
        </div>
        <span className={`pill ${statusClass}`}>{user.status}</span>
        <span className={`pill ${user.role === "manager" ? "bg-ink text-hi border-ink" : "bg-hi text-ink border-ink"}`}>
          {user.role}
        </span>
      </div>
      {user.role === "personnel" && (
        <div className="pl-11 space-y-2">
          {editing ? (
            <>
              <FormAccessPicker value={forms} onChange={setForms} />
              <div className="flex gap-2">
                <button className="pill cursor-pointer bg-stone-100 text-ink border-stone-300" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button className="pill cursor-pointer bg-ok text-white border-ok" onClick={save} disabled={busy}>
                  {busy ? "…" : "Save forms"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-rebar uppercase tracking-widest font-bold">Forms:</span>
              {user.allowedForms.length === 0 ? (
                <span className="text-rebar">none</span>
              ) : (
                user.allowedForms.map((f) => <span key={f} className="pill bg-stone-100 text-ink border-stone-300">{FORM_LABELS[f]}</span>)
              )}
              <button className="underline text-ink font-bold" onClick={() => { setForms(user.allowedForms); setEditing(true); }}>
                edit
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function CreateAccount() {
  const createUser = useAction(api.users.createUser);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("personnel");
  const [forms, setForms] = useState<FormType[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      await createUser({
        email,
        password,
        username,
        fullName: fullName || null,
        role,
        allowedForms: role === "manager" ? [] : forms,
      });
      setInfo(`Created ${role} "${username}". They can sign in with the email + password you set.`);
      setUsername("");
      setFullName("");
      setEmail("");
      setPassword("");
      setForms([]);
    } catch (e: any) {
      setErr(e.message ?? "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create} className="card space-y-3">
      <h2 className="section-title">+ Create Account (pre-approved)</h2>
      <div className="grid sm:grid-cols-2 gap-3">
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
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Temp password</label>
          <input className="input" type="text" required minLength={4} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="personnel">Personnel</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        {role === "personnel" && (
          <div className="sm:col-span-2">
            <label className="label">Form access</label>
            <FormAccessPicker value={forms} onChange={setForms} />
          </div>
        )}
      </div>
      {err && <p className="text-err text-sm font-bold">{err}</p>}
      {info && <p className="text-ok text-sm font-bold">{info}</p>}
      <button className="btn-accent w-full" disabled={busy}>
        {busy ? "Creating…" : "+ Create User"}
      </button>
    </form>
  );
}
