import { Navigate, Route, Routes } from "react-router-dom";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { AppShell } from "./components/AppShell";
import { NotificationBar } from "./components/NotificationBar";
import { useRealtimeNotifications } from "./hooks/useRealtimeNotifications";

import Setup from "./routes/Setup";
import Login from "./routes/Login";
import Register from "./routes/Register";
import PendingApproval from "./routes/PendingApproval";
import StartJob from "./routes/StartJob";
import FormFill from "./routes/FormFill";
import MyDrafts from "./routes/MyDrafts";
import ManagerDashboard from "./routes/manager/ManagerDashboard";
import ManagerFolder from "./routes/manager/ManagerFolder";
import ManagerReview from "./routes/manager/ManagerReview";
import ManagerUsers from "./routes/manager/ManagerUsers";

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full flex items-center justify-center p-6">{children}</div>;
}

function PublicRoutes() {
  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function AuthedApp() {
  const profile = useQuery(api.users.me);
  const { signOut } = useAuthActions();
  const { notices, dismiss } = useRealtimeNotifications();

  if (profile === undefined) {
    return <FullScreen>Loading…</FullScreen>;
  }

  // Authenticated, but no profile row was provisioned for this account.
  if (profile === null) {
    return (
      <FullScreen>
        <div className="card max-w-md">
          <h1 className="text-xl font-bold mb-2">Account not provisioned</h1>
          <p className="text-slate-700 text-sm">
            Your account exists but no profile was found. Sign out and try again, or contact your
            manager.
          </p>
          <button className="btn-ghost mt-4" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </FullScreen>
    );
  }

  // Account exists but isn't approved yet (or was declined) → no app access.
  if (profile.status !== "approved") {
    return <PendingApproval profile={profile} onSignOut={signOut} />;
  }

  const isStaff = profile.role === "manager" || profile.role === "admin";

  return (
    <AppShell profile={profile} onSignOut={signOut}>
      <NotificationBar notices={notices} onDismiss={dismiss} />
      <Routes>
        <Route path="/" element={isStaff ? <Navigate to="/manager" replace /> : <StartJob profile={profile} />} />
        {!isStaff && (
          <>
            <Route path="/forms/:id" element={<FormFill />} />
            <Route path="/mine" element={<MyDrafts />} />
          </>
        )}
        {isStaff && (
          <>
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/manager/forms/:formType" element={<ManagerFolder />} />
            <Route path="/manager/submissions/:id" element={<ManagerReview />} />
            <Route path="/manager/users" element={<ManagerUsers />} />
          </>
        )}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/setup" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <>
      <AuthLoading>
        <FullScreen>Loading…</FullScreen>
      </AuthLoading>
      <Unauthenticated>
        <PublicRoutes />
      </Unauthenticated>
      <Authenticated>
        <AuthedApp />
      </Authenticated>
    </>
  );
}
