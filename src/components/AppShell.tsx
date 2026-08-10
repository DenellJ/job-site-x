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
  const isStaff = profile.role === "manager" || profile.role === "admin";
  const home = isStaff ? "/manager" : "/";
  const roleLabel = profile.role === "personnel" ? "contractor" : profile.role;

  const links = isStaff
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
      <header className="bg-white text-ink sticky top-0 z-40 border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-3 py-3 grid grid-cols-[1fr_auto] items-center gap-2 sm:px-4 sm:flex sm:gap-3">
          <Link to={home} className="flex items-center shrink-0">
            <img src="/resscott-logo.png" alt="Resscott Limited" className="h-8 sm:h-10 w-auto" />
          </Link>
          <nav className="order-3 col-span-2 flex items-center gap-1 overflow-x-auto sm:order-none sm:col-span-1 sm:ml-1">
            {links.map((l) => {
              const active = pathname === l.to;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-2 rounded-md ${
                    active ? "bg-leaf-tint text-hi2 whitespace-nowrap" : "text-rebar hover:text-ink whitespace-nowrap"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <span className="ml-auto text-xs uppercase tracking-wide text-rebar hidden sm:block">
            {profile.fullName || profile.username} · <span className="text-hi2 font-semibold">{roleLabel}</span>
          </span>
          <button
            className="justify-self-end text-xs font-semibold uppercase tracking-wide border border-stone-300 px-2.5 py-2 rounded-md hover:border-hi hover:text-hi2 sm:px-3"
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
      <main className="flex-1 max-w-3xl mx-auto w-full px-3 py-4 sm:px-4 sm:py-5">{children}</main>
    </div>
  );
}
