import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FORM_LABELS, FORM_TYPES } from "../../forms";
import type { FormType, UserRole } from "../../lib/types";
import { PasswordInput } from "../../components/PasswordInput";

const dynamicApi = anyApi;

type ManagedForm = {
  _id: Id<"forms">;
  title: string;
  status: "active" | "archived";
  legacyKey?: FormType;
  publishedVersion: number | null;
};

function DynamicFormAccessPicker({ forms, value, onChange, disabled = false }: {
  forms: ManagedForm[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(formId: string) {
    onChange(value.includes(formId) ? value.filter((id) => id !== formId) : [...value, formId]);
  }
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{forms.map((form) => <button type="button" key={form._id} disabled={disabled} onClick={() => toggle(form._id)} className={`pill cursor-pointer ${value.includes(form._id) ? "bg-ink text-concrete border-ink" : "bg-white text-ink border-stone-300"}`}>{value.includes(form._id) ? "✓ " : ""}{form.title}</button>)}</div>;
}

export default function ManagerUsers() {
  const me = useQuery(api.users.me);
  const pending = useQuery(api.users.listPendingUsers) ?? [];
  const users = useQuery(api.users.listProfiles) ?? [];
  const managedForms = useQuery(dynamicApi.formTemplates.listForManagement) as ManagedForm[] | undefined;
  const assignableForms = (managedForms ?? []).filter((form) => form.status === "active" && form.publishedVersion !== null);
  const isAdmin = me?.role === "admin";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight">Users</h1>
        <p className="text-xs uppercase tracking-widest text-rebar mt-1">Requests, access & accounts</p>
      </div>

      <ChangeOwnPassword />

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

      <CreateAccount isAdmin={isAdmin} forms={assignableForms} />

      <section className="card">
        <h2 className="section-title">Existing Accounts</h2>
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <AccountRow
              key={u.id}
              user={u}
              forms={assignableForms}
              actorId={me?.id ?? null}
              actorRole={me?.role ?? null}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function ChangeOwnPassword() {
  const changeOwnPassword = useAction(api.users.changeOwnPassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    if (newPassword.length < 8) {
      setErr("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await changeOwnPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setInfo("Your password was changed.");
    } catch (e: any) {
      setErr(e.message ?? "Password change failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="section-title">Change My Password</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Current password</label>
          <PasswordInput value={currentPassword} onChange={setCurrentPassword} required autoComplete="current-password" />
        </div>
        <div>
          <label className="label">New password</label>
          <PasswordInput value={newPassword} onChange={setNewPassword} required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <PasswordInput value={confirmPassword} onChange={setConfirmPassword} required minLength={8} autoComplete="new-password" />
        </div>
      </div>
      {err && <p className="text-err text-sm font-bold">{err}</p>}
      {info && <p className="text-ok text-sm font-bold">{info}</p>}
      <button className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? "Changing..." : "Change Password"}
      </button>
    </form>
  );
}

function FormAccessPicker({ value, onChange }: { value: FormType[]; onChange: (next: FormType[]) => void }) {
  function toggle(t: FormType) {
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
        {user.fullName || user.username}
      </div>
      <div>
        <label className="label">Grant access to forms</label>
        <FormAccessPicker value={forms} onChange={setForms} />
      </div>
      {err && <p className="text-err text-sm font-bold">{err}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button className="btn-err" onClick={decline} disabled={busy}>
          Decline
        </button>
        <button className="btn-ok" onClick={approve} disabled={busy}>
          {busy ? "…" : "Approve"}
        </button>
      </div>
    </li>
  );
}

function AccountRow({
  user,
  forms,
  actorId,
  actorRole,
}: {
  user: {
    id: string;
    username: string;
    fullName: string | null;
    role: UserRole;
    status: "pending" | "approved" | "declined";
    allowedForms: FormType[];
  };
  forms: ManagedForm[];
  actorId: string | null;
  actorRole: UserRole | null;
}) {
  const setAssignments = useMutation(dynamicApi.formTemplates.setAssignments);
  const assigned = useQuery(dynamicApi.formTemplates.getAssignments, { userId: user.id as Id<"users"> }) as string[] | undefined;
  const resetContractorPassword = useAction(api.users.resetContractorPassword);
  const deleteUser = useMutation(api.users.deleteUser);
  const [editing, setEditing] = useState(false);
  const [dynamicForms, setDynamicForms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountErr, setAccountErr] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<string | null>(null);
  const legacyFormIds = forms
    .filter((form) => form.legacyKey && user.allowedForms.includes(form.legacyKey))
    .map((form) => form._id);
  const effectiveAssignedIds = assigned && assigned.length > 0 ? assigned : legacyFormIds;
  const assignedForms = forms.filter((form) => effectiveAssignedIds.includes(form._id));
  const canDelete = actorId !== user.id && (
    actorRole === "admin" || (actorRole === "manager" && user.role === "personnel")
  );

  async function save() {
    setBusy(true);
    setAccountErr(null);
    try {
      await setAssignments({ userId: user.id as Id<"users">, formIds: dynamicForms as Id<"forms">[] });
      setEditing(false);
    } catch (e: any) {
      setAccountErr(e.message ?? "Could not save form access.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setAccountErr(null);
    setAccountInfo(null);
    if (newPassword.length < 8) {
      setAccountErr("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setAccountErr("Passwords do not match.");
      return;
    }
    setAccountBusy(true);
    try {
      await resetContractorPassword({ userId: user.id as Id<"users">, newPassword });
      setNewPassword("");
      setConfirmPassword("");
      setResetOpen(false);
      setAccountInfo("Contractor password reset. Their active sessions were signed out.");
    } catch (e: any) {
      setAccountErr(e.message ?? "Password reset failed.");
    } finally {
      setAccountBusy(false);
    }
  }

  async function removeUser() {
    setAccountBusy(true);
    setAccountErr(null);
    try {
      await deleteUser({ userId: user.id as Id<"users"> });
    } catch (e: any) {
      setAccountErr(e.message ?? "Delete failed.");
    } finally {
      setAccountBusy(false);
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
        </div>
        <span className={`pill ${statusClass}`}>{user.status}</span>
        <span className={`pill ${user.role === "personnel" ? "bg-hi text-ink border-ink" : "bg-ink text-hi border-ink"}`}>
          {user.role === "personnel" ? "contractor" : user.role}
        </span>
      </div>
      {user.role === "personnel" && (
        <div className="pl-11 space-y-2">
          {editing ? (
            <>
              <DynamicFormAccessPicker forms={forms} value={dynamicForms} onChange={setDynamicForms} disabled={busy || accountBusy} />
              <div className="flex gap-2">
                <button type="button" className="pill cursor-pointer bg-stone-100 text-ink border-stone-300" onClick={() => setEditing(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="button" className="pill cursor-pointer bg-ok text-white border-ok" onClick={save} disabled={busy || accountBusy}>
                  {busy ? "…" : "Save forms"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-rebar uppercase tracking-widest font-bold">Forms:</span>
              {assignedForms.length === 0 ? (
                <span className="text-rebar">none</span>
              ) : (
                assignedForms.map((form) => <span key={form._id} className="pill bg-stone-100 text-ink border-stone-300">{form.title}</span>)
              )}
              <button type="button" className="underline text-ink font-bold" disabled={assigned === undefined || accountBusy} onClick={() => { setDynamicForms(effectiveAssignedIds); setEditing(true); setAccountErr(null); }}>
                edit
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="pill cursor-pointer bg-white text-ink border-stone-300"
              disabled={accountBusy}
              onClick={() => {
                setResetOpen((open) => !open);
                setDeleteOpen(false);
                setAccountErr(null);
                setAccountInfo(null);
              }}
            >
              {resetOpen ? "Cancel password reset" : "Reset password"}
            </button>
          </div>
          {resetOpen && (
            <form onSubmit={resetPassword} className="rounded-md border border-stone-200 bg-stone-50 p-3 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest">Set temporary password</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">New password</label>
                  <PasswordInput value={newPassword} onChange={setNewPassword} required minLength={8} autoComplete="new-password" />
                </div>
                <div>
                  <label className="label">Confirm password</label>
                  <PasswordInput value={confirmPassword} onChange={setConfirmPassword} required minLength={8} autoComplete="new-password" />
                </div>
              </div>
              <button className="btn-primary w-full sm:w-auto" disabled={accountBusy}>
                {accountBusy ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}
        </div>
      )}
      {canDelete && !deleteOpen && (
        <div className="pl-11">
          <button type="button" className="btn-err" disabled={accountBusy} onClick={() => { setDeleteOpen(true); setResetOpen(false); setAccountErr(null); setAccountInfo(null); }}>
            Delete user
          </button>
        </div>
      )}
      {canDelete && deleteOpen && (
        <div className="ml-11 rounded-md border-2 border-red-300 bg-red-50 p-3 space-y-3" role="alert">
          <p className="text-sm font-bold text-red-900">
            Permanently delete {user.fullName || user.username}'s login and form access? Their completed jobs, submissions, reports, and approvals will remain available.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" disabled={accountBusy} onClick={() => { setDeleteOpen(false); setAccountErr(null); }}>Cancel</button>
            <button type="button" className="btn-err" disabled={accountBusy} onClick={() => void removeUser()}>
              {accountBusy ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      )}
      {accountErr && <p className="pl-11 text-err text-sm font-bold">{accountErr}</p>}
      {accountInfo && <p className="pl-11 text-ok text-sm font-bold">{accountInfo}</p>}
    </li>
  );
}

function CreateAccount({ isAdmin, forms }: { isAdmin: boolean; forms: ManagedForm[] }) {
  const createUser = useAction(api.users.createUser);
  const setAssignments = useMutation(dynamicApi.formTemplates.setAssignments);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("personnel");
  const [dynamicForms, setDynamicForms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setInfo(null);
    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const allowedForms = forms
        .filter((form) => form.legacyKey && dynamicForms.includes(form._id))
        .flatMap((form) => form.legacyKey ? [form.legacyKey] : []);
      const userId = await createUser({
        email,
        password,
        fullName,
        role,
        allowedForms: role === "personnel" ? allowedForms : [],
      });
      if (role === "personnel") await setAssignments({ userId, formIds: dynamicForms as Id<"forms">[] });
      setInfo(`Created ${role} "${fullName}". They can sign in with the email + password you set.`);
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setDynamicForms([]);
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
          <label className="label">Full name</label>
          <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Temp password</label>
          <PasswordInput value={password} onChange={setPassword} required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <label className="label">Confirm temp password</label>
          <PasswordInput value={confirmPassword} onChange={setConfirmPassword} required minLength={8} autoComplete="new-password" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="personnel">Contractor / User</option>
            {isAdmin && <option value="manager">Manager</option>}
            {isAdmin && <option value="admin">Admin</option>}
          </select>
        </div>
        {role === "personnel" && (
          <div className="sm:col-span-2">
            <label className="label">Form access</label>
            <DynamicFormAccessPicker forms={forms} value={dynamicForms} onChange={setDynamicForms} disabled={busy} />
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
