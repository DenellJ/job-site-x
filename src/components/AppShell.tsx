import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Profile } from "../lib/types";

export function AppShell({
  profile,
  onSignOut,
  children,
}: {
  profile: Profile;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isManager = profile.role === "manager";
  const home = isManager ? "/manager" : "/";

  const links = isManager
    ? [
        { to: "/manager", label: "Dashboard" },
        { to: "/manager/users", label: "Users" },
      ]
    : [
        { to: "/", label: "New Job" },
        { to: "/mine", label: "My Forms" },
      ];

  return (
    <div className="min-h-full flex flex-col bg-concrete">
      <header className="bg-ink text-concrete sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to={home} className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-9 h-9 bg-hi text-ink font-black text-lg rounded-sm">
              JX
            </span>
            <span className="font-black text-xl tracking-tight uppercase hidden sm:inline">
              Job Site X
            </span>
          </Link>
          <nav className="flex items-center gap-1 ml-2">
            {links.map((l) => {
              const active = pathname === l.to;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`text-xs font-black uppercase tracking-widest px-2.5 py-2 rounded-sm ${
                    active ? "bg-hi text-ink" : "hover:text-hi"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <span className="ml-auto text-xs uppercase tracking-widest opacity-80 hidden sm:block">
            {profile.fullName || profile.username} · <span className="text-hi">{profile.role}</span>
          </span>
          <button
            className="text-xs font-black uppercase tracking-widest border-2 border-concrete/30 px-3 py-2 rounded-sm hover:border-hi hover:text-hi"
            onClick={async () => {
              await onSignOut();
              navigate("/login");
            }}
          >
            Sign out
          </button>
        </div>
        <div className="h-stripe" />
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-5">{children}</main>
    </div>
  );
}
